from __future__ import annotations

import argparse
from contextlib import contextmanager
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import re
import stat
from subprocess import run
from threading import current_thread, main_thread
from time import monotonic_ns
from uuid import uuid4
from xml.etree import ElementTree


DRIVER_REFERENCE = "https://download.nvidia.com/XFree86/Linux-x86_64/580.105.08/README/profiles.html"
TOOLKIT_REFERENCE = "https://github.com/NVIDIA/nvidia-container-toolkit/blob/v1.20.1/cmd/nvidia-cdi-hook/update-application-profile/update-application-profile.go"


def release_profile_after_exit(record_directory: Path, expected_pid: int, expected_create_time: float,
                               expected_owner_token: str | None = None) -> dict:
    import psutil

    metadata = json.loads((record_directory / "admission.json").read_text())
    if type(metadata["commname"]) is not str or re.fullmatch(r"edh-[0-9a-f]{11}", metadata["commname"]) is None:
        raise RuntimeError("NVIDIA release metadata has an invalid owned process profile name.")
    if record_directory.name != metadata["commname"]:
        raise RuntimeError("NVIDIA profile record directory differs from its exclusive process identity.")
    if metadata["pid"] != expected_pid or metadata["process_create_time"] != expected_create_time:
        raise RuntimeError("NVIDIA profile release differs from its recorded native process identity.")
    if metadata.get("owner_token") != expected_owner_token:
        raise RuntimeError("NVIDIA profile release differs from its transport ownership token.")
    if psutil.pid_exists(expected_pid):
        raise RuntimeError("NVIDIA profile release requires confirmed native process absence.")
    profile_file = Path(metadata["profile_file"])
    expected_file = Path.home() / ".nv" / "nvidia-application-profiles-rc.d" / f"{metadata['commname']}.json"
    if profile_file != expected_file or metadata["profile"]["rules"] != [{
        "pattern": {"feature": "commname", "matches": metadata["commname"]}, "profile": metadata["commname"],
    }]:
        raise RuntimeError("NVIDIA release metadata does not identify an exclusive owned process profile.")
    content = (json.dumps(metadata["profile"], sort_keys=True) + "\n").encode()
    if sha256(content).hexdigest() != metadata["profile_sha256"]:
        raise RuntimeError("NVIDIA profile admission content digest is inconsistent.")
    if profile_file.exists():
        if profile_file.read_bytes() != content:
            raise RuntimeError("Owned NVIDIA application profile changed before post-exit release.")
        profile_file.unlink()
    result = {
        "pid": expected_pid, "process_create_time": expected_create_time,
        "profile_sha256": metadata["profile_sha256"], "native_process_absent": True,
        "profile_removed": not profile_file.exists(), "released_monotonic_ns": monotonic_ns(),
    }
    (record_directory / "post-exit-release.json").write_text(json.dumps(result, sort_keys=True, indent=2) + "\n")
    return result


def release_owner_profiles(record_root: Path, owner_token: str) -> dict:
    import psutil

    if re.fullmatch(r"[0-9a-f]{32}", owner_token) is None:
        raise ValueError("NVIDIA profile owner token must contain 32 lowercase hexadecimal characters.")
    if not record_root.is_absolute() or not record_root.is_dir():
        raise ValueError("NVIDIA profile cleanup requires an existing absolute record root.")
    record_root_argument = str(record_root)
    record_root = record_root.resolve(strict=True)
    profiles = []
    for directory in sorted(record_root.iterdir()):
        if re.fullmatch(r"edh-[0-9a-f]{11}", directory.name) is None:
            continue
        if directory.is_symlink() or not directory.is_dir():
            raise RuntimeError("NVIDIA profile admission records require an exclusive regular directory.")
        admission_file = directory / "admission.json"
        if admission_file.stat().st_size > 65536:
            raise RuntimeError("NVIDIA profile admission record exceeds its byte limit.")
        metadata = json.loads(admission_file.read_text())
        if metadata.get("owner_token") != owner_token:
            continue
        if metadata["commname"] != directory.name:
            raise RuntimeError("NVIDIA profile cleanup identity differs from its admission directory.")
        for key in ("pid", "owner_pid", "owned_group_id", "native_session_id"):
            if type(metadata[key]) is not int or metadata[key] <= 0:
                raise RuntimeError("NVIDIA profile cleanup has an invalid original process identity.")
        for key in ("process_create_time", "owner_create_time"):
            if type(metadata[key]) not in (int, float) or not math.isfinite(metadata[key]) or metadata[key] <= 0:
                raise RuntimeError("NVIDIA profile cleanup has an invalid original process creation time.")
        if psutil.pid_exists(metadata["pid"]) or psutil.pid_exists(metadata["owner_pid"]):
            raise RuntimeError("NVIDIA profile cleanup requires native and owner process absence.")
        try:
            os.killpg(metadata["owned_group_id"], 0)
        except ProcessLookupError:
            pass
        else:
            raise RuntimeError("NVIDIA profile cleanup requires original owned process-group absence.")
        released = release_profile_after_exit(directory, metadata["pid"], metadata["process_create_time"], owner_token)
        profiles.append({
            "commname": metadata["commname"], "pid": metadata["pid"],
            "process_create_time": metadata["process_create_time"], "owner_pid": metadata["owner_pid"],
            "owner_create_time": metadata["owner_create_time"], "profile_sha256": metadata["profile_sha256"],
            "native_process_absent": True, "owner_process_absent": True, "owned_group_absent": True,
            "profile_removed": released["profile_removed"],
        })
    return {"owner_token": owner_token, "record_root": record_root_argument, "profiles": profiles}


def validate_owner_root(record_root: Path, owner_token: str) -> dict:
    import psutil
    import setproctitle

    if re.fullmatch(r"[0-9a-f]{32}", owner_token) is None:
        raise ValueError("NVIDIA profile owner token must contain 32 lowercase hexadecimal characters.")
    if not record_root.is_absolute() or not record_root.is_dir():
        raise ValueError("NVIDIA profile preflight requires an existing absolute record root.")
    record_root_argument = str(record_root)
    record_root = record_root.resolve(strict=True)
    check_file = record_root / f".edh-profile-preflight-{uuid4().hex}.json"
    content = (json.dumps({"owner_token": owner_token, "pid": psutil.Process().pid,
                           "main_thread_title": setproctitle.getthreadtitle()}) + "\n").encode()
    with check_file.open("xb") as output:
        output.write(content)
        output.flush()
        os.fsync(output.fileno())
    directory_fd = os.open(record_root, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory_fd)
        if check_file.read_bytes() != content:
            raise RuntimeError("NVIDIA profile preflight bytes changed before release.")
        check_file.unlink()
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)
    return {"owner_token": owner_token, "record_root": record_root_argument, "record_root_writable": True}


@contextmanager
def owned_nvidia_profile():
    enabled = os.environ.get("EDH_NVIDIA_EGL_PROFILE", "0")
    if enabled not in ("0", "1"):
        raise ValueError("EDH_NVIDIA_EGL_PROFILE must be 0 or 1.")
    if enabled == "0":
        yield None
        return
    if current_thread() is not main_thread():
        raise RuntimeError("NVIDIA application-profile admission requires the native main thread.")
    from setproctitle import getthreadtitle, setthreadtitle
    import psutil

    owner_token = os.environ.get("EDH_NVIDIA_PROFILE_OWNER_TOKEN")
    if owner_token is not None and re.fullmatch(r"[0-9a-f]{32}", owner_token) is None:
        raise ValueError("NVIDIA profile owner token must contain 32 lowercase hexadecimal characters.")
    selected_uuid = os.environ["CUDA_VISIBLE_DEVICES"]
    if not selected_uuid.startswith("GPU-") or "," in selected_uuid:
        raise ValueError("NVIDIA application profiles require one complete CUDA-visible GPU UUID.")
    record_root = Path(os.environ["EDH_NVIDIA_PROFILE_RECORD_DIR"]).resolve(strict=True)
    if not record_root.is_dir():
        raise ValueError("NVIDIA profile recording requires an admitted directory.")
    inventory = run(["nvidia-smi", "-q", "-x"], check=True, capture_output=True).stdout
    root = ElementTree.fromstring(inventory)
    selected = [gpu for gpu in root.findall("gpu") if gpu.findtext("uuid") == selected_uuid]
    if len(selected) != 1:
        raise ValueError("NVIDIA inventory does not identify the configured GPU UUID uniquely.")
    minor = int(selected[0].findtext("minor_number"))
    if not 0 <= minor < 32:
        raise ValueError("NVIDIA EGL device minor exceeds the documented 32-bit mask.")
    device_node = Path(f"/dev/nvidia{minor}")
    device_stat = device_node.stat()
    if not stat.S_ISCHR(device_stat.st_mode) or os.minor(device_stat.st_rdev) != minor:
        raise RuntimeError("NVIDIA UUID/minor admission differs from the actual character device.")
    identity = f"edh-{uuid4().hex[:11]}"
    profile = {
        "profiles": [{"name": identity, "settings": ["EGLVisibleDGPUDevices", 1 << minor]}],
        "rules": [{"pattern": {"feature": "commname", "matches": identity}, "profile": identity}],
    }
    content = (json.dumps(profile, sort_keys=True) + "\n").encode()
    profile_root = Path.home() / ".nv" / "nvidia-application-profiles-rc.d"
    profile_root.mkdir(parents=True, exist_ok=True)
    profile_file = profile_root / f"{identity}.json"
    record_directory = record_root / identity
    record_directory.mkdir()
    (record_directory / "inventory.xml").write_bytes(inventory)
    previous_title = getthreadtitle()
    process = psutil.Process()
    owner = process.parent()
    if owner is None:
        raise RuntimeError("NVIDIA profile admission requires its actual native parent process.")
    metadata = {
        "pid": os.getpid(), "process_create_time": process.create_time(),
        "owner_token": owner_token, "owner_pid": owner.pid, "owner_create_time": owner.create_time(),
        "owned_group_id": os.getpgrp(), "native_session_id": os.getsid(0),
        "commname": identity, "previous_main_thread_title": previous_title,
        "gpu_uuid": selected_uuid, "device_minor": minor, "device_node": str(device_node),
        "egl_device_mask": 1 << minor, "profile_file": str(profile_file), "profile": profile,
        "profile_sha256": sha256(content).hexdigest(), "driver_version": root.findtext("driver_version"),
        "admitted_monotonic_ns": monotonic_ns(), "driver_reference": DRIVER_REFERENCE,
        "toolkit_reference": TOOLKIT_REFERENCE,
    }
    with (record_directory / "admission.json").open("x") as output:
        output.write(json.dumps(metadata, sort_keys=True, indent=2) + "\n")
        output.flush()
        os.fsync(output.fileno())
    directory_fd = os.open(record_directory, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)
    with profile_file.open("xb") as output:
        output.write(content)
        output.flush()
        os.fsync(output.fileno())
    try:
        # NVIDIA commname 规则匹配主线程名称，原始 argv 保持可见。
        setthreadtitle(identity)
        if Path("/proc/self/comm").read_text().strip() != identity:
            raise RuntimeError("Native main-thread commname differs from its exclusive NVIDIA profile.")
        os.environ["__GL_APPLICATION_PROFILE"] = "1"
        os.environ["__GL_APPLICATION_PROFILE_LOG"] = "1"
        yield metadata
    finally:
        if profile_file.read_bytes() != content:
            raise RuntimeError("Owned NVIDIA application profile changed before release.")
        profile_file.unlink()
        setthreadtitle(previous_title)
        (record_directory / "release.json").write_text(json.dumps({
            "pid": os.getpid(), "commname": identity, "profile_sha256": metadata["profile_sha256"],
            "profile_removed": not profile_file.exists(), "released_monotonic_ns": monotonic_ns(),
        }, sort_keys=True, indent=2) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    operation = parser.add_mutually_exclusive_group(required=True)
    operation.add_argument("--release-owner", action="store_true")
    operation.add_argument("--validate-owner-root", action="store_true")
    parser.add_argument("--record-root", type=Path, required=True)
    parser.add_argument("--owner-token", required=True)
    arguments = parser.parse_args()
    handler = release_owner_profiles if arguments.release_owner else validate_owner_root
    result = handler(arguments.record_root, arguments.owner_token)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()

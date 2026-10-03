from __future__ import annotations

import csv
from io import StringIO
import json
import os
from pathlib import Path
import subprocess


def admit_gpu_device() -> dict[str, object]:
    physical_index = os.environ.get("OMNIGIBSON_GPU_ID")
    if physical_index is None or not physical_index.isdecimal():
        raise ValueError("BEHAVIOR requires an explicit physical OMNIGIBSON_GPU_ID.")
    visible_device = os.environ.get("CUDA_VISIBLE_DEVICES")
    if visible_device is None or not visible_device.startswith("GPU-") or "," in visible_device:
        raise ValueError("BEHAVIOR requires CUDA_VISIBLE_DEVICES to contain one complete GPU UUID.")
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=index,uuid,pci.bus_id,name", "--format=csv,noheader,nounits"],
        check=True, capture_output=True, text=True,
    )
    devices = list(csv.reader(StringIO(result.stdout), skipinitialspace=True))
    selected = [row for row in devices if len(row) == 4 and row[0] == str(int(physical_index))]
    if len(selected) != 1 or selected[0][1] != visible_device:
        raise ValueError("BEHAVIOR CUDA visibility must identify its configured physical renderer GPU.")
    row = selected[0]
    renderer_index = os.environ.get("EDH_NVIDIA_RENDERER_GPU_INDEX", row[0])
    if not renderer_index.isdecimal():
        raise ValueError("EDH_NVIDIA_RENDERER_GPU_INDEX must be a nonnegative renderer device index.")
    device = {
        "physical_index": int(row[0]), "uuid": row[1], "pci_bus_id": row[2], "name": row[3],
        "cuda_visible_devices": visible_device, "cuda_logical_index": 0,
        "physics_device": "cuda:0", "renderer_active_gpu": int(renderer_index), "multi_gpu": False,
        "renderer_index_source": "EDH_NVIDIA_RENDERER_GPU_INDEX" if "EDH_NVIDIA_RENDERER_GPU_INDEX" in os.environ else "nvidia-smi physical index",
        "identity_source": "nvidia-smi --query-gpu=index,uuid,pci.bus_id,name",
    }
    if os.environ.get("EDH_NVIDIA_EGL_PROFILE") == "1":
        admission = json.loads(Path(os.environ["EDH_NVIDIA_PROFILE_ADMISSION_FILE"]).read_text())
        if admission["pid"] != os.getpid() or admission["gpu_uuid"] != row[1]:
            raise RuntimeError("BEHAVIOR profile admission differs from its actual native process and GPU UUID.")
        device["application_profile"] = admission
    return device

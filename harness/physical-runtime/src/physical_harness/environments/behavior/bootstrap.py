from __future__ import annotations

from contextlib import nullcontext
from hashlib import sha256
import logging
import os
from pathlib import Path
import shutil
import signal
import socket
import sys
import warnings


# 原始 OmniGibson 启动顺序与许可证来源记录于 BOOTSTRAP-LICENSE 和 README。
SOURCE_REVISION = "b1979916ec1549b10a4e65e630bc6504a9af1b00"
SOURCE_SHA256 = "d800c2832f24962c440c4781ebfdb4ea78c74aac37d2c74ee7894ae430f1e2a9"


def launch_behavior_app(device: dict[str, object]):
    os.environ["OMNI_KIT_ACCEPT_EULA"] = "YES"
    import isaacsim
    import omnigibson as og
    from omnigibson import lazy
    from omnigibson.macros import gm
    from omnigibson import simulator
    from omnigibson.utils.asset_utils import ensure_omnigibson_robot_assets_version
    from omnigibson.utils.ui_utils import suppress_omni_log
    from numba.core.errors import NumbaPerformanceWarning

    source_file = Path(simulator.__file__).resolve(strict=True)
    if sha256(source_file.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise RuntimeError("BEHAVIOR bootstrap requires its exact admitted OmniGibson simulator source.")
    if og.app is not None or og.sim is not None:
        raise RuntimeError("BEHAVIOR bootstrap requires an uninitialized native application.")
    simulator.log.setLevel(logging.DEBUG if gm.DEBUG else logging.INFO)
    ensure_omnigibson_robot_assets_version()
    configuration = {
        "headless": gm.HEADLESS or bool(gm.REMOTE_STREAMING),
        "active_gpu": device["renderer_active_gpu"],
        "physics_gpu": device["cuda_logical_index"],
        "multi_gpu": False,
        "max_gpu_count": 1,
    }
    saved_argv = sys.argv[:]
    try:
        sys.argv = [saved_argv[0]]
        if not gm.DEBUG:
            warnings.simplefilter("ignore", category=NumbaPerformanceWarning)
            if gm.NO_OMNI_LOGS:
                sys.argv.extend(["--/log/level=error", "--/log/fileLogLevel=error", "--/log/outputStreamLevel=error"])
        isaac_path = Path(os.environ["ISAAC_PATH"])
        version_file = isaac_path / "VERSION"
        isaac_version = version_file.read_text().strip().split("-")[0]
        version_tuple = tuple(map(int, isaac_version.split(".")[:3]))
        if version_tuple not in simulator.m.KIT_FILES:
            raise RuntimeError("BEHAVIOR bootstrap received an unsupported Isaac Sim version.")
        kit_name = simulator.m.KIT_FILES[version_tuple]
        if gm.ENABLE_VR:
            kit_name = kit_name.replace(".kit", "_vr.kit")
        kit_file = source_file.parent / kit_name
        exp_path = Path(os.environ["EXP_PATH"])
        kit_target = exp_path / kit_name
        icon_file = source_file.parents[2] / "docs" / "assets" / "OmniGibson_logo.png"
        shutil.copyfile(kit_file, kit_target)
        shutil.copyfile(icon_file, exp_path / "OmniGibson_logo.png")
        os.environ["MDL_USER_PATH"] = str((source_file.parent / "materials").resolve(strict=True))
        local_appdata = Path(gm.APPDATA_PATH) / "local"
        local_appdata.mkdir(parents=True, exist_ok=True)
        sys.argv.extend(["--portable-root", str(local_appdata)])
        for kind in ("cache", "data"):
            directory = Path(gm.APPDATA_PATH) / "global" / kind
            directory.mkdir(parents=True, exist_ok=True)
            sys.argv.append(f"--/app/tokens/omni_global_{kind}={directory}")
        launch_context = nullcontext if gm.DEBUG else simulator.SuppressLogsUntilError if gm.NO_OMNI_LOGS else suppress_omni_log
        with launch_context(None):
            app = isaacsim.SimulationApp(configuration, experience=str(kit_target.resolve(strict=True)))
            og.app = app
    finally:
        sys.argv = saved_argv
    if not lazy.isaacsim.core.utils.stage.close_stage():
        raise RuntimeError("BEHAVIOR bootstrap could not close its initial SDK stage.")
    logging.getLogger().setLevel(logging.WARNING)
    if gm.REMOTE_STREAMING:
        app.set_setting("/app/window/drawMouse", True)
        app.set_setting("/app/livestream/proto", "ws")
        app.set_setting("/app/livestream/websocket/framerate_limit", 120)
        app.set_setting("/ngx/enabled", False)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
            connection.connect(("8.8.8.8", 80))
            address = connection.getsockname()[0]
        if gm.REMOTE_STREAMING == "native":
            lazy.isaacsim.core.utils.extensions.enable_extension("omni.kit.livestream.native")
            simulator.log.info("Native livestream address: %s", address)
        elif gm.REMOTE_STREAMING == "webrtc":
            app.set_setting("/exts/omni.services.transport.server.http/port", gm.HTTP_PORT)
            app.set_setting("/app/livestream/port", gm.WEBRTC_PORT)
            lazy.isaacsim.core.utils.extensions.enable_extension("omni.services.streamclient.webrtc")
            simulator.log.info("WebRTC livestream address: http://%s:%s", address, gm.HTTP_PORT)
        else:
            raise ValueError("BEHAVIOR bootstrap received an unsupported REMOTE_STREAMING setting.")
    native_log = lazy.omni.log.get_log()
    if gm.HEADLESS:
        native_log.set_channel_enabled("carb.windowing-glfw.plugin", False, lazy.omni.log.SettingBehavior.OVERRIDE)
    if not gm.DEBUG:
        for channel in ("omni.hydra.scene_delegate.plugin", "omni.kit.manipulator.prim.model"):
            native_log.set_channel_enabled(channel, False, lazy.omni.log.SettingBehavior.OVERRIDE)
    hidden_windows = []
    if not gm.RENDER_VIEWER_CAMERA:
        hidden_windows.append("Viewport")
    if gm.GUI_VIEWPORT_ONLY:
        hidden_windows.extend([
            "Console", "Main ToolBar", "Stage", "Layer", "Property", "Render Settings", "Content", "Flow",
            "Semantics Schema Editor", "VR", "Isaac Sim Assets [Beta]",
        ])
    for name in hidden_windows:
        window = lazy.omni.ui.Workspace.get_window(name)
        if window is not None:
            window.visible = False
            app.update()
    lazy.omni.kit.widget.stage.context_menu.ContextMenu.save_prim = simulator.print_save_usd_warning
    app.update()
    registry = lazy.omni.kit.hotkeys.core.get_hotkey_registry()
    for hotkey in list(registry.get_all_hotkeys()):
        registry.deregister_hotkey(hotkey)
    shutdown_stream = lazy.omni.kit.app.get_app().get_shutdown_event_stream()
    shutdown_stream.create_subscription_to_pop(og.cleanup, name="og_cleanup", order=0)
    signal.signal(signal.SIGINT, og.shutdown_handler)
    from omnigibson.utils import backend_utils

    backend_utils._compute_backend.set_methods_from_backend(
        backend_utils._ComputeNumpyBackend if gm.USE_NUMPY_CONTROLLER_BACKEND else backend_utils._ComputeTorchBackend
    )
    return app, {
        "upstream_revision": SOURCE_REVISION, "upstream_source_file": str(source_file),
        "upstream_source_sha256": SOURCE_SHA256,
        "experience_file": str(kit_file), "experience_sha256": sha256(kit_file.read_bytes()).hexdigest(),
        "isaac_version": isaac_version, "initial_launch_configuration": configuration,
        "adapter_source_sha256": sha256(Path(__file__).read_bytes()).hexdigest(),
    }

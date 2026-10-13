from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Mapping

from physical_harness.environments import NativeEnvironment
from physical_harness.validation import ContractValidator


def create_native_environment(configuration: Mapping[str, Any], validator: ContractValidator) -> NativeEnvironment:
    provider = configuration["provider"]
    if provider == "robocasa":
        if "source_root" in configuration:
            raise ValueError("RoboCasa does not use a worker source_root override.")
        from physical_harness.environments.robocasa import RoboCasaEnvironment
        return RoboCasaEnvironment(validator)
    if provider == "robotwin":
        source_root = Path(configuration["source_root"]).resolve(strict=True)
        if not source_root.is_dir():
            raise ValueError("RoboTwin source_root must name an installed source directory.")
        from physical_harness.environments.robotwin import RoboTwinEnvironment
        os.chdir(source_root)
        return RoboTwinEnvironment(source_root, validator)
    if provider == "behavior":
        source_root = Path(configuration["source_root"]).resolve(strict=True)
        if not source_root.is_dir():
            raise ValueError("BEHAVIOR source_root must name an installed source directory.")
        from physical_harness.environments.behavior.process import BehaviorProcessEnvironment
        return BehaviorProcessEnvironment(source_root, validator)
    if provider == "robodojo":
        if "source_root" in configuration:
            raise ValueError("RoboDojo is connected through its external RPC server, not a worker source_root.")
        from physical_harness.environments.robodojo import RoboDojoEnvironment
        return RoboDojoEnvironment(validator)
    raise ValueError("Unsupported native environment provider.")

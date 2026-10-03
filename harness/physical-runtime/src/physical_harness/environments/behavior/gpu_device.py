from __future__ import annotations

import csv
from io import StringIO
import os
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
    return {
        "physical_index": int(row[0]), "uuid": row[1], "pci_bus_id": row[2], "name": row[3],
        "cuda_visible_devices": visible_device, "cuda_logical_index": 0,
        "physics_device": "cuda:0", "renderer_active_gpu": int(row[0]), "multi_gpu": False,
        "identity_source": "nvidia-smi --query-gpu=index,uuid,pci.bus_id,name",
    }

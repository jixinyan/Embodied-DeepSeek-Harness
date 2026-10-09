from collections.abc import Callable
from typing import Any

from gr00t.policy.gr00t_policy import _rec_to_dtype
import torch
from torch.utils._pytree import tree_flatten_with_path


def collate_model_input(collator: Callable, processed_inputs: list[Any]) -> dict[str, Any]:
    prepared = _rec_to_dtype(collator(processed_inputs), dtype=torch.bfloat16)
    state = prepared["inputs"]["state"]
    if not isinstance(state, torch.Tensor) or not state.is_floating_point():
        raise ValueError("GR00T preprocessing requires a floating-point state tensor.")
    tensors, _ = tree_flatten_with_path(prepared)
    for path, value in tensors:
        if isinstance(value, torch.Tensor) and (value.is_complex() or not torch.isfinite(value).all()):
            raise ValueError(f"GR00T preprocessing returned invalid model input {path}.")
    return prepared

from hashlib import sha256
from itertools import chain
import json
import math
from pathlib import Path
from sys import float_info

from jsonschema import Draft202012Validator


_STATISTIC_FIELDS = ("min", "max", "mean", "std", "q01", "q99")
_CAPACITY = {"type": "integer", "minimum": 1}
_MODEL = Draft202012Validator({
    "type": "object",
    "required": ["model_type", "max_state_dim", "max_action_dim", "action_horizon", "model_name", "backbone_model_type"],
    "properties": {
        "model_type": {"const": "Gr00tN1d6"},
        **{name: _CAPACITY for name in ("max_state_dim", "max_action_dim", "action_horizon")},
        **{name: {"type": "string", "minLength": 1} for name in ("model_name", "backbone_model_type")},
    },
})
_PROCESSOR = Draft202012Validator({
    "type": "object", "required": ["processor_class", "processor_kwargs"],
    "properties": {
        "processor_class": {"const": "Gr00tN1d6Processor"},
        "processor_kwargs": {
            "type": "object",
            "required": ["modality_configs", "max_state_dim", "max_action_dim", "max_action_horizon", "model_name", "model_type"],
            "properties": {
                "modality_configs": {"type": "object"},
                **{name: _CAPACITY for name in ("max_state_dim", "max_action_dim", "max_action_horizon")},
                **{name: {"type": "string", "minLength": 1} for name in ("model_name", "model_type")},
                **{name: {"type": "boolean"} for name in (
                    "use_percentiles", "clip_outliers", "apply_sincos_state_encoding", "use_relative_action",
                )},
            },
        },
    },
})
_MODALITY = Draft202012Validator({
    "type": "object", "required": ["delta_indices", "modality_keys"],
    "properties": {
        "delta_indices": {"type": "array", "minItems": 1, "items": {"type": "integer"}},
        "modality_keys": {"type": "array", "minItems": 1, "uniqueItems": True,
                          "items": {"type": "string", "minLength": 1}},
        **{name: {"type": ["array", "null"], "uniqueItems": True,
                  "items": {"type": "string", "minLength": 1}}
           for name in ("sin_cos_embedding_keys", "mean_std_embedding_keys")},
        "action_configs": {"type": ["array", "null"], "items": {"type": "object"}},
    },
})


def _check_statistics(statistics: dict, dimension: int, *, horizon: int | None = None) -> None:
    properties = {}
    for field in _STATISTIC_FIELDS:
        number = {"type": "number", "minimum": 0 if field == "std" else -float_info.max,
                  "maximum": float_info.max}
        vector = {"type": "array", "minItems": dimension, "maxItems": dimension, "items": number}
        properties[field] = vector if horizon is None else {"anyOf": [
            vector, {"type": "array", "minItems": horizon, "maxItems": horizon, "items": vector},
        ]}
    Draft202012Validator({"type": "object", "required": list(_STATISTIC_FIELDS),
                          "properties": properties}).validate(statistics)
    shapes = set()
    flattened = {}
    for field in _STATISTIC_FIELDS:
        values = statistics[field]
        matrix = isinstance(values[0], list)
        shapes.add((len(values), len(values[0])) if matrix else (len(values),))
        flattened[field] = list(chain.from_iterable(values)) if matrix else values
        if not all(math.isfinite(value) for value in flattened[field]):
            raise ValueError("GR00T normalization requires finite statistics.")
    if len(shapes) != 1:
        raise ValueError("GR00T normalization statistics have inconsistent shapes.")
    for lower, upper in (("min", "max"), ("q01", "q99")):
        if any(low > high or not math.isfinite(high - low)
               for low, high in zip(flattened[lower], flattened[upper], strict=True)):
            raise ValueError("GR00T normalization bounds require ordered finite ranges.")


def verify_gr00t_configuration(checkpoint: str | Path, *, embodiment_id: str,
                               video_keys: list[str], state_dimensions: dict[str, int],
                               action_dimensions: dict[str, int], action_horizon: int,
                               relative_state_keys: dict[str, str] | None = None,
                               language_key: str | None = None) -> dict:
    directory = Path(checkpoint).resolve(strict=True)
    documents, hashes = {}, {}
    for name in ("config.json", "processor_config.json", "statistics.json"):
        path = (directory / name).resolve(strict=True)
        if not path.is_relative_to(directory):
            raise ValueError("GR00T configuration files must belong to the selected checkpoint.")
        data = path.read_bytes()
        documents[name] = json.loads(data)
        hashes[name] = sha256(data).hexdigest()
    model = documents["config.json"]
    processor = documents["processor_config.json"]
    _MODEL.validate(model)
    _PROCESSOR.validate(processor)
    kwargs = processor["processor_kwargs"]
    modalities = kwargs["modality_configs"][embodiment_id]
    for kind, keys in (("video", video_keys), ("state", list(state_dimensions)),
                       ("action", list(action_dimensions)), ("language", None)):
        modality = modalities[kind]
        _MODALITY.validate(modality)
        if keys is not None and modality["modality_keys"] != keys:
            raise ValueError(f"Checkpoint has incompatible {embodiment_id} {kind} modalities.")
        indices = list(range(action_horizon)) if kind == "action" else [0]
        if modality["delta_indices"] != indices:
            raise ValueError(f"Checkpoint has incompatible {embodiment_id} {kind} temporal indices.")
        for field in ("sin_cos_embedding_keys", "mean_std_embedding_keys"):
            if not set(modality.get(field) or []).issubset(modality["modality_keys"]):
                raise ValueError(f"Checkpoint {kind} encoding references an unknown modality.")
    language = modalities["language"]["modality_keys"]
    if len(language) != 1 or language_key is not None and language != [language_key]:
        raise ValueError("Checkpoint has an incompatible GR00T language key.")
    relative = relative_state_keys or {}
    if relative and kwargs.get("use_relative_action", False) is not True:
        raise ValueError("Checkpoint must convert relative GR00T actions to absolute targets.")
    configs = modalities["action"].get("action_configs")
    if configs is None:
        if relative:
            raise ValueError("Checkpoint requires explicit relative action representations.")
    else:
        if len(configs) != len(action_dimensions):
            raise ValueError("Checkpoint has incompatible GR00T action representations.")
        for key, config in zip(action_dimensions, configs, strict=True):
            expected = {"rep": "RELATIVE" if key in relative else "ABSOLUTE",
                        "type": "NON_EEF", "format": "DEFAULT", "state_key": relative.get(key)}
            if any(config.get(field) != value for field, value in expected.items()):
                raise ValueError(f"Checkpoint has incompatible {embodiment_id} {key} action semantics.")
    for processor_key, model_key in (("max_state_dim", "max_state_dim"), ("max_action_dim", "max_action_dim"),
                                     ("max_action_horizon", "action_horizon"), ("model_name", "model_name"),
                                     ("model_type", "backbone_model_type")):
        if kwargs[processor_key] != model[model_key]:
            raise ValueError(f"GR00T processor {processor_key} differs from the selected model configuration.")
    encoded_keys = set(modalities["state"].get("sin_cos_embedding_keys") or []) if kwargs.get("apply_sincos_state_encoding", False) else set()
    state_dim = sum(size * (2 if key in encoded_keys else 1) for key, size in state_dimensions.items())
    if (state_dim > kwargs["max_state_dim"] or sum(action_dimensions.values()) > kwargs["max_action_dim"]
            or action_horizon > kwargs["max_action_horizon"]):
        raise ValueError("GR00T processor capacity does not support the selected embodiment.")
    statistics = documents["statistics.json"][embodiment_id]
    for kind, dimensions in (("state", state_dimensions), ("action", action_dimensions)):
        for key, dimension in dimensions.items():
            _check_statistics(statistics[kind][key], dimension)
    for key in relative:
        _check_statistics(statistics["relative_action"][key], action_dimensions[key], horizon=action_horizon)
    return {"embodimentId": embodiment_id, "languageKey": language[0], "stateDimension": state_dim,
            "actionDimension": sum(action_dimensions.values()), "actionHorizon": action_horizon,
            "configurationSha256": hashes}

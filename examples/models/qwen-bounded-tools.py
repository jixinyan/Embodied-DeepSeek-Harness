import os

from pydantic import BaseModel
from vllm.tool_parsers.abstract_tool_parser import ToolParserManager
from vllm.tool_parsers.qwen3_engine_tool_parser import Qwen3EngineToolParser
from xgrammar.structural_tag import JSONSchemaFormat


MAX_WHITESPACE = int(os.environ.get("EDH_QWEN_MAX_WHITESPACE", "16"))
if not 1 <= MAX_WHITESPACE <= 1024:
    raise ValueError("EDH_QWEN_MAX_WHITESPACE must be an integer from 1 to 1024.")


def parameter_formats(value):
    if isinstance(value, JSONSchemaFormat):
        if value.style == "qwen_xml":
            yield value
    elif isinstance(value, BaseModel):
        for name in type(value).model_fields:
            yield from parameter_formats(getattr(value, name))
    elif isinstance(value, list):
        for item in value:
            yield from parameter_formats(item)


@ToolParserManager.register_module("edh_qwen3_xml")
class BoundedQwenToolParser(Qwen3EngineToolParser):
    def get_structural_tag(self, request, *, reasoning=False):
        tag = super().get_structural_tag(request, reasoning=reasoning)
        if tag is None:
            return None
        bounded = tag.model_copy(deep=True)
        parameters = list(parameter_formats(bounded))
        if not parameters:
            raise ValueError("Native Qwen structural tags contain no supported parameter formats.")
        for parameters_format in parameters:
            parameters_format.max_whitespace_cnt = MAX_WHITESPACE
        return bounded

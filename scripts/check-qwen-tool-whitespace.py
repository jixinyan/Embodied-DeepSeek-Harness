import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from transformers import AutoTokenizer
from vllm.entrypoints.openai.chat_completion.protocol import ChatCompletionRequest
from vllm.tool_parsers.abstract_tool_parser import ToolParserManager
import xgrammar


parser = argparse.ArgumentParser()
parser.add_argument("--request", required=True, type=Path)
parser.add_argument("--checkpoint", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--plugin", type=Path, default=Path(__file__).resolve().parents[1] / "examples/models/qwen-bounded-tools.py")
args = parser.parse_args()
source = args.request.read_bytes()
request = ChatCompletionRequest.model_validate(json.loads(source))
if not request.tools or not any(tool.function.strict is True for tool in request.tools):
    raise ValueError("Provide an actual retained Chat Completions request with strict tools.")
plugin = args.plugin.resolve()
spec = importlib.util.spec_from_file_location("edh_qwen_bounded_tools", plugin)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
tokenizer = AutoTokenizer.from_pretrained(args.checkpoint, local_files_only=True)
native = ToolParserManager.get_tool_parser("qwen3_xml")(tokenizer)
bounded = module.BoundedQwenToolParser(tokenizer)
original_tag = native.get_structural_tag(request)
bounded_tag = bounded.get_structural_tag(request)
original_formats = list(module.parameter_formats(original_tag))
bounded_formats = list(module.parameter_formats(bounded_tag))
if not original_formats or len(original_formats) != len(bounded_formats):
    raise RuntimeError("Native tool parameter schemas are missing or changed.")
for original, changed in zip(original_formats, bounded_formats, strict=True):
    if changed.max_whitespace_cnt != module.MAX_WHITESPACE:
        raise RuntimeError("The configured parameter whitespace bound is missing.")
    if original.model_dump(exclude={"max_whitespace_cnt"}) != changed.model_dump(exclude={"max_whitespace_cnt"}):
        raise RuntimeError("The native parameter schema changed.")
original = original_tag.model_dump_json()
changed = bounded_tag.model_dump_json()
compiler = xgrammar.GrammarCompiler(xgrammar.TokenizerInfo.from_huggingface(tokenizer))
compiler.compile_structural_tag(bounded_tag)
args.output.mkdir(parents=True, exist_ok=False)
(args.output / "native-structural-tag.json").write_text(original)
(args.output / "bounded-structural-tag.json").write_text(changed)
result = {
    "scope": "Actual retained tool schemas and checkpoint tokenizer; no model inference or tool dispatch",
    "source_sha256": hashlib.sha256(source).hexdigest(),
    "schemas": len(bounded_formats), "native_schemas_preserved": True,
    "original_sha256": hashlib.sha256(original.encode()).hexdigest(),
    "bounded_sha256": hashlib.sha256(changed.encode()).hexdigest(),
    "bound": module.MAX_WHITESPACE, "actual_tokenizer_compilation": "passed",
}
(args.output / "acceptance.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))

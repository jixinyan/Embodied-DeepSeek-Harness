import argparse
import hashlib
import json
from pathlib import Path
import time

import requests
from transformers import AutoTokenizer


parser = argparse.ArgumentParser()
parser.add_argument("--request", required=True, type=Path)
parser.add_argument("--checkpoint", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--base-url", required=True)
parser.add_argument("--expected-tool", required=True)
parser.add_argument("--timeout", type=float, default=300)
args = parser.parse_args()
if not 0 < args.timeout <= 600:
    raise ValueError("The request timeout must be positive and at most 600 seconds.")
source = args.request.read_bytes()
request = json.loads(source)
if not request.get("messages") or not request.get("tools") or not request.get("max_tokens"):
    raise ValueError("Provide a retained native request with messages, tools and max_tokens.")
selected = [tool for tool in request["tools"] if tool["function"]["name"] == args.expected_tool]
if len(selected) != 1 or selected[0]["function"]["parameters"].get("properties") != {}:
    raise ValueError("The expected tool must retain its actual empty-argument schema.")
request.update({"stream": False, "return_token_ids": True})
request.pop("stream_options", None)
args.output.mkdir(parents=True, exist_ok=False)
(args.output / "request.json").write_text(json.dumps(request, indent=2) + "\n")
started = time.monotonic()
response = requests.post(args.base_url.rstrip("/") + "/chat/completions", json=request, timeout=args.timeout)
elapsed = time.monotonic() - started
result = response.json()
(args.output / "response.json").write_text(json.dumps({"status": response.status_code, "elapsed_s": elapsed, "body": result}, indent=2) + "\n")
response.raise_for_status()
choice = result["choices"][0]
token_ids = choice["token_ids"]
tokenizer = AutoTokenizer.from_pretrained(args.checkpoint, local_files_only=True)
decoded = tokenizer.decode(token_ids, skip_special_tokens=False)
(args.output / "tokens.txt").write_text(decoded)
calls = choice["message"]["tool_calls"]
if len(calls) != 1 or calls[0]["function"]["name"] != args.expected_tool or json.loads(calls[0]["function"]["arguments"]) != {}:
    raise RuntimeError("The actual model did not return the expected empty-argument tool call.")
if result["usage"]["completion_tokens"] != len(token_ids) or len(token_ids) >= request["max_tokens"]:
    raise RuntimeError("The actual model exhausted its output budget or reported inconsistent tokens.")
if choice["finish_reason"] != "tool_calls":
    raise RuntimeError("The actual tool response has no tool-call completion boundary.")
summary = {
    "scope": "Actual checkpoint inference on retained native context; zero tool dispatch or physical controls",
    "source_sha256": hashlib.sha256(source).hexdigest(),
    "request_sha256": hashlib.sha256((args.output / "request.json").read_bytes()).hexdigest(),
    "elapsed_s": elapsed, "usage": result["usage"],
    "finish_reason": choice["finish_reason"], "token_count": len(token_ids),
    "decoded_sha256": hashlib.sha256(decoded.encode()).hexdigest(),
    "tool": args.expected_tool, "arguments": {}, "output_budget_exhausted": False,
}
(args.output / "acceptance.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary))

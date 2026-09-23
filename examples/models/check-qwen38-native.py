from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
from urllib.request import Request, urlopen


def complete(base_url: str, payload: dict) -> dict:
    request = Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=180) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--camera", type=Path, required=True)
    args = parser.parse_args()

    image = base64.b64encode(args.camera.read_bytes()).decode("ascii")
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": "Inspect this actual RoboCasa OpenCabinet camera frame. Call perception__capture exactly once, then describe only what the image supports."},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image}"}},
        ],
    }]
    tool = {
        "type": "function",
        "function": {
            "name": "perception__capture",
            "description": "Confirm the source of the current RoboCasa camera frame.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    }
    first = complete(args.base_url, {
        "model": args.model,
        "messages": messages,
        "tools": [tool],
        "tool_choice": "required",
        "max_tokens": 1024,
    })
    assistant = first["choices"][0]["message"]
    calls = assistant.get("tool_calls") or []
    if len(calls) != 1 or calls[0]["function"]["name"] != "perception__capture":
        raise RuntimeError("The VLM did not request the camera tool exactly once.")
    if json.loads(calls[0]["function"]["arguments"]) != {}:
        raise RuntimeError("The VLM returned unexpected camera tool arguments.")
    messages.extend([
        assistant,
        {
            "role": "tool",
            "tool_call_id": calls[0]["id"],
            "content": "Source confirmed: actual RoboCasa OpenCabinet PandaOmron agentview_left reset frame.",
        },
    ])
    second = complete(args.base_url, {
        "model": args.model,
        "messages": messages,
        "max_tokens": 1024,
    })
    final = second["choices"][0]["message"]
    if not isinstance(final.get("content"), str) or not final["content"].strip():
        raise RuntimeError("The VLM did not produce a final visual observation.")
    print(json.dumps({
        "model": args.model,
        "camera": str(args.camera),
        "tool": calls[0]["function"]["name"],
        "finish_reasons": [first["choices"][0]["finish_reason"], second["choices"][0]["finish_reason"]],
        "observation": final["content"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

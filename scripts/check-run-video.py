import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--export", type=Path, required=True)
    arguments = parser.parse_args()
    video = arguments.video.resolve()
    report = json.loads(video.with_suffix(".json").read_text())
    source = arguments.export.resolve() / "source"
    for name, expected in report["sourceSha256"].items():
        if hashlib.sha256((source / f"{name}.json").read_bytes()).hexdigest() != expected:
            raise ValueError("Composite report and original source hashes differ.")
    run = json.loads((source / "run.json").read_text())
    events = json.loads((source / "events.json").read_text())
    verdicts = [event["detail"]["result"]["status"] for event in events
                if event["type"] == "verification.completed"]
    if (run["id"] != report["runId"] or run["state"] != report["runState"] or
            len(events) != report["recordedEventCount"] or verdicts != report["formalVerdicts"] or
            report["formalVerdict"] != (verdicts[-1] if verdicts else None)):
        raise ValueError("Composite report differs from actual task records.")
    tool_failures = sum(event["type"] == "tool.failed" for event in events)
    if "toolFailureCount" in report and report["toolFailureCount"] != tool_failures:
        raise ValueError("Composite error count differs from original tool events.")
    probe = json.loads(subprocess.run([
        "ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
        "stream=width,height,nb_read_frames,r_frame_rate,pix_fmt,codec_name:format=duration", "-of", "json", str(video)
    ], check=True, capture_output=True, text=True).stdout)
    if len(probe["streams"]) != 1:
        raise ValueError("Composite requires one video stream.")
    stream = probe["streams"][0]
    if (stream["width"] != report["width"] or stream["height"] != report["height"] or
            int(stream["nb_read_frames"]) != report["frameCount"] or
            stream["r_frame_rate"] != f"{report['fps']}/1" or
            stream["codec_name"] != "h264" or stream["pix_fmt"] != "yuv420p"):
        raise ValueError("Encoded video differs from its render report.")
    duration = float(probe["format"]["duration"])
    if abs(duration - report["frameCount"] / report["fps"]) > 0.002:
        raise ValueError("Encoded duration differs from the complete frame sequence.")
    subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"], check=True)
    result = {"runId": run["id"], "state": run["state"], "scope": report["scope"],
              "frames": report["frameCount"], "durationS": duration, "formalVerdicts": verdicts,
              "toolFailureCount": tool_failures,
              "sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
              "sourceIntegrity": "passed", "fullVideoDecode": "passed",
              "textBoundaryChecks": report["textBoundaryChecks"]}
    video.with_suffix(".validation.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()

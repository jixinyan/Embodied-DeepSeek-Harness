import argparse
from bisect import bisect_right
from datetime import datetime
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1920
HEIGHT = 1080
BACKGROUND = "#0d171b"
PANEL = "#17272d"
BORDER = "#355158"
TEXT = "#e7efee"
MUTED = "#a9bfbd"
ACCENT = "#7dd8ca"
FAILURE = "#ffb3a7"


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def load_json(file):
    return json.loads(file.read_text(encoding="utf-8"))


def latest(events, times, wall, event_type):
    for index in range(bisect_right(times, wall) - 1, -1, -1):
        if events[index]["type"] == event_type:
            return events[index]
    return None


def draw_panel(draw, bounds, title, font):
    draw.rounded_rectangle(bounds, radius=16, fill=PANEL, outline=BORDER, width=2)
    draw.text((bounds[0] + 18, bounds[1] + 13), title, font=font, fill=ACCENT)


def wrapped_lines(draw, source, font, width):
    lines = []
    for paragraph in source.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for word in paragraph.split(" "):
            candidate = word if not current else f"{current} {word}"
            if draw.textlength(candidate, font=font) <= width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                if draw.textlength(word, font=font) > width:
                    current = ""
                    for character in word:
                        if draw.textlength(current + character, font=font) > width:
                            lines.append(current)
                            current = character
                        else:
                            current += character
                else:
                    current = word
        lines.append(current)
    return lines


def draw_lines(draw, lines, origin, font, line_height, maximum, right, bottom, color=TEXT):
    if len(lines) > maximum:
        raise ValueError("The rendered text page exceeds its declared line limit.")
    for index, line in enumerate(lines):
        x = origin[0]
        y = origin[1] + index * line_height
        bounds = draw.textbbox((x, y), line, font=font)
        if bounds[2] > right or bounds[3] > bottom:
            raise ValueError("Rendered text crossed a panel boundary.")
        draw.text((x, y), line, font=font, fill=color)


def draw_excerpt(draw, source, origin, width, line_height, maximum, font, page_index, right, bottom):
    lines = wrapped_lines(draw, source, font, width)
    pages = [lines[index:index + maximum] for index in range(0, len(lines), maximum)] or [[""]]
    index = page_index % len(pages)
    draw_lines(draw, pages[index], origin, font, line_height, maximum, right, bottom)
    return index + 1, len(pages)


def recorded_holds(events):
    holds = []
    for event in events:
        duration = {"agent.output": 2.0, "plan.updated": 1.0,
                    "verification.completed": 3.0, "run.failed": 4.0}.get(event["type"])
        if duration is not None:
            holds.append((timestamp(event["at"]), duration, event["sequence"], event["type"]))
    return holds


def playback_schedule(events, wall_speed):
    start = timestamp(events[0]["at"])
    end = timestamp(events[-1]["at"])
    cursor = start
    playback = 0.0
    segments = []
    for wall, duration, sequence, kind in recorded_holds(events):
        if wall < cursor:
            raise ValueError("Recorded hold events are out of order.")
        advance = (wall - cursor) / wall_speed
        if advance:
            segments.append((playback, playback + advance, cursor, wall, None))
            playback += advance
        segments.append((playback, playback + duration, wall, wall, (sequence, kind)))
        playback += duration
        cursor = wall
    tail = (end - cursor) / wall_speed
    if tail:
        segments.append((playback, playback + tail, cursor, end, None))
        playback += tail
    return segments, playback, start, end


def wall_at(segments, second):
    for beginning, ending, source_start, source_end, hold in segments:
        if second < ending:
            fraction = (second - beginning) / (ending - beginning)
            return source_start + (source_end - source_start) * fraction, hold
    return segments[-1][3], segments[-1][4]


def camera_source(export, manifest, images):
    lookup = {(row["eventSequence"], row["image"]["name"]): row["file"]
              for row in images if row["kind"] == "simulation.frame" and row["file"]}
    cameras = []
    for video in manifest["videos"]:
        frames = []
        for sequence, wall, simulation in zip(video["frameEventSequences"],
                                               video["frameWallTimes"],
                                               video["frameSimulationTimesS"], strict=True):
            source = lookup.get((sequence, video["camera"]))
            if not source:
                raise ValueError(f"Missing original frame {sequence} for {video['camera']}.")
            file = export / source
            if not file.is_file():
                raise ValueError(f"Missing original image file: {file}")
            frames.append((timestamp(wall), file, sequence, simulation))
        cameras.append((video["camera"], frames, [row[0] for row in frames]))
    if len(cameras) != 3:
        raise ValueError("This video layout requires three recorded cameras.")
    return cameras


def render_frame(export, events, event_times, cameras, wall, hold, playback_second, speed, fonts,
                 source_run, camera_cache, model_start):
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    title, body, small, caption = fonts
    draw.text((40, 20), f"{source_run['scenario']} · REAL RECORDED RUN", font=title, fill=TEXT)
    draw.text((42, 72), f"Run {source_run['id']} · wall playback {speed:g}×", font=small, fill=MUTED)
    recovery_count = sum(event["type"].startswith("recovery.") or event["detail"].get("member") == "evolver"
                         for event in events)
    draw.text((790, 73), f"Retry/Evolver events: {recovery_count} recorded", font=caption, fill=MUTED)
    if hold:
        draw.text((1270, 48), f"RECORDED HOLD  #{hold[0]} {hold[1]}", font=small, fill=ACCENT)
    draw_panel(draw, (30, 115, 1170, 575), "MODEL REASONING · ORIGINAL RECORD", body)
    output = latest(events, event_times, wall, "agent.output")
    if output:
        blocks = output["detail"]["message"]["content"]
        reasoning = next((block.get("text", "") for block in blocks if block["type"] == "reasoning"), "")
        display = reasoning or "Reasoning text was not recorded for this model output."
        draw.text((52, 164), f"{output['detail']['member']} · event #{output['sequence']} · {output['at']}", font=small, fill=MUTED)
        page = int((playback_second - model_start.get(output["sequence"], playback_second)) / 4)
        current, total = draw_excerpt(draw, display, (52, 205), 1085, 29, 11, body, page, 1148, 540)
        draw.text((52, 542), f"Original text page {current}/{total} · full record: source/events.json", font=caption, fill=MUTED)
    else:
        draw.text((52, 205), "Awaiting first recorded model output", font=body, fill=MUTED)
    draw_panel(draw, (30, 590, 1170, 735), "ASSISTANT TEXT · ORIGINAL RECORD", body)
    text_event = None
    for candidate in reversed(events[:bisect_right(event_times, wall)]):
        if candidate["type"] == "agent.output" and any(
                block["type"] == "text" and block.get("text", "").strip()
                for block in candidate["detail"]["message"]["content"]):
            text_event = candidate
            break
    if text_event:
        original = "\n".join(block["text"] for block in text_event["detail"]["message"]["content"]
                             if block["type"] == "text")
        page, total = draw_excerpt(draw, original, (52, 638), 1080, 27, 2, body, 0, 1148, 715)
        draw.text((750, 710), f"event #{text_event['sequence']} · excerpt {page}/{total}", font=caption, fill=MUTED)
    else:
        draw.text((52, 640), "No assistant text has been recorded yet.", font=body, fill=MUTED)
    draw_panel(draw, (30, 750, 590, 1005), "PLAN AND TODO", body)
    plan = latest(events, event_times, wall, "plan.updated")
    if plan:
        items = plan["detail"]["plan"].get("items", [])
        if items:
            item = items[0]
            draw.text((50, 801), f"{item['goal_id']} · {item['status']}", font=small, fill=TEXT)
            draw_excerpt(draw, item["description"], (50, 839), 515, 25, 3, small, 0, 570, 924)
    else:
        draw.text((50, 802), "No plan update yet", font=small, fill=MUTED)
    todos = latest(events, event_times, wall, "agent.todos")
    if todos:
        todo_lines = [f"{item['status']}: {item['content']}" for item in todos["detail"].get("todos", [])]
        current = next((line for line in todo_lines if line.startswith("in_progress:")), todo_lines[-1] if todo_lines else "No TODO items")
        draw_excerpt(draw, current, (50, 940), 515, 23, 2, caption, 0, 570, 994)
    draw_panel(draw, (605, 750, 1170, 1005), "TOOLS AND COMMUNICATION", body)
    tool = None
    message = None
    for candidate in reversed(events[:bisect_right(event_times, wall)]):
        if tool is None and candidate["type"].startswith("tool."):
            tool = candidate
        if message is None and candidate["type"] == "message.delivered":
            message = candidate
        if tool and message:
            break
    if tool:
        draw.text((625, 801), f"#{tool['sequence']} {tool['detail'].get('tool', 'tool')} · {tool['type']}", font=small, fill=TEXT)
        draw_excerpt(draw, json.dumps(tool["detail"].get("result", tool["detail"]), ensure_ascii=False),
                     (625, 838), 520, 23, 3, caption, 0, 1147, 920)
    if message:
        detail = message["detail"]
        draw.text((625, 941), f"Message #{message['sequence']} · {detail['sender'][:12]} → {detail['recipient'][:12]}",
                  font=caption, fill=MUTED)
        objective = detail.get("payload", {}).get("brief", {}).get("objective")
        if objective:
            draw_excerpt(draw, objective, (625, 968), 520, 20, 1, caption, 0, 1147, 998)
    draw_panel(draw, (1185, 115, 1890, 765), "OPERATOR ROLLOUT CAMERAS", body)
    simulation_time = None
    source_sequence = None
    for index, (name, frames, times) in enumerate(cameras):
        position = bisect_right(times, wall) - 1
        y = 164 + index * 198
        if position < 0:
            draw.rectangle((1205, y, 1401, y + 196), fill="#0b1418")
            draw.text((1420, y + 50), "Awaiting frame", font=small, fill=MUTED)
            continue
        frame_wall, file, sequence, sim_time = frames[position]
        if camera_cache[index][0] != file:
            with Image.open(file) as original:
                if original.width != original.height:
                    raise ValueError("Recorded camera aspect ratio does not match this layout.")
                camera_cache[index] = (file, original.convert("RGB").resize((196, 196)))
        image.paste(camera_cache[index][1], (1205, y))
        draw.text((1420, y + 12), name.replace("robot0_", "").replace(".png", ""), font=small, fill=TEXT)
        draw.text((1420, y + 56), f"Frame event #{sequence}", font=small, fill=MUTED)
        draw.text((1420, y + 96), f"Simulator {sim_time:.3f} s", font=small, fill=MUTED)
        if simulation_time is None:
            simulation_time = sim_time
            source_sequence = sequence
    draw.text((1205, 742), "Operator view · agent evidence is recorded separately", font=caption, fill=MUTED)
    draw_panel(draw, (1185, 780, 1890, 1005), "EXECUTION AND FORMAL GT", body)
    execution = latest(events, event_times, wall, "execution.updated")
    if execution:
        state = execution["detail"]["execution"]
        draw.text((1205, 831), f"{state['state']} · {state['control_steps']} controls · {state['policy_calls']} policy calls", font=small, fill=TEXT)
        draw.text((1205, 868), f"{state['raw_sim_steps']} physics steps · stop: {state.get('stop_reason', 'pending')}", font=small, fill=MUTED)
    else:
        draw.text((1205, 831), "Execution not started", font=small, fill=MUTED)
    check = latest(events, event_times, wall, "verification.checked")
    verdict = latest(events, event_times, wall, "verification.completed")
    if check:
        facts = check["detail"].get("facts", [])
        draw.text((1205, 900), ", ".join(f"{fact['check_id']}={str(fact['value']).lower()}" for fact in facts), font=small, fill=FAILURE)
    else:
        draw.text((1205, 900), "Formal native check pending", font=small, fill=MUTED)
    if verdict:
        draw.text((1205, 931), f"Formal verdict: {verdict['detail']['result']['status']}", font=small, fill=FAILURE)
    failure = latest(events, event_times, wall, "run.failed")
    if failure:
        _, error_pages = draw_excerpt(draw, f"Run failed: {source_run['error']}",
                                      (1205, 960), 660, 21, 2, caption, 0, 1872, 1004)
        if error_pages != 1:
            raise ValueError("The final recorded error does not fit the result panel.")
    draw.rounded_rectangle((30, 1020, 1890, 1060), radius=9, fill="#122229", outline=BORDER)
    fraction = (wall - timestamp(events[0]["at"])) / (timestamp(events[-1]["at"]) - timestamp(events[0]["at"]))
    draw.rounded_rectangle((34, 1024, 34 + int(1852 * fraction), 1056), radius=6, fill="#29636b")
    draw.text((48, 1027), f"RECORDED WALL {datetime.fromtimestamp(wall).astimezone().strftime('%H:%M:%S')} · elapsed {(wall - timestamp(events[0]['at'])):.1f} s", font=caption, fill=TEXT)
    draw.text((1165, 1027), f"SIM {simulation_time:.3f} s · frame #{source_sequence}" if simulation_time is not None else "SIM awaiting first frame", font=caption, fill=TEXT)
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--font", type=Path, required=True)
    parser.add_argument("--fps", type=int, default=10)
    parser.add_argument("--wall-speed", type=float, default=4.0)
    arguments = parser.parse_args()
    if arguments.fps <= 0 or arguments.wall_speed <= 0 or not arguments.font.is_file():
        raise ValueError("FPS, wall speed, and font path must be valid.")
    export = arguments.export.resolve()
    run = load_json(export / "source/run.json")
    events = load_json(export / "source/events.json")
    manifest = load_json(export / "manifest.json")
    images = load_json(export / "frames.json")
    if run["id"] != manifest["runId"] or len(events) != manifest["eventCount"] or run["state"] != "failed":
        raise ValueError("The source must be a complete, recorded failed run.")
    event_times = [timestamp(event["at"]) for event in events]
    if event_times != sorted(event_times):
        raise ValueError("Recorded events must have increasing wall timestamps.")
    cameras = camera_source(export, manifest, images)
    segments, duration, start, end = playback_schedule(events, arguments.wall_speed)
    frame_count = int(duration * arguments.fps) + 1
    fonts = tuple(ImageFont.truetype(str(arguments.font), size) for size in (34, 25, 22, 17))
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
               "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(arguments.fps),
               "-i", "pipe:0", "-an", "-c:v", "libx264", "-preset", "veryfast",
               "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(arguments.output)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    camera_cache = [(None, None) for _ in cameras]
    model_start = {}
    for event in events:
        if event["type"] == "agent.output":
            for segment in segments:
                if segment[2] <= timestamp(event["at"]) <= segment[3]:
                    model_start[event["sequence"]] = segment[0] + (timestamp(event["at"]) - segment[2]) / arguments.wall_speed
                    break
    for index in range(frame_count):
        second = min(duration, index / arguments.fps)
        wall, hold = wall_at(segments, second)
        frame = render_frame(export, events, event_times, cameras, wall, hold, second,
                             arguments.wall_speed, fonts, run, camera_cache, model_start)
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg did not complete the recorded video.")
    report = {"runId": run["id"], "runState": run["state"], "runError": run["error"],
              "recordedEventCount": len(events), "recordedFrameCountPerCamera": [len(rows) for _, rows, _ in cameras],
              "fps": arguments.fps, "frameCount": frame_count, "width": WIDTH, "height": HEIGHT,
              "wallStart": events[0]["at"], "wallEnd": events[-1]["at"],
              "wallDurationS": end - start, "wallPlaybackSpeed": arguments.wall_speed,
              "recordedHoldCount": len(recorded_holds(events)), "expectedVideoDurationS": duration,
              "textBoundaryChecks": "passed for every rendered frame",
              "formalVerdict": next(event["detail"]["result"]["status"] for event in events
                                    if event["type"] == "verification.completed"),
              "nativeCheck": next(event["detail"]["facts"] for event in events
                                  if event["type"] == "verification.checked"),
              "agentReasoningEvents": sum(event["type"] == "agent.output" and
                                          any(block["type"] == "reasoning" for block in event["detail"]["message"]["content"])
                                          for event in events)}
    arguments.output.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()

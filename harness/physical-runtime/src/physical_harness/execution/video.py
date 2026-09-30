from fractions import Fraction
from io import BytesIO
import json
import math
from pathlib import Path
import re

import av
from PIL import Image

from physical_harness.environments import NativeFrame


class SimulationVideoRecorder:
    def __init__(self, directory: Path, execution_id: str):
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}", execution_id):
            raise ValueError("Invalid recording execution identity.")
        self.directory = directory / execution_id
        self.directory.mkdir(parents=True, exist_ok=False)
        self.journal = (self.directory / "frames.jsonl").open("x", encoding="utf-8")
        self.cameras = {}
        self.origin = None
        self.previous_time = -1.0
        self.frames = 0
        self.closed = False

    def append(self, frame: NativeFrame, segment: dict):
        if self.closed or not math.isfinite(frame.simulation_time_s) or frame.simulation_time_s <= self.previous_time:
            raise ValueError("Recording requires strictly increasing native simulation timestamps.")
        if self.cameras and set(frame.images) != set(self.cameras):
            raise ValueError("Native recording camera channels changed.")
        if self.origin is None:
            self.origin = frame.simulation_time_s
        pts = round((frame.simulation_time_s - self.origin) * 1_000_000)
        for camera, encoded in frame.images.items():
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}", camera):
                raise ValueError("Invalid native recording camera name.")
            with Image.open(BytesIO(encoded)) as source:
                image = source.convert("RGB")
            if camera not in self.cameras:
                container = av.open(str(self.directory / f"{camera}.mp4"), "w", options={"movflags": "+faststart"})
                stream = container.add_stream("libx264", rate=30)
                stream.width, stream.height = image.size
                stream.pix_fmt = "yuv420p"
                stream.time_base = stream.codec_context.time_base = Fraction(1, 1_000_000)
                stream.options = {"crf": "20", "preset": "fast"}
                self.cameras[camera] = container, stream
            container, stream = self.cameras[camera]
            if image.size != (stream.width, stream.height):
                raise ValueError("Native recording camera dimensions changed.")
            video_frame = av.VideoFrame.from_image(image)
            video_frame.pts, video_frame.time_base = pts, Fraction(1, 1_000_000)
            for packet in stream.encode(video_frame):
                container.mux(packet)
        self.journal.write(json.dumps({"execution_id": segment["execution_id"], "task_scope": segment["task_scope"],
                                       "policy_request_id": segment["request_id"], "segment_id": segment["segment_id"],
                                       "observation_id": frame.observation_id, "observed_at": frame.observed_at,
                                       "native_step_index": frame.native_step_index,
                                       "simulation_time_s": frame.simulation_time_s, "pts_us": pts}) + "\n")
        self.journal.flush()
        self.previous_time = frame.simulation_time_s
        self.frames += 1

    def close(self):
        if self.closed:
            return
        for container, stream in self.cameras.values():
            for packet in stream.encode():
                container.mux(packet)
            container.close()
        self.journal.close()
        (self.directory / "manifest.json").write_text(json.dumps({
            "frames": self.frames, "cameras": sorted(self.cameras),
            "timeline": "native simulation time", "origin_simulation_time_s": self.origin,
            "last_simulation_time_s": self.previous_time,
        }, indent=2) + "\n")
        self.closed = True

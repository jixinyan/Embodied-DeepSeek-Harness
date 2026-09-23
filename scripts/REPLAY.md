# Recorded run replay export

`export-run-replay.js` reads a terminal simulation run through the console HTTP
API and writes a local, offline replay. It fetches the run projection and every
page of published history, then checks the sequence and confirms the run remained
unchanged during the export. It downloads agent-visible camera evidence and
recorded simulation frames through their run-scoped image routes. Each downloaded
image is checked against its recorded byte count and SHA-256 attachment identity.

The exporter needs the workspace dependencies, Google Chrome for the installed
Mermaid renderer, and `ffmpeg` with `libx264` on `PATH`:

```sh
node scripts/export-run-replay.js \
  --base-url http://127.0.0.1:4318 \
  --run-id <terminal-run-id> \
  --output .local/work/replay-<terminal-run-id>
```

When a matching policy service log is available locally, add
`--policy-log /path/to/policy-service.log`. The exporter copies the original log,
checks that its inference request IDs and task identity match the recorded
simulation frames, and adds the service source revision, checkpoint revision,
weight hashes, and log hash to the manifest. A mismatched log stops the export.

The optional `--camera` value selects one recorded simulation camera by its full
image name, such as `robot0_agentview_left.png`. Without it, the exporter writes
one video for each camera and execution with available frames. Every frame keeps
its original policy request, segment and native step identities in `frames.json`
and the video mapping. `ffmpeg` uses the recorded simulator-time interval between
successive frames. The final frame repeats the last interval, or uses a
documented 0.05-second display interval when the video contains one frame.
The replay manifest retains the actual simulator timestamp and event sequence for
every frame; the HTML video link resolves the current playback position to that
recorded event and its wall-clock timestamp. A video is withheld when any source
frame or simulator timestamp in its group is unavailable.
The encoded video repeats its final recorded frame once to hold that final
display interval. `recordedFrameCount` and `encodedFrameCount` distinguish the
source frames from this playback frame.

The output includes `timeline.html`, `flow.mmd`, rendered `flow.svg`,
`manifest.json`, `frames.json`, source `run.json` and `events.json`, the original
PNG frames and observations, and MP4 videos when recorded frames permit them.
The HTML timeline presents all published events, recorded details and available
images in sequence. Diagram nodes link to those events. The manifest preserves
the final run state and verdicts. It lists missing records and unknown provenance
explicitly; a cancelled or failed run remains cancelled or failed. Source run
revision and seed are reported as unavailable unless the authoritative run
records supply them. The checkpoint revision and policy log are unavailable
when no matching policy log is supplied.

export function replayDocument(runId, payload) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recorded run ${runId}</title><link rel="stylesheet" href="replay-dashboard.css"></head>
<body><header class="page-header"><div><p class="eyebrow">Recorded physical run</p><h1 id="title"></h1><p id="run-summary"></p></div>
<nav><a href="flow.svg">Role and event flow</a><a href="source/events.json">Original events</a><a href="frames.json">Frame records</a><a href="manifest.json">Manifest</a></nav></header>
<section class="transport" aria-label="Replay controls"><button id="play" type="button">Play</button><label>Speed <select id="speed"><option value="1">1×</option><option value="5" selected>5×</option><option value="20">20×</option></select></label>
<input id="cursor" type="range" min="0" step="1" aria-label="Wall-clock position"><div class="clock"><strong id="wall-clock"></strong><span id="elapsed"></span><span id="sim-clock"></span></div></section>
<main><div class="top-grid"><section class="sensor-panel panel"><div class="section-heading"><h2>Recorded cameras</h2><span id="frame-summary"></span></div><div id="cameras" class="cameras"></div><p class="note">Playback follows recorded wall time. Camera video timestamps follow simulator time, which pauses during model inference.</p></section>
<section class="insight-grid"><article class="panel"><h2>Agents and model output</h2><div id="agents"></div><div id="model-output"></div></article>
<article class="panel"><h2>Plan and TODO</h2><div id="plan"></div><div id="todos"></div></article>
<article class="panel"><h2>Tools and communication</h2><div id="tools"></div><div id="messages"></div></article>
<article class="panel"><h2>Execution and verification</h2><div id="execution"></div><div id="verification"></div></article></section></div>
<section class="panel"><div class="section-heading"><h2>Recorded events</h2><span id="event-count"></span></div><div class="event-controls"><label>Category <select id="event-filter"><option value="milestones">Key events</option><option value="all">All events</option><option value="agent">Agent</option><option value="tool">Tools</option><option value="execution">Execution</option><option value="verification">Verification</option><option value="frame">Frames</option></select></label><label>Search <input id="event-search" type="search" placeholder="Event type, role, or tool"></label></div><div id="events"></div></section>
<section class="panel"><h2>Record availability</h2><div id="availability"></div></section></main>
<script type="application/json" id="record">${payload}</script><script src="replay-dashboard.js" defer></script></body></html>`;
}

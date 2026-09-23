const identity = (value) =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$(?![\s\S])/.test(value);

export function sensorImageSources(runId, frame) {
  if (!frame || frame.evidence.visibility !== 'agent' || !frame.images?.length) return [];
  if (
    typeof runId !== 'string' ||
    !/^[A-Za-z0-9-]{1,128}$(?![\s\S])/.test(runId) ||
    !identity(frame.evidence.id)
  )
    throw new Error('Invalid sensor image scope.');
  if (frame.images.length > 16) throw new Error('Sensor view exceeds the image limit.');
  return frame.images.map((image, index) => {
    if (!identity(image.attachmentId)) throw new Error('Invalid sensor image identity.');
    return {
      src: `/api/runs/${runId}/evidence/${encodeURIComponent(frame.evidence.id)}/images/${encodeURIComponent(image.attachmentId)}`,
      label: image.name || `View ${index + 1}`,
      width: image.width,
      height: image.height,
    };
  });
}

const views = new WeakMap();

function viewFor(container) {
  let view = views.get(container);
  if (view) return view;
  const metrics = container.ownerDocument.createElement('p');
  metrics.className = 'sensor-performance';
  metrics.setAttribute('role', 'status');
  view = {
    runId: null,
    desiredKey: null,
    displayedKey: null,
    generation: 0,
    controller: null,
    figures: [],
    urls: [],
    displayedAt: [],
    metrics,
  };
  views.set(container, view);
  return view;
}

function release(urls, view) {
  for (const url of urls) view.URL.revokeObjectURL(url);
}

function clear(container, view) {
  view.generation++;
  view.controller?.abort();
  view.controller = null;
  release(view.urls, view);
  view.urls = [];
  view.figures = [];
  view.displayedAt = [];
  view.displayedKey = null;
  view.desiredKey = null;
  container.replaceChildren();
  delete container.dataset.images;
  delete container.dataset.displayedSequence;
  delete container.dataset.displayedEvidenceId;
  delete container.dataset.requestToDecodedMs;
  delete container.dataset.captureToDecodedMs;
  delete container.dataset.displayFps;
}

function figureFor(view, index, doc) {
  if (view.figures[index]) return view.figures[index];
  const figure = doc.createElement('figure');
  figure.className = 'sensor-image';
  const image = doc.createElement('img');
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  const caption = doc.createElement('figcaption');
  const label = doc.createElement('span');
  const status = doc.createElement('span');
  status.setAttribute('role', 'status');
  caption.append(label, status);
  figure.append(image, caption);
  view.figures[index] = { figure, image, label, status };
  return view.figures[index];
}

async function decodeSource(source, view, signal) {
  const response = await view.fetch(source.src, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Camera image request failed (${response.status}).`);
  const blob = await response.blob();
  const url = view.URL.createObjectURL(blob);
  const image = view.document.createElement('img');
  image.src = url;
  try {
    await image.decode();
    if (image.naturalWidth !== source.width || image.naturalHeight !== source.height)
      throw new Error('Decoded camera dimensions differ from the recorded evidence.');
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  } catch (failure) {
    view.URL.revokeObjectURL(url);
    throw failure;
  }
}

async function publish(container, view, sources, frame, key, generation, controller, onDisplayed) {
  const startedAt = view.performance.now();
  const settled = await Promise.allSettled(
    sources.map((source) => decodeSource(source, view, controller.signal)),
  );
  const loaded = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  if (generation !== view.generation) {
    release(
      loaded.map((result) => result.url),
      view,
    );
    return;
  }
  view.controller = null;
  const failure = settled.find((result) => result.status === 'rejected');
  if (failure) {
    release(
      loaded.map((result) => result.url),
      view,
    );
    view.metrics.textContent = `Camera update unavailable · ${failure.reason.message}`;
    container.dataset.imageError = failure.reason.message;
    if (!view.figures.length) container.replaceChildren(view.metrics);
    return;
  }
  const decodedAt = view.performance.now();
  const requestToDecodedMs = decodedAt - startedAt;
  const capturedAt = Date.parse(frame.evidence.observed_at);
  const captureToDecodedMs = Number.isFinite(capturedAt) ? Date.now() - capturedAt : null;
  view.requestAnimationFrame(() => {
    if (generation !== view.generation) {
      release(
        loaded.map((result) => result.url),
        view,
      );
      return;
    }
    const previousUrls = view.urls;
    const figures = sources.map((source, index) => {
      const item = figureFor(view, index, view.document);
      const decoded = loaded[index];
      item.image.src = decoded.url;
      item.image.alt = `${source.label} · observation ${frame.sequence}`;
      item.image.width = decoded.width;
      item.image.height = decoded.height;
      item.label.textContent = source.label;
      item.status.textContent = `${decoded.width} × ${decoded.height}`;
      item.figure.dataset.state = 'ready';
      return item.figure;
    });
    if (view.figures.length > figures.length) view.figures.length = figures.length;
    if (
      container.childElementCount !== figures.length + 1 ||
      figures.some((figure, index) => container.children[index] !== figure)
    )
      container.replaceChildren(...figures, view.metrics);
    view.urls = loaded.map((result) => result.url);
    view.displayedKey = key;
    container.dataset.images = key;
    container.dataset.displayedSequence = String(frame.sequence);
    container.dataset.displayedEvidenceId = frame.evidence.id;
    container.dataset.requestToDecodedMs = requestToDecodedMs.toFixed(1);
    if (captureToDecodedMs !== null)
      container.dataset.captureToDecodedMs = String(captureToDecodedMs);
    else delete container.dataset.captureToDecodedMs;
    delete container.dataset.imageError;
    const publishedAt = view.performance.now();
    view.displayedAt.push(publishedAt);
    view.displayedAt = view.displayedAt.filter((time) => publishedAt - time <= 5000);
    const fps =
      view.displayedAt.length > 1
        ? ((view.displayedAt.length - 1) * 1000) / (publishedAt - view.displayedAt[0])
        : null;
    if (fps !== null) container.dataset.displayFps = fps.toFixed(1);
    else delete container.dataset.displayFps;
    view.metrics.textContent = `Image load ${requestToDecodedMs.toFixed(0)} ms · ${
      fps === null ? 'Measuring display rate' : `Display ${fps.toFixed(1)} frames/s`
    }${captureToDecodedMs === null ? '' : ` · Camera age about ${(captureToDecodedMs / 1000).toFixed(1)} s`}`;
    view.metrics.title = 'Camera age compares the capture host clock with this browser clock.';
    container.hidden = false;
    onDisplayed(frame);
    view.requestAnimationFrame(() => release(previousUrls, view));
  });
}

export function renderSensorImages(container, runId, frame, onDisplayed = () => {}) {
  const sources = sensorImageSources(runId, frame);
  const key = JSON.stringify(sources);
  const view = viewFor(container);
  view.URL = container.ownerDocument.defaultView.URL;
  view.fetch = container.ownerDocument.defaultView.fetch.bind(container.ownerDocument.defaultView);
  view.performance = container.ownerDocument.defaultView.performance;
  view.requestAnimationFrame = container.ownerDocument.defaultView.requestAnimationFrame.bind(
    container.ownerDocument.defaultView,
  );
  view.document = container.ownerDocument;
  if (view.runId !== runId) {
    clear(container, view);
    view.runId = runId;
  }
  if (!sources.length) {
    clear(container, view);
    container.hidden = true;
    return 0;
  }
  if (key === view.desiredKey) return sources.length;
  view.generation++;
  view.controller?.abort();
  view.controller = null;
  view.desiredKey = key;
  if (key === view.displayedKey) return sources.length;
  const controller = new AbortController();
  view.controller = controller;
  container.hidden = false;
  if (!view.figures.length) {
    view.metrics.textContent = 'Loading camera images…';
    container.replaceChildren(view.metrics);
  }
  void publish(container, view, sources, frame, key, view.generation, controller, onDisplayed);
  return sources.length;
}

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

export function renderSensorImages(container, runId, frame) {
  const sources = sensorImageSources(runId, frame);
  const key = JSON.stringify(sources);
  container.hidden = sources.length === 0;
  if (container.dataset.images === key) return sources.length;
  const doc = container.ownerDocument;
  const figures = sources.map((source) => {
    const figure = doc.createElement('figure');
    figure.className = 'sensor-image';
    const image = doc.createElement('img');
    image.alt = `${source.label} · observation ${frame.sequence}`;
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.width = source.width;
    image.height = source.height;
    const caption = doc.createElement('figcaption');
    const label = doc.createElement('span');
    label.textContent = source.label;
    const status = doc.createElement('span');
    status.textContent = 'Loading image';
    status.setAttribute('role', 'status');
    image.onload = () => {
      status.textContent = `${image.naturalWidth} × ${image.naturalHeight}`;
      figure.dataset.state = 'ready';
    };
    image.onerror = () => {
      status.textContent = 'Image unavailable · inspect evidence';
      figure.dataset.state = 'error';
    };
    image.src = source.src;
    caption.append(label, status);
    figure.append(image, caption);
    return figure;
  });
  container.replaceChildren(...figures);
  container.dataset.images = key;
  return sources.length;
}

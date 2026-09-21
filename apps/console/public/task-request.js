const key = 'edh.pending-task-request';

function pending() {
  const stored = sessionStorage.getItem(key);
  if (stored === null) return null;
  const record = JSON.parse(stored);
  if (
    !record ||
    record.version !== 1 ||
    typeof record.signature !== 'string' ||
    typeof record.requestId !== 'string' ||
    !/^[A-Za-z0-9-]{8,80}$/.test(record.requestId)
  )
    throw new Error('Stored task request identity is invalid.');
  return record;
}

export function taskRequest(target, input, deploymentDigest) {
  const signature = JSON.stringify([deploymentDigest, target, input]);
  const previous = pending();
  const record =
    previous?.signature === signature
      ? previous
      : { version: 1, signature, requestId: crypto.randomUUID() };
  sessionStorage.setItem(key, JSON.stringify(record));
  return { ...input, requestId: record.requestId };
}

export function completeTaskRequest(requestId) {
  if (pending()?.requestId === requestId) sessionStorage.removeItem(key);
}

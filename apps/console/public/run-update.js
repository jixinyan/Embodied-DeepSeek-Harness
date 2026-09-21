export const runUpdateProtocol = 'edh.run-update.v1';
export const maxEventBatch = 128;
export const maxEventBatchBytes = 256 * 1024;

export function runEventCursor(value, total) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error('Invalid run event cursor.');
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor) || cursor > total)
    throw new Error('Run event cursor exceeds published history.');
  return cursor;
}

export function createRunUpdate(state, afterSequence) {
  const total = state.events.length;
  if (!Number.isSafeInteger(afterSequence)) throw new Error('Invalid run event cursor.');
  runEventCursor(String(afterSequence), total);
  const events = [];
  let bytes = 0;
  const encoder = new TextEncoder();
  for (let index = afterSequence; index < Math.min(afterSequence + maxEventBatch, total); index++) {
    const event = state.events[index];
    if (event.sequence !== index + 1) throw new Error('Run history is not contiguous.');
    const size = encoder.encode(JSON.stringify(event)).byteLength;
    if (events.length && bytes + size > maxEventBatchBytes) break;
    events.push(event);
    bytes += size;
  }
  const throughSequence = afterSequence + events.length;
  const { events: omitted, ...projection } = state;
  return {
    protocol: runUpdateProtocol,
    runId: state.id,
    afterSequence,
    throughSequence,
    eventTotal: total,
    events,
    projection: throughSequence === total ? { ...projection, eventCount: total } : null,
  };
}

export function mergeRunUpdate(current, update) {
  if (
    !update ||
    update.protocol !== runUpdateProtocol ||
    update.runId !== current.id ||
    update.afterSequence !== current.events.length ||
    !Number.isSafeInteger(update.throughSequence) ||
    !Number.isSafeInteger(update.eventTotal) ||
    update.eventTotal < update.throughSequence ||
    update.eventTotal < (current.eventCount ?? current.events.length) ||
    !Array.isArray(update.events) ||
    update.events.length > maxEventBatch ||
    update.throughSequence !== update.afterSequence + update.events.length
  )
    throw new Error('Invalid or discontinuous run update.');
  for (const [index, event] of update.events.entries())
    if (!event || event.sequence !== update.afterSequence + index + 1)
      throw new Error('Run update contains an invalid event sequence.');
  if (update.projection === null) {
    if (!update.events.length || update.throughSequence >= update.eventTotal)
      throw new Error('Incomplete run update has no remaining events.');
  } else if (
    !update.projection ||
    typeof update.projection !== 'object' ||
    Array.isArray(update.projection) ||
    update.projection.id !== current.id ||
    Object.hasOwn(update.projection, 'events') ||
    update.projection.eventCount !== update.eventTotal ||
    update.throughSequence !== update.eventTotal
  )
    throw new Error('Run projection does not match its event boundary.');
  const events = update.events.length ? [...current.events, ...update.events] : current.events;
  return { ...(update.projection ?? current), eventCount: update.eventTotal, events };
}

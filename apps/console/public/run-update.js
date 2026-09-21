export const runUpdateProtocol = 'edh.run-update.v1';
export const maxEventBatch = 128;
export const maxEventBatchBytes = 256 * 1024;
export const maxRetainedEvents = 500;
export const maxRetainedEventBytes = 2 * 1024 * 1024;

export function receivedRunSequence(state) {
  const offset = state.eventOffset ?? 0;
  const cursor = offset + state.events.length;
  const total = state.eventCount ?? cursor;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(cursor) ||
    !Number.isSafeInteger(total) ||
    cursor > total ||
    state.events.some((event, index) => event.sequence !== offset + index + 1)
  )
    throw new Error('Invalid retained run history.');
  return cursor;
}

export function retainRunEvents(state) {
  const cursor = receivedRunSequence(state);
  const encoder = new TextEncoder();
  let start = state.events.length;
  let bytes = 0;
  while (start > 0 && state.events.length - start < maxRetainedEvents) {
    const size = encoder.encode(JSON.stringify(state.events[start - 1])).byteLength;
    if (start < state.events.length && bytes + size > maxRetainedEventBytes) break;
    bytes += size;
    start--;
  }
  const events = start ? state.events.slice(start) : state.events;
  return { ...state, eventOffset: cursor - events.length, events };
}

export function runEventCursor(value, total) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error('Invalid run event cursor.');
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor) || cursor > total)
    throw new Error('Run event cursor exceeds published history.');
  return cursor;
}

export function createRunUpdate(state, afterSequence) {
  const offset = state.eventOffset ?? 0;
  const total = state.eventOffset === undefined ? state.events.length : state.eventCount;
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(total) ||
    offset < 0 ||
    offset > afterSequence ||
    offset + state.events.length > total
  )
    throw new Error('Invalid run history window.');
  if (!Number.isSafeInteger(afterSequence)) throw new Error('Invalid run event cursor.');
  runEventCursor(String(afterSequence), total);
  const events = [];
  let bytes = 0;
  const encoder = new TextEncoder();
  const end = Math.min(afterSequence + maxEventBatch, offset + state.events.length, total);
  for (let index = afterSequence; index < end; index++) {
    const event = state.events[index - offset];
    if (event.sequence !== index + 1) throw new Error('Run history is not contiguous.');
    const size = encoder.encode(JSON.stringify(event)).byteLength;
    if (events.length && bytes + size > maxEventBatchBytes) break;
    events.push(event);
    bytes += size;
  }
  const throughSequence = afterSequence + events.length;
  if (!events.length && throughSequence < total) throw new Error('Incomplete run history window.');
  const { events: omitted, eventOffset: omittedOffset, ...projection } = state;
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

export function appendRunHistory(current, page) {
  if (!page || page.eventTotal !== current.eventCount)
    throw new Error('Run history page changed the selected boundary.');
  const { events, eventOffset, ...projection } = current;
  return mergeRunUpdate(current, {
    ...page,
    protocol: runUpdateProtocol,
    projection: page.throughSequence === current.eventCount ? projection : null,
  });
}

export function mergeRunUpdate(current, update) {
  if (
    !update ||
    update.protocol !== runUpdateProtocol ||
    update.runId !== current.id ||
    update.afterSequence !== receivedRunSequence(current) ||
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
    Object.hasOwn(update.projection, 'eventOffset') ||
    update.projection.eventCount !== update.eventTotal ||
    update.throughSequence !== update.eventTotal
  )
    throw new Error('Run projection does not match its event boundary.');
  const events = update.events.length ? [...current.events, ...update.events] : current.events;
  return {
    ...(update.projection ?? current),
    ...(current.eventOffset === undefined ? {} : { eventOffset: current.eventOffset }),
    eventCount: update.eventTotal,
    events,
  };
}

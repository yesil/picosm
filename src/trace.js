// Opt-in tracing of Lit view updates in the Chrome trace event format: which store asked which
// view to update, what each update cost, and per view how often it updated and for how long.
// Records names, counts and timings, never values.

const PROCESS_ID = 1;
const THREAD_ID = 1;
const DEFAULT_MAX_EVENTS = 100_000;
const START_MARK = 'picosm trace start';

/**
 * The trace being recorded, or null. Instrumented code checks it before doing any tracing work,
 * so a page that never starts a trace only pays that check.
 */
export let activeTrace = null;

// Unique across traces, so an update never names a request recorded by another trace
let nextEventId = 1;

/**
 * Starts recording a trace.
 * @param {{maxEvents?: number}} [options] - maxEvents bounds the recorded events (default 100000);
 *   events past it are counted in otherData.droppedEventCount instead of recorded
 */
export function startTrace(options = {}) {
  if (activeTrace !== null) {
    throw new Error(
      'picosm: startTrace() called while a trace is already recording',
    );
  }
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  if (!Number.isInteger(maxEvents) || maxEvents < 1) {
    throw new TypeError(
      'picosm: startTrace() option "maxEvents" must be a positive integer',
    );
  }
  // The mark lets tools line this trace up with a browser trace recorded at the same time
  const mark = performance.mark(START_MARK);
  activeTrace = {
    maxEvents,
    startTime: mark.startTime,
    events: [],
    droppedEventCount: 0,
    // Per view tag name: {updates, time}, counting the updates past maxEvents too
    views: new Map(),
    instanceNames: new WeakMap(),
    instanceCounts: new Map(),
  };
}

/**
 * Stops recording and returns the trace, ready for JSON.stringify.
 * @returns {{traceEvents: object[], displayTimeUnit: string, otherData: object}}
 */
export function stopTrace() {
  if (activeTrace === null) {
    throw new Error('picosm: stopTrace() called with no trace recording');
  }
  const trace = activeTrace;
  activeTrace = null;
  const endTime = performance.now();
  return {
    traceEvents: [
      metadataEvent('process_name', 'picosm'),
      metadataEvent('thread_name', 'picosm'),
      ...trace.events,
    ],
    displayTimeUnit: 'ms',
    otherData: {
      startTime: trace.startTime,
      endTime,
      droppedEventCount: trace.droppedEventCount,
      views: viewSummary(trace.views, endTime - trace.startTime),
    },
  };
}

// Rounds to 3 decimals: the microsecond for milliseconds
const round = (value) => Math.round(value * 1000) / 1000;

// The views with the most time spent in updates first
function viewSummary(views, durationMs) {
  const summary = {};
  const sorted = [...views].sort(([, a], [, b]) => b.time - a.time);
  for (const [view, { updates, time }] of sorted) {
    summary[view] = {
      updates,
      // A trace shorter than the browser's clock resolution lasts 0 ms and has no rate
      updatesPerSecond:
        durationMs > 0 ? round(updates / (durationMs / 1000)) : null,
      totalMs: round(time),
    };
  }
  return summary;
}

function metadataEvent(name, value) {
  return {
    name,
    ph: 'M',
    pid: PROCESS_ID,
    tid: THREAD_ID,
    args: { name: value },
  };
}

// Numbers instances per class in order of first appearance: Cart#1, Cart#2
function instanceName(target) {
  let name = activeTrace.instanceNames.get(target);
  if (name === undefined) {
    const base = target.constructor?.name || 'Object';
    const count = (activeTrace.instanceCounts.get(base) ?? 0) + 1;
    activeTrace.instanceCounts.set(base, count);
    name = `${base}#${count}`;
    activeTrace.instanceNames.set(target, name);
  }
  return name;
}

/**
 * Starts timing a span.
 * @returns {object|null} The open span, or null when no trace is recording
 */
export function beginSpan() {
  if (activeTrace === null) return null;
  return { trace: activeTrace, start: performance.now(), id: nextEventId++ };
}

/**
 * Records a span; called only while the span's trace is still recording.
 * @returns {number} The span's duration in milliseconds
 */
function recordSpan(span, name, args) {
  const duration = performance.now() - span.start;
  const event = {
    name,
    cat: 'picosm',
    ph: 'X',
    ts: span.start * 1000,
    dur: duration * 1000,
    pid: PROCESS_ID,
    tid: THREAD_ID,
    args: { id: span.id, ...args },
  };
  if (activeTrace.events.length < activeTrace.maxEvents)
    activeTrace.events.push(event);
  else activeTrace.droppedEventCount += 1;
  return duration;
}

/** Records a store change asking a Lit view to update. */
export function endViewRequest(span, host, store, property, throttleMs) {
  if (span.trace !== activeTrace) return;
  recordSpan(span, `<${host.localName}> update requested`, {
    kind: 'view-request',
    view: host.localName,
    property,
    store: instanceName(store),
    throttleMs: throttleMs ?? 0,
  });
}

/**
 * Starts the span of a Lit update.
 * @param {number[]} causes - Ids of the update requests this update answers; none: a property change
 */
export function beginViewUpdate(causes) {
  const span = beginSpan();
  if (span !== null) span.causes = causes;
  return span;
}

export function endViewUpdate(span, host) {
  if (span.trace !== activeTrace) return;
  const view = host.localName;
  const duration = recordSpan(span, `<${view}> update`, {
    kind: 'view-update',
    view,
    firstUpdate: !host.hasUpdated,
    causes: span.causes,
  });
  const total = activeTrace.views.get(view);
  if (total === undefined)
    activeTrace.views.set(view, { updates: 1, time: duration });
  else {
    total.updates += 1;
    total.time += duration;
  }
}

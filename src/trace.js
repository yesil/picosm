// Opt-in performance tracing in the Chrome trace event format. A trace records names, counts and
// timings of actions, notifications, observers and Lit updates, never arguments, values or state.

const PROCESS_ID = 1;
const THREAD_ID = 1;
const CATEGORY = 'picosm';
const DEFAULT_MAX_EVENTS = 100_000;
const START_MARK = 'picosm trace start';

/**
 * The trace being recorded, or null. Instrumented code checks it before doing any tracing work,
 * so a page that never starts a trace only pays that check.
 */
export let activeTrace = null;

// Unique across traces, so a link recorded during one trace never points into another
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
    instanceNames: new WeakMap(),
    instanceCounts: new Map(),
    // target -> ids of the actions and forwards that queued its pending notification
    queuedCauses: new WeakMap(),
    // Ids of the open actions and forwards, innermost last
    openCauses: [],
    // Id of the notification whose observers are being called
    notification: null,
    computedHits: new Map(),
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
  return {
    traceEvents: [
      metadataEvent('process_name', 'picosm'),
      metadataEvent('thread_name', 'picosm'),
      ...trace.events,
    ],
    displayTimeUnit: 'ms',
    otherData: {
      startTime: trace.startTime,
      endTime: performance.now(),
      droppedEventCount: trace.droppedEventCount,
      computedHits: Object.fromEntries(trace.computedHits),
    },
  };
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

function record(trace, event) {
  if (trace.events.length < trace.maxEvents) trace.events.push(event);
  else trace.droppedEventCount += 1;
}

function className(target) {
  return target.constructor?.name || 'Object';
}

function functionName(callback) {
  return callback.name || '(anonymous)';
}

// Numbers instances per class in order of first appearance: EditorStore#1, EditorStore#2
function instanceName(target) {
  let name = activeTrace.instanceNames.get(target);
  if (name === undefined) {
    const base = className(target);
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
  return {
    trace: activeTrace,
    start: performance.now(),
    id: nextEventId++,
    isCause: false,
  };
}

/**
 * Starts a span that notifications queued before it ends name as their cause.
 * @returns {object|null} The open span, or null when no trace is recording
 */
export function beginCause() {
  const span = beginSpan();
  if (span !== null) {
    span.isCause = true;
    span.trace.openCauses.push(span.id);
  }
  return span;
}

// Closes the span and tells whether to record it: not when its trace has stopped since
function finish(span) {
  const { trace } = span;
  if (span.isCause)
    trace.openCauses.splice(trace.openCauses.lastIndexOf(span.id), 1);
  return trace === activeTrace;
}

function recordSpan(span, name, args) {
  record(span.trace, {
    name,
    cat: CATEGORY,
    ph: 'X',
    ts: span.start * 1000,
    dur: (performance.now() - span.start) * 1000,
    pid: PROCESS_ID,
    tid: THREAD_ID,
    args: { id: span.id, ...args },
  });
}

function recordAsync(trace, phase, name, id, args) {
  record(trace, {
    name,
    cat: CATEGORY,
    ph: phase,
    id,
    ts: performance.now() * 1000,
    pid: PROCESS_ID,
    tid: THREAD_ID,
    args,
  });
}

/**
 * Records the synchronous part of an action.
 * @param {'returned'|'threw'|'pending'} outcome - pending: it returned a Promise
 */
export function endAction(span, target, action, outcome) {
  if (!finish(span)) return;
  recordSpan(span, `${className(target)}.${action}`, {
    kind: 'action',
    instance: instanceName(target),
    outcome,
  });
}

/**
 * Traces an async action until its Promise settles, and returns its settle step traced.
 * @param {object} span - The action's open span
 * @param {Promise} response - The Promise the action returned
 * @param {Function} settle - Resets computed values and notifies observers
 */
export function traceAsyncAction(span, target, action, response, settle) {
  const name = `${className(target)}.${action}`;
  const { trace } = span;
  recordAsync(trace, 'b', name, span.id, {});
  let outcome = 'resolved';
  // Registered before the action's finally(), so the outcome is known when it runs
  response.then(undefined, () => {
    outcome = 'rejected';
  });
  return () => {
    const settled = beginCause();
    settle();
    if (settled === null || !finish(settled)) return;
    recordSpan(settled, `${name} settled`, {
      kind: 'action-settled',
      action: span.id,
      instance: instanceName(target),
      outcome,
    });
    if (trace === activeTrace)
      recordAsync(trace, 'e', name, span.id, { outcome });
  };
}

/** Notes the open action or forward that queued a notification for target. */
export function traceNotificationQueued(target) {
  const cause = activeTrace.openCauses.at(-1);
  if (cause === undefined) return;
  const causes = activeTrace.queuedCauses.get(target);
  if (causes) causes.push(cause);
  else activeTrace.queuedCauses.set(target, [cause]);
}

/** Starts the span of a notification being delivered to target's observers. */
export function beginNotification(target) {
  const span = beginSpan();
  if (span === null) return null;
  span.causes = span.trace.queuedCauses.get(target) ?? [];
  span.trace.queuedCauses.delete(target);
  span.previousNotification = span.trace.notification;
  span.trace.notification = span.id;
  return span;
}

export function endNotification(span, target, observers) {
  span.trace.notification = span.previousNotification;
  if (!finish(span)) return;
  recordSpan(span, `${className(target)} notification`, {
    kind: 'notification',
    instance: instanceName(target),
    observers,
    causes: span.causes,
  });
}

export function endComputed(span, target, getter) {
  if (!finish(span)) return;
  recordSpan(span, `${className(target)}.${getter} computed`, {
    kind: 'computed',
    instance: instanceName(target),
  });
}

/** Counts a computed value read from its cache. */
export function traceComputedHit(target, getter) {
  const key = `${className(target)}.${getter}`;
  activeTrace.computedHits.set(
    key,
    (activeTrace.computedHits.get(key) ?? 0) + 1,
  );
}

export function endMessage(span, target, subscribers) {
  if (!finish(span)) return;
  recordSpan(span, `${className(target)} message`, {
    kind: 'message',
    instance: instanceName(target),
    subscribers,
  });
}

export function endTrack(span, source, target) {
  if (!finish(span)) return;
  recordSpan(span, `track ${className(source)} → ${className(target)}`, {
    kind: 'track',
    source: instanceName(source),
    target: instanceName(target),
    notification: span.trace.notification,
  });
}

/** @param {'changed'|'unchanged'|'skipped'} result - skipped: the selector returned [] */
export function endReaction(span, targets, selector, effect, result) {
  if (!finish(span)) return;
  recordSpan(span, `reaction ${functionName(effect)}`, {
    kind: 'reaction',
    targets: targets.map(instanceName),
    selector: functionName(selector),
    effect: functionName(effect),
    result,
    notification: span.trace.notification,
  });
}

/** Records a store change asking a Lit view to update. */
export function endViewRequest(span, host, store, property, throttleMs) {
  if (!finish(span)) return;
  recordSpan(span, `<${host.localName}> update requested`, {
    kind: 'view-request',
    view: host.localName,
    property,
    store: instanceName(store),
    notification: span.trace.notification,
    throttleMs: throttleMs ?? 0,
  });
}

/**
 * Starts the span of a Lit update, counting the DOM mutations it makes in its render root.
 * @param {number[]} causes - Ids of the update requests this update answers; none: a property change
 */
export function beginViewUpdate(host, causes) {
  const span = beginSpan();
  if (span === null) return null;
  span.causes = causes;
  // Records are read synchronously with takeRecords(), the callback never needs to run
  span.mutations = new MutationObserver(() => {});
  span.mutations.observe(host.renderRoot, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  return span;
}

export function endViewUpdate(span, host) {
  const domMutations = span.mutations.takeRecords().length;
  span.mutations.disconnect();
  if (!finish(span)) return;
  recordSpan(span, `<${host.localName}> update`, {
    kind: 'view-update',
    view: host.localName,
    firstUpdate: !host.hasUpdated,
    causes: span.causes,
    domMutations,
  });
}

/** Drops an update that never finished: it threw, or its element disconnected. */
export function cancelViewUpdate(span) {
  span.mutations.disconnect();
  finish(span);
}

/** @param {string} step - The router step, e.g. write, onRoute or sync */
export function endRouterStep(span, step, details) {
  if (!finish(span)) return;
  recordSpan(span, `router ${step}`, { kind: 'router', step, ...details });
}

export function endRouterRegister(span, store) {
  if (!finish(span)) return;
  recordSpan(span, 'router register', {
    kind: 'router',
    step: 'register',
    store: instanceName(store),
  });
}

/**
 * Starts an async span, for work that awaits, such as navigation guards.
 * @returns {object|null} The open span, or null when no trace is recording
 */
export function beginAsync(name) {
  if (activeTrace === null) return null;
  const span = { trace: activeTrace, id: nextEventId++, name };
  recordAsync(span.trace, 'b', name, span.id, {});
  return span;
}

export function endAsync(span, details) {
  if (span.trace !== activeTrace) return;
  recordAsync(span.trace, 'e', span.name, span.id, details);
}

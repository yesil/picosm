import { expect } from '@esm-bundle/chai';
import { html, LitElement } from 'lit';
import { makeObservable } from '../src/makeObservable.js';
import { makeLitObserver } from '../src/makeLitObserver.js';
import { activeTrace, startTrace, stopTrace } from '../src/trace.js';

// Waits until every pending microtask has run
const settle = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function spans(trace, kind) {
  return trace.traceEvents.filter(
    (event) => event.ph === 'X' && event.args.kind === kind,
  );
}

class Counter {
  static observableActions = ['increment', 'rename'];

  count = 0;
  label = 'start';

  increment() {
    this.count += 1;
  }

  rename(label) {
    this.label = label;
  }
}

makeObservable(Counter);

class CounterView extends LitElement {
  static properties = {
    counter: { attribute: false, observe: true },
    heading: {},
  };

  render() {
    return html`<p>${this.counter.label}</p>`;
  }
}

customElements.define('trace-counter-view', makeLitObserver(CounterView));

class SlowCounterView extends CounterView {
  static properties = {
    counter: { attribute: false, observe: true, throttle: 20 },
  };
}

customElements.define(
  'trace-slow-counter-view',
  makeLitObserver(SlowCounterView),
);

// Each render takes at least 2 ms
class BusyCounterView extends CounterView {
  render() {
    const end = performance.now() + 2;
    while (performance.now() < end);
    return super.render();
  }
}

customElements.define(
  'trace-busy-counter-view',
  makeLitObserver(BusyCounterView),
);

async function connectedView(tag, counter) {
  const view = document.createElement(tag);
  view.counter = counter;
  document.body.append(view);
  await view.updateComplete;
  return view;
}

// Runs a store action and waits until the view has updated
async function change(view, action) {
  action();
  await settle();
  await view.updateComplete;
}

afterEach(() => {
  if (activeTrace !== null) stopTrace();
  for (const view of document.querySelectorAll(
    'trace-counter-view, trace-slow-counter-view, trace-busy-counter-view',
  ))
    view.remove();
});

describe('startTrace and stopTrace', () => {
  it('returns a Chrome trace that starts at its performance mark', () => {
    startTrace();
    const trace = stopTrace();
    const mark = performance.getEntriesByName('picosm trace start').at(-1);
    expect(trace.displayTimeUnit).to.equal('ms');
    expect(trace.traceEvents.map(({ ph, name }) => [ph, name])).to.deep.equal([
      ['M', 'process_name'],
      ['M', 'thread_name'],
    ]);
    expect(trace.otherData.startTime).to.equal(mark.startTime);
    expect(trace.otherData.endTime).to.be.at.least(trace.otherData.startTime);
    expect(trace.otherData.droppedEventCount).to.equal(0);
    expect(trace.otherData.views).to.deep.equal({});
    expect(JSON.parse(JSON.stringify(trace))).to.deep.equal(trace);
  });

  it('records only the updates between startTrace and stopTrace', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-counter-view', counter);
    await change(view, () => counter.rename('before'));
    startTrace();
    const trace = stopTrace();
    await change(view, () => counter.rename('after'));
    expect(trace.traceEvents.filter(({ ph }) => ph !== 'M')).to.deep.equal([]);
  });

  it('refuses to start while recording and to stop while idle', () => {
    startTrace();
    expect(() => startTrace()).to.throw(
      'picosm: startTrace() called while a trace is already recording',
    );
    stopTrace();
    expect(() => stopTrace()).to.throw(
      'picosm: stopTrace() called with no trace recording',
    );
  });

  it('rejects a maxEvents that is not a positive integer', () => {
    for (const maxEvents of [0, -1, 1.5, '10', Number.NaN]) {
      expect(() => startTrace({ maxEvents })).to.throw(
        TypeError,
        'picosm: startTrace() option "maxEvents" must be a positive integer',
      );
    }
    expect(activeTrace).to.equal(null);
  });

  it('counts the events past maxEvents instead of recording them, and their updates', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-counter-view', counter);
    startTrace({ maxEvents: 2 });
    await change(view, () => counter.rename('first'));
    await change(view, () => counter.rename('second'));
    const trace = stopTrace();
    // Two requests and two updates, the first request and update recorded
    expect(
      trace.traceEvents
        .filter(({ ph }) => ph !== 'M')
        .map(({ args }) => args.kind),
    ).to.deep.equal(['view-request', 'view-update']);
    expect(trace.otherData.droppedEventCount).to.equal(2);
    expect(trace.otherData.views['trace-counter-view'].updates).to.equal(2);
  });
});

describe('Tracing Lit view updates', () => {
  it('records store-driven updates with their cause', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-counter-view', counter);
    startTrace();
    await change(view, () => counter.rename('changed'));
    await change(view, () => counter.increment());
    const trace = stopTrace();
    const requests = spans(trace, 'view-request');
    expect(
      requests.map(({ name, args }) => [
        name,
        args.property,
        args.store,
        args.throttleMs,
      ]),
    ).to.deep.equal([
      ['<trace-counter-view> update requested', 'counter', 'Counter#1', 0],
      ['<trace-counter-view> update requested', 'counter', 'Counter#1', 0],
    ]);
    const updates = spans(trace, 'view-update');
    expect(
      updates.map(({ name, args }) => [name, args.causes, args.firstUpdate]),
    ).to.deep.equal([
      ['<trace-counter-view> update', [requests[0].args.id], false],
      ['<trace-counter-view> update', [requests[1].args.id], false],
    ]);
    for (const { ts, dur } of [...requests, ...updates]) {
      expect(ts).to.be.a('number');
      expect(dur).to.be.at.least(0);
    }
  });

  it('numbers stores of the same class in order of first appearance', async () => {
    const first = new Counter();
    const second = new Counter();
    const firstView = await connectedView('trace-counter-view', first);
    const secondView = await connectedView('trace-counter-view', second);
    startTrace();
    await change(secondView, () => second.increment());
    await change(firstView, () => first.increment());
    await change(secondView, () => second.increment());
    expect(
      spans(stopTrace(), 'view-request').map(({ args }) => args.store),
    ).to.deep.equal(['Counter#1', 'Counter#2', 'Counter#1']);
  });

  it('records first and property-driven updates without a store cause', async () => {
    const counter = new Counter();
    startTrace();
    const view = await connectedView('trace-counter-view', counter);
    view.heading = 'Not rendered';
    await view.updateComplete;
    const updates = spans(stopTrace(), 'view-update');
    expect(
      updates.map(({ args }) => [args.firstUpdate, args.causes]),
    ).to.deep.equal([
      [true, []],
      [false, []],
    ]);
  });

  it('records the throttle of a throttled observer', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-slow-counter-view', counter);
    startTrace();
    counter.rename('first');
    await settle();
    // Within the throttle window: requested when the window closes
    counter.rename('second');
    await settle();
    await wait(40);
    await view.updateComplete;
    expect(
      spans(stopTrace(), 'view-request').map(({ args }) => args.throttleMs),
    ).to.deep.equal([20, 20]);
  });

  it('never records store values', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-counter-view', counter);
    startTrace();
    await change(view, () => counter.rename('secret label'));
    expect(JSON.stringify(stopTrace())).not.to.include('secret');
  });
});

describe('Summarizing view updates', () => {
  it('counts updates, their rate and time per view, the most time spent first', async () => {
    const counter = new Counter();
    const busy = await connectedView('trace-busy-counter-view', counter);
    startTrace();
    // Its first update counts too
    const quick = await connectedView('trace-counter-view', counter);
    await change(quick, () => counter.rename('first'));
    await change(busy, () => counter.rename('second'));
    const trace = stopTrace();
    const { views } = trace.otherData;
    expect(
      Object.entries(views).map(([view, { updates }]) => [view, updates]),
    ).to.deep.equal([
      ['trace-busy-counter-view', 2],
      ['trace-counter-view', 3],
    ]);
    expect(views['trace-busy-counter-view'].totalMs).to.be.at.least(4);
    const seconds =
      (trace.otherData.endTime - trace.otherData.startTime) / 1000;
    for (const [view, { updates, updatesPerSecond, totalMs }] of Object.entries(
      views,
    )) {
      const spentMs = spans(trace, 'view-update')
        .filter(({ args }) => args.view === view)
        .reduce((sum, { dur }) => sum + dur / 1000, 0);
      expect(totalMs).to.be.closeTo(spentMs, 0.001);
      expect(updatesPerSecond).to.be.closeTo(updates / seconds, 0.001);
    }
  });

  it('gives no rate for a trace that lasted 0 ms', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-counter-view', counter);
    const nativeNow = performance.now;
    try {
      startTrace();
      // The browser clock stands still from the trace's start
      const { startTime } = activeTrace;
      performance.now = () => startTime;
      await change(view, () => counter.rename('instant'));
      expect(stopTrace().otherData.views).to.deep.equal({
        'trace-counter-view': {
          updates: 1,
          updatesPerSecond: null,
          totalMs: 0,
        },
      });
    } finally {
      performance.now = nativeNow;
    }
  });
});

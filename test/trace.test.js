import { expect } from '@esm-bundle/chai';
import { html, LitElement } from 'lit';
import {
  makeObservable,
  notify,
  observe,
  subscribe,
} from '../src/makeObservable.js';
import { makeLitObserver } from '../src/makeLitObserver.js';
import { reaction } from '../src/reaction.js';
import { createRouter } from '../src/router.js';
import { track } from '../src/track.js';
import { activeTrace, startTrace, stopTrace } from '../src/trace.js';

// Waits until every pending microtask has run
const settle = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ORIGINAL_PATH = window.location.pathname;

function spans(trace, kind) {
  return trace.traceEvents.filter(
    (event) => event.ph === 'X' && event.args.kind === kind,
  );
}

class Counter {
  static observableActions = [
    'increment',
    'fail',
    'load',
    'loadAndFail',
    'rename',
  ];
  static computedProperties = ['double'];

  count = 0;
  label = 'start';

  increment() {
    this.count += 1;
  }

  fail() {
    throw new Error('failed');
  }

  async load() {
    await Promise.resolve();
    this.count += 1;
  }

  async loadAndFail() {
    await Promise.resolve();
    throw new Error('rejected');
  }

  rename(label) {
    this.label = label;
    return `returned ${label}`;
  }

  get double() {
    return this.count * 2;
  }
}

makeObservable(Counter);

class Summary {
  static observableActions = [];
}

makeObservable(Summary);

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

async function connectedView(tag, counter) {
  const view = document.createElement(tag);
  view.counter = counter;
  document.body.append(view);
  await view.updateComplete;
  return view;
}

describe('startTrace and stopTrace', () => {
  afterEach(() => {
    if (activeTrace !== null) stopTrace();
  });

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
    expect(JSON.parse(JSON.stringify(trace))).to.deep.equal(trace);
  });

  it('records only the work between startTrace and stopTrace', async () => {
    const counter = new Counter();
    counter.increment();
    await settle();
    startTrace();
    const trace = stopTrace();
    counter.increment();
    await settle();
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

  it('counts the events past maxEvents instead of recording them', async () => {
    const counter = new Counter();
    startTrace({ maxEvents: 2 });
    for (let index = 0; index < 5; index += 1) counter.increment();
    await settle();
    const trace = stopTrace();
    // Five actions and one notification, two of them recorded
    expect(trace.traceEvents.filter(({ ph }) => ph !== 'M')).to.have.length(2);
    expect(trace.otherData.droppedEventCount).to.equal(4);
  });
});

describe('Tracing stores', () => {
  afterEach(() => {
    if (activeTrace !== null) stopTrace();
  });

  it('records each action with its instance and outcome', () => {
    const first = new Counter();
    const second = new Counter();
    startTrace();
    first.increment();
    second.increment();
    first.increment();
    expect(() => first.fail()).to.throw('failed');
    const actions = spans(stopTrace(), 'action');
    expect(
      actions.map(({ name, args }) => [name, args.instance, args.outcome]),
    ).to.deep.equal([
      ['Counter.increment', 'Counter#1', 'returned'],
      ['Counter.increment', 'Counter#2', 'returned'],
      ['Counter.increment', 'Counter#1', 'returned'],
      ['Counter.fail', 'Counter#1', 'threw'],
    ]);
    for (const { ts, dur } of actions) {
      expect(ts).to.be.a('number');
      expect(dur).to.be.at.least(0);
    }
  });

  it('traces async actions until their Promise settles', async () => {
    const counter = new Counter();
    startTrace();
    await counter.load();
    await counter.loadAndFail().catch(() => {});
    const trace = stopTrace();
    const actions = spans(trace, 'action');
    expect(actions.map(({ args }) => args.outcome)).to.deep.equal([
      'pending',
      'pending',
    ]);
    const settled = spans(trace, 'action-settled');
    expect(
      settled.map(({ name, args }) => [name, args.action, args.outcome]),
    ).to.deep.equal([
      ['Counter.load settled', actions[0].args.id, 'resolved'],
      ['Counter.loadAndFail settled', actions[1].args.id, 'rejected'],
    ]);
    const asyncEvents = trace.traceEvents.filter(({ ph }) => 'be'.includes(ph));
    expect(
      asyncEvents.map(({ ph, name, id, args }) => [ph, name, id, args.outcome]),
    ).to.deep.equal([
      ['b', 'Counter.load', actions[0].args.id, undefined],
      ['e', 'Counter.load', actions[0].args.id, 'resolved'],
      ['b', 'Counter.loadAndFail', actions[1].args.id, undefined],
      ['e', 'Counter.loadAndFail', actions[1].args.id, 'rejected'],
    ]);
  });

  it('records one notification per batch, naming the actions that caused it', async () => {
    const counter = new Counter();
    observe(counter, () => {});
    startTrace();
    counter.increment();
    counter.increment();
    await settle();
    const trace = stopTrace();
    const [notification] = spans(trace, 'notification');
    expect(spans(trace, 'notification')).to.have.length(1);
    expect(notification.name).to.equal('Counter notification');
    expect(notification.args.observers).to.equal(1);
    expect(notification.args.causes).to.deep.equal(
      spans(trace, 'action').map(({ args }) => args.id),
    );
  });

  it('links a track() forward between the two notifications', async () => {
    const source = new Counter();
    const target = new Summary();
    track(target, source);
    observe(target, () => {});
    await settle();
    startTrace();
    source.increment();
    await settle();
    const trace = stopTrace();
    const [action] = spans(trace, 'action');
    const [sourceNotification, targetNotification] = spans(
      trace,
      'notification',
    );
    const [forward] = spans(trace, 'track');
    expect(sourceNotification.args.causes).to.deep.equal([action.args.id]);
    expect(forward.name).to.equal('track Counter → Summary');
    expect(forward.args).to.include({
      source: 'Counter#1',
      target: 'Summary#1',
      notification: sourceNotification.args.id,
    });
    expect(targetNotification.name).to.equal('Summary notification');
    expect(targetNotification.args.causes).to.deep.equal([forward.args.id]);
  });

  it('records whether a reaction selected changed values', async () => {
    const counter = new Counter();
    let isSkipped = false;
    reaction(
      counter,
      function badgeValues(target) {
        return isSkipped ? [] : [target.count > 0];
      },
      function showBadge() {},
    );
    startTrace();
    counter.increment();
    await settle();
    counter.increment();
    await settle();
    isSkipped = true;
    counter.increment();
    await settle();
    const trace = stopTrace();
    const reactions = spans(trace, 'reaction');
    expect(reactions.map(({ args }) => args.result)).to.deep.equal([
      'changed',
      'unchanged',
      'skipped',
    ]);
    expect(reactions[0].name).to.equal('reaction showBadge');
    expect(reactions[0].args).to.include({
      selector: 'badgeValues',
      effect: 'showBadge',
    });
    expect(reactions[0].args.targets).to.deep.equal(['Counter#1']);
    expect(reactions.map(({ args }) => args.notification)).to.deep.equal(
      spans(trace, 'notification').map(({ args }) => args.id),
    );
  });

  it('records recomputed values and counts cache hits', () => {
    const counter = new Counter();
    startTrace();
    expect(counter.double).to.equal(0);
    expect(counter.double).to.equal(0);
    expect(counter.double).to.equal(0);
    const trace = stopTrace();
    expect(spans(trace, 'computed').map(({ name }) => name)).to.deep.equal([
      'Counter.double computed',
    ]);
    expect(trace.otherData.computedHits).to.deep.equal({ 'Counter.double': 2 });
  });

  it('records messages with their subscriber count', () => {
    const counter = new Counter();
    subscribe(counter, () => {});
    startTrace();
    notify(counter, { secret: 'message value' });
    const [message] = spans(stopTrace(), 'message');
    expect(message.name).to.equal('Counter message');
    expect(message.args.subscribers).to.equal(1);
  });

  it('never records arguments, return values, messages or state', async () => {
    const counter = new Counter();
    observe(counter, () => {});
    subscribe(counter, () => {});
    startTrace();
    counter.rename('secret argument');
    notify(counter, 'secret message');
    await settle();
    expect(JSON.stringify(stopTrace())).not.to.include('secret');
  });
});

describe('Tracing Lit views', () => {
  afterEach(() => {
    if (activeTrace !== null) stopTrace();
    for (const view of document.querySelectorAll(
      'trace-counter-view, trace-slow-counter-view',
    ))
      view.remove();
  });

  it('records store-driven updates with their cause and DOM mutations', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-counter-view', counter);
    startTrace();
    counter.rename('changed');
    await settle();
    await view.updateComplete;
    // The view renders the label only, so this update changes no DOM
    counter.increment();
    await settle();
    await view.updateComplete;
    const trace = stopTrace();
    const requests = spans(trace, 'view-request');
    expect(
      requests.map(({ name, args }) => [name, args.property, args.store]),
    ).to.deep.equal([
      ['<trace-counter-view> update requested', 'counter', 'Counter#1'],
      ['<trace-counter-view> update requested', 'counter', 'Counter#1'],
    ]);
    expect(requests.map(({ args }) => args.notification)).to.deep.equal(
      spans(trace, 'notification').map(({ args }) => args.id),
    );
    const updates = spans(trace, 'view-update');
    expect(
      updates.map(({ name, args }) => [name, args.causes, args.firstUpdate]),
    ).to.deep.equal([
      ['<trace-counter-view> update', [requests[0].args.id], false],
      ['<trace-counter-view> update', [requests[1].args.id], false],
    ]);
    expect(updates[0].args.domMutations).to.be.above(0);
    expect(updates[1].args.domMutations).to.equal(0);
  });

  it('records first and property-driven updates without a store cause', async () => {
    const counter = new Counter();
    startTrace();
    const view = await connectedView('trace-counter-view', counter);
    view.heading = 'Not rendered';
    await view.updateComplete;
    const updates = spans(stopTrace(), 'view-update');
    expect(
      updates.map(({ args }) => [
        args.firstUpdate,
        args.causes,
        args.domMutations > 0,
      ]),
    ).to.deep.equal([
      [true, [], true],
      [false, [], false],
    ]);
  });

  it('records throttled requests outside the notification that caused them', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-slow-counter-view', counter);
    startTrace();
    counter.rename('first');
    await settle();
    counter.rename('second');
    await settle();
    await wait(40);
    await view.updateComplete;
    const trace = stopTrace();
    const [notification] = spans(trace, 'notification');
    expect(
      spans(trace, 'view-request').map(({ args }) => [
        args.notification,
        args.throttleMs,
      ]),
    ).to.deep.equal([
      [notification.args.id, 20],
      [null, 20],
    ]);
  });

  it('creates no MutationObserver while no trace records', async () => {
    const counter = new Counter();
    const view = await connectedView('trace-counter-view', counter);
    const NativeMutationObserver = window.MutationObserver;
    let createdCount = 0;
    window.MutationObserver = class extends NativeMutationObserver {
      constructor(callback) {
        super(callback);
        createdCount += 1;
      }
    };
    try {
      counter.rename('untraced');
      await settle();
      await view.updateComplete;
      expect(createdCount).to.equal(0);
      startTrace();
      counter.rename('traced');
      await settle();
      await view.updateComplete;
      stopTrace();
      expect(createdCount).to.equal(1);
    } finally {
      window.MutationObserver = NativeMutationObserver;
    }
  });
});

class Filters {
  static observableActions = ['applyRoute', 'setTerm'];

  term = '';

  applyRoute(route) {
    this.term = route.query.term ?? '';
  }

  setTerm(term) {
    this.term = term;
  }
}

makeObservable(Filters);

describe('Tracing the router', () => {
  let router;

  afterEach(() => {
    if (activeTrace !== null) stopTrace();
    router?.destroy();
    history.replaceState(null, '', ORIGINAL_PATH);
  });

  it('records router steps without paths, queries or hashes', async () => {
    const filters = new Filters();
    startTrace();
    router = createRouter();
    router.register(filters, {
      onRoute: (route) => filters.applyRoute(route),
      toURL: () => ({ query: { term: filters.term } }),
    });
    await router.navigate('/secret-path?term=secret-term#secret-hash');
    await settle();
    filters.setTerm('secret-update');
    await settle();
    const trace = stopTrace();
    expect(
      spans(trace, 'router').map(({ name, args }) => [
        name,
        args.mode ?? args.trigger ?? args.outcome ?? args.store,
      ]),
    ).to.deep.equal([
      ['router register', 'Filters#1'],
      // The route applied on registration leaves the URL as it was
      ['router sync', 'unchanged'],
      ['router write', 'push'],
      ['router onRoute', 'navigate'],
      ['router sync', 'current'],
      ['router write', 'push'],
      ['router sync', 'written'],
    ]);
    const guards = trace.traceEvents.filter(
      ({ name }) => name === 'router guards',
    );
    expect(guards.map(({ ph, args }) => [ph, args.outcome])).to.deep.equal([
      ['b', undefined],
      ['e', 'allowed'],
    ]);
    expect(JSON.stringify(trace)).not.to.include('secret');
  });
});

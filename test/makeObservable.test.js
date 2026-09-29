import { fake } from 'sinon';
import { expect } from '@esm-bundle/chai';
import {
  makeObservable,
  observe,
  subscribe,
  notify,
} from '../src/makeObservable.js';
import TestStore from './TestStore.js';

const flush = () => new Promise((r) => queueMicrotask(r));
// Waits until every pending microtask has run
const settle = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Pico State Manager', () => {
  it('makes any class observable', () => {
    expect(TestStore.prototype.__notifyObservers).to.be.a('function');
    expect(TestStore.prototype.__resetComputedProperties).to.be.a('function');
    expect(TestStore.prototype.__observe).to.be.a('function');
    expect(TestStore.prototype.__subscribe).to.be.a('function');
  });

  it('caches computed values', () => {
    const observable = new TestStore();
    const random1 = observable.random;
    const random2 = observable.random;
    const random3 = observable.random;
    expect(random2).to.equal(random1);
    expect(random3).to.equal(random2);
  });

  it('resets computed values after an action', () => {
    const observable = new TestStore();
    expect(observable.random).to.match(/^unchecked/);
    observable.toggleCheck();
    expect(observable.random).to.match(/^checked/);
  });

  it('coalesces synchronous actions into a single notification', async () => {
    const observer = fake();
    const observable = new TestStore();
    const disposer = observe(observable, observer);
    expect(observer.callCount).to.equal(0);
    observable.toggleCheck();
    observable.toggleCheck();
    await flush();
    expect(observer.callCount).to.equal(1);
    disposer();
    observable.toggleCheck();
    await flush();
    expect(observer.callCount).to.equal(1);
  });

  it('notifies again for actions in later ticks', async () => {
    const observer = fake();
    const observable = new TestStore();
    observe(observable, observer);
    observable.toggleCheck();
    await flush();
    observable.toggleCheck();
    await flush();
    expect(observer.callCount).to.equal(2);
  });

  it('supports async actions', async () => {
    const observer = fake();
    const observable = new TestStore();
    const disposer = observe(observable, observer);
    expect(observer.callCount).to.equal(0);
    await observable.toggleAsyncCheck();
    await flush();
    expect(observer.callCount).to.equal(1);
    disposer();
  });

  it('notifies and resets computed values when an action throws', async () => {
    class Store {
      static observableActions = ['setAndFail'];
      static computedProperties = ['double'];
      value = 1;
      setAndFail(value) {
        this.value = value;
        throw new Error('validation failed');
      }
      get double() {
        return this.value * 2;
      }
    }
    makeObservable(Store);
    const store = new Store();
    const observer = fake();
    observe(store, observer);
    expect(store.double).to.equal(2);

    expect(() => store.setAndFail(5)).to.throw('validation failed');
    await settle();

    expect(store.double).to.equal(10);
    expect(observer.callCount).to.equal(1);
  });

  it('notifies and resets computed values when an async action rejects', async () => {
    class Store {
      static observableActions = ['load'];
      static computedProperties = ['hasError'];
      error = null;
      async load() {
        await null;
        this.error = 'network down';
        throw new Error('network down');
      }
      get hasError() {
        return this.error != null;
      }
    }
    makeObservable(Store);
    const store = new Store();
    const observer = fake();
    observe(store, observer);
    expect(store.hasError).to.equal(false);

    const error = await store.load().catch((e) => e);
    await settle();

    expect(error.message).to.equal('network down');
    expect(store.hasError).to.equal(true);
    expect(observer.callCount).to.equal(1);
  });

  it('instruments subclasses of an observable class', async () => {
    class Base {
      static observableActions = ['increment'];
      static computedProperties = ['double'];
      count = 0;
      increment() {
        this.count++;
      }
      get double() {
        return this.count * 2;
      }
    }
    makeObservable(Base);

    class Sub extends Base {
      static observableActions = ['increment', 'decrement'];
      static computedProperties = ['double'];
      decrement() {
        this.count--;
      }
      get double() {
        return super.double + 1;
      }
    }
    makeObservable(Sub);

    const sub = new Sub();
    const observer = fake();
    observe(sub, observer);
    expect(sub.double).to.equal(1);

    sub.decrement();
    await settle();
    expect(observer.callCount).to.equal(1);
    expect(sub.double).to.equal(-1);

    sub.increment();
    await settle();
    expect(observer.callCount).to.equal(2);
    expect(sub.double).to.equal(1);
  });

  it('instruments inherited methods listed by the class', async () => {
    class Plain {
      reset() {
        this.count = 0;
      }
    }
    class Store extends Plain {
      static observableActions = ['reset'];
      count = 5;
    }
    makeObservable(Store);
    const store = new Store();
    const observer = fake();
    observe(store, observer);

    store.reset();
    await settle();

    expect(observer.callCount).to.equal(1);
  });

  it('throws for listed names that are not methods or getters', () => {
    class Typo {
      static observableActions = ['incrment'];
      increment() {}
    }
    class ArrowField {
      static observableActions = ['increment'];
      increment = () => {};
    }
    class PlainField {
      static computedProperties = ['total'];
      total = 0;
    }
    class NotAnArray {
      static observableActions = 'increment';
      increment() {}
    }

    expect(() => makeObservable(Typo)).to.throw(
      TypeError,
      /makeObservable\(Typo\): "incrment" is listed in observableActions but is not a method/,
    );
    expect(() => makeObservable(ArrowField)).to.throw(
      TypeError,
      /"increment" is listed in observableActions but is not a method/,
    );
    expect(() => makeObservable(PlainField)).to.throw(
      TypeError,
      /"total" is listed in computedProperties but is not a getter/,
    );
    expect(() => makeObservable(NotAnArray)).to.throw(
      TypeError,
      /static observableActions must be an array/,
    );
  });

  it('keeps its internal state out of enumeration and JSON', async () => {
    const observable = new TestStore();
    observe(observable, () => {});
    observable.toggleCheck();
    await settle();

    const keys = [];
    for (const key in observable) keys.push(key);
    expect(keys).to.deep.equal(['checked']);
    expect(JSON.stringify(observable)).to.equal('{"checked":true}');
  });

  it('does not call a throttled observer after it was disposed', async () => {
    const observable = new TestStore();
    const observer = fake();
    const dispose = observe(observable, observer, 50);
    observable.toggleCheck();
    await settle();
    observable.toggleCheck();
    await settle();

    dispose();
    await wait(80);

    expect(observer.callCount).to.equal(1);
  });

  it('calls a throttled observer at most once per window', async () => {
    const observable = new TestStore();
    const calls = [];
    observe(observable, () => calls.push(performance.now()), 100);

    observable.toggleCheck(); // runs now, window until +100
    await settle();
    observable.toggleCheck(); // runs at +100, next window until +200
    await settle();
    await wait(120);
    observable.toggleCheck(); // inside the second window: runs at +200
    await settle();
    expect(calls.length).to.equal(2);

    await wait(120);
    expect(calls.length).to.equal(3);
    expect(calls[2] - calls[1]).to.be.at.least(95);
  });

  it('keeps notifying the other observers when one throws, and reports the error', async () => {
    const observable = new TestStore();
    const failure = new Error('observer failed');
    const second = fake();
    const reported = [];
    const { queueMicrotask } = window;
    window.queueMicrotask = (callback) =>
      queueMicrotask(() => {
        try {
          callback();
        } catch (error) {
          reported.push(error);
        }
      });
    try {
      observe(observable, () => {
        throw failure;
      });
      observe(observable, second);
      observable.toggleCheck();
      await settle();
    } finally {
      window.queueMicrotask = queueMicrotask;
    }

    expect(second.callCount).to.equal(1);
    expect(reported).to.deep.equal([failure]);
  });

  it('does not call an observer again when it re-subscribes during a notification', async () => {
    const observable = new TestStore();
    let calls = 0;
    let dispose;
    const observer = () => {
      calls++;
      if (calls > 10) return;
      dispose();
      dispose = observe(observable, observer);
    };
    dispose = observe(observable, observer);

    observable.toggleCheck();
    await settle();

    expect(calls).to.equal(1);
  });

  it('skips observers disposed by an earlier observer in the same notification', async () => {
    const observable = new TestStore();
    const second = fake();
    let disposeSecond;
    observe(observable, () => disposeSecond());
    disposeSecond = observe(observable, second);

    observable.toggleCheck();
    await settle();

    expect(second.callCount).to.equal(0);
  });

  it('throws descriptive errors for targets that are not observable', () => {
    expect(() => observe({}, () => {})).to.throw(
      TypeError,
      /observe\(\) expects an instance of a class passed to makeObservable\(\), got an instance of Object/,
    );
    expect(() => subscribe(TestStore, () => {})).to.throw(
      TypeError,
      /subscribe\(\) expects .* got the class\/function TestStore/,
    );
    expect(() => notify(null, 'message')).to.throw(
      TypeError,
      /notify\(\) expects .* got null/,
    );
    expect(() => observe(new TestStore())).to.throw(
      TypeError,
      /observe\(\) expects a callback function/,
    );
  });

  it('supports subscribe and notify functionality', () => {
    const subscriber = fake();
    const observable = new TestStore();
    const disposer = subscribe(observable, subscriber);

    expect(subscriber.callCount).to.equal(0);

    notify(observable, 'test message');
    expect(subscriber.callCount).to.equal(1);
    expect(subscriber.firstCall.args[0]).to.equal('test message');

    notify(observable, { data: 123 });
    expect(subscriber.callCount).to.equal(2);
    expect(subscriber.secondCall.args[0]).to.deep.equal({ data: 123 });

    disposer();
    notify(observable, 'ignored message');
    expect(subscriber.callCount).to.equal(2);
  });
});

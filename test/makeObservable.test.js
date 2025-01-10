import { fake } from 'sinon';
import { expect } from '@esm-bundle/chai';
import { observe, subscribe, notify } from '../src/makeObservable.js';
import TestStore from './TestStore.js';

describe('Pico State Manager', () => {
  it('makes any class observable', () => {
    expect(TestStore.prototype.__notifyObservers).to.be.a('function');
    expect(TestStore.prototype.__resetComputedProperties).to.be.a('function');
    expect(TestStore.prototype.__observe).to.be.a('function');
    expect(TestStore.prototype.__notifyObservers).to.be.a('function');
  });

  it('caches computed values', () => {
    const observable = new TestStore();
    const random1 = observable.random;
    const random2 = observable.random;
    const random3 = observable.random;
    expect(random2).to.equal(random1);
    expect(random3).to.equal(random2);
  });

  it('provides observe function', () => {
    const observer = fake();
    const observable = new TestStore();
    const disposer = observe(observable, observer);
    expect(observer.callCount).to.equal(0);
    observable.toggleCheck();
    observable.toggleCheck();
    expect(observer.callCount).to.equal(2);
    disposer();
    observable.toggleCheck();
    expect(observer.callCount).to.equal(2);
  });

  it('supports async actions', async () => {
    const observer = fake();
    const observable = new TestStore();
    const disposer = observe(observable, observer);
    expect(observer.callCount).to.equal(0);
    await observable.toggleAsyncCheck();
    expect(observer.callCount).to.equal(1);
    disposer();
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

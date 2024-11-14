import { fake } from 'sinon';
import { expect } from '@esm-bundle/chai';
import { makeObservable, observe } from '../src/makeObservable.js';
import TestStore from './TestStore.js';

describe('Pico State Manager', () => {
  const TestObservable = makeObservable(
    TestStore,
    ['toggleCheck', 'toggleAsyncCheck'],
    ['random'],
  );

  it('makes any class observable', () => {
    expect(TestObservable.prototype.__notifyListeners).to.be.a('function');
    expect(TestObservable.prototype.__resetComputedProperties).to.be.a(
      'function',
    );
    expect(TestObservable.prototype.__observe).to.be.a('function');
    expect(TestObservable.prototype.__notifyListeners).to.be.a('function');
  });

  it('caches computed values', () => {
    const observable = new TestObservable();
    const random1 = observable.random;
    const random2 = observable.random;
    const random3 = observable.random;
    expect(random2).to.equal(random1);
    expect(random3).to.equal(random2);
  });

  it('provides observe function', () => {
    const observer = fake();
    const observable = new TestObservable();
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
    const observable = new TestObservable();
    const disposer = observe(observable, observer);
    expect(observer.callCount).to.equal(0);
    await observable.toggleAsyncCheck();
    expect(observer.callCount).to.equal(1);
    disposer();
  });
});

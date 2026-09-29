import { fake } from 'sinon';
import { expect } from '@esm-bundle/chai';
import { makeObservable, observe } from '../src/makeObservable.js';
import { track } from '../src/track.js';
import TestStore from './TestStore.js';

// Waits until every pending microtask has run
const settle = () => new Promise((r) => setTimeout(r, 0));

class Item {
  static observableActions = ['setQuantity'];

  quantity = 1;

  constructor(price) {
    this.price = price;
  }

  setQuantity(quantity) {
    this.quantity = quantity;
  }
}

makeObservable(Item);

class Cart {
  static observableActions = ['add'];
  static computedProperties = ['total'];

  items = [];

  add(item) {
    this.items.push(item);
  }

  get total() {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

makeObservable(Cart);

describe('track', () => {
  it('forwards source notifications to the target and resets its computed values', async () => {
    const cart = new Cart();
    const item = new Item(10);
    cart.add(item);
    const untrack = track(cart, item);
    await settle();
    const observer = fake();
    observe(cart, observer);
    expect(cart.total).to.equal(10);

    item.setQuantity(3);
    await settle();
    expect(observer.callCount).to.equal(1);
    expect(cart.total).to.equal(30);

    untrack();
    item.setQuantity(5);
    await settle();
    expect(observer.callCount).to.equal(1);
  });

  it('notifies the connected store observers', async () => {
    const test1 = new TestStore();
    const test2 = new TestStore();
    const observer = fake();
    observe(test1, observer);

    test1.connect(test2);
    await settle();
    expect(observer.callCount).to.equal(1);

    test2.toggleCheck();
    await settle();
    expect(observer.callCount).to.equal(2);
    expect(test1.counter).to.equal(1);

    test1.connect();
    test2.toggleCheck();
    await settle();
    expect(observer.callCount).to.equal(2);
  });

  it('throws when tracking would create a notification cycle', () => {
    const a = new Item(1);
    const b = new Item(2);
    const c = new Item(3);
    const untrackAB = track(a, b);
    const untrackBC = track(b, c);

    expect(() => track(b, a)).to.throw(Error, /notification cycle/);
    expect(() => track(c, a)).to.throw(Error, /notification cycle/);
    expect(() => track(a, a)).to.throw(Error, /notification cycle/);

    untrackAB();
    untrackBC();
    track(b, a)();
  });

  it('throws descriptive errors for arguments that are not observable', () => {
    expect(() => track(new Item(1), {})).to.throw(TypeError, /track\(\) source expects/);
    expect(() => track({}, new Item(1))).to.throw(TypeError, /track\(\) target expects/);
  });
});

import { spy } from 'sinon';
import { expect } from '@esm-bundle/chai';
import { makeObservable } from '../src/makeObservable.js';
import { reaction } from '../src/reaction.js';
import TestStore from './TestStore.js';

const flush = () => new Promise((r) => queueMicrotask(r));

class Pair {
  static observableActions = ['setA', 'setB'];

  a = 1;
  b = 1;

  setA(value) {
    this.a = value;
  }

  setB(value) {
    this.b = value;
  }
}

makeObservable(Pair);

describe('Pico State Manager', () => {

  it('provides reaction function', async () => {
    const observable = new TestStore();
    const execute = spy((mode5, counter) => {
      if (mode5) {
        console.log(counter, 'is divisible by 5');
      }
    });
    const disposer = reaction(
      observable,
      (test) => {
        return test.counter % 5 === 0 ? [true, test.counter] : [];
      },
      execute,
    );

    for (let i = 0; i < 9; i++) {
      observable.toggleCheck();
      await flush();
    }

    expect(execute.callCount).to.equal(1);

    disposer();

    for (let i = 0; i < 9; i++) {
      observable.toggleCheck();
      await flush();
    }

    expect(execute.callCount).to.equal(1);
  });

  it('supports multi-target reaction', async () => {
    const a = new TestStore();
    const b = new TestStore();

    const execute = spy((flag, sum) => {
      if (flag) {
        console.log('sum divisible by 5:', sum);
      }
    });

    const disposer = reaction(
      [a, b],
      (storeA, storeB) => {
        const sum = storeA.counter + storeB.counter;
        return sum % 5 === 0 && sum !== 0 ? [true, sum] : [];
      },
      execute,
    );

    // Change only A 9 times -> expect one execution at sum = 5
    for (let i = 0; i < 9; i++) {
      a.toggleCheck();
      await flush();
    }

    expect(execute.callCount).to.equal(1);

    // Reset spy counts further changes shouldn't trigger after dispose
    disposer();

    for (let i = 0; i < 9; i++) {
      b.toggleCheck();
      await flush();
    }

    expect(execute.callCount).to.equal(1);
  });
  it('runs the effect only when the selected values change', async () => {
    const pair = new Pair();
    const execute = spy();
    reaction(pair, ({ a }) => [a], execute);

    pair.setB(2);
    await flush();
    expect(execute.callCount).to.equal(0);

    pair.setA(2);
    await flush();
    expect(execute.callCount).to.equal(1);
    expect(execute.firstCall.args).to.deep.equal([2]);

    pair.setA(2);
    await flush();
    expect(execute.callCount).to.equal(1);
  });

  it('compares the selected values with Object.is', async () => {
    const pair = new Pair();
    pair.a = NaN;
    const execute = spy();
    reaction(pair, ({ a }) => [a], execute);

    pair.setB(2);
    await flush();
    pair.setA(NaN);
    await flush();

    expect(execute.callCount).to.equal(0);
  });

  it('requires the selector to return an array', () => {
    expect(() => reaction(new Pair(), ({ a }) => a, () => {})).to.throw(
      TypeError,
      /selector must return an array/,
    );
  });

  it('throws a descriptive error for targets that are not observable', () => {
    expect(() => reaction({}, () => [], () => {})).to.throw(
      TypeError,
      /reaction\(\) expects an instance of a class passed to makeObservable\(\)/,
    );
  });
});

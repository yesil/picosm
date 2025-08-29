import { spy } from 'sinon';
import { expect } from '@esm-bundle/chai';
import { reaction } from '../src/reaction.js';
import TestStore from './TestStore.js';

describe('Pico State Manager', () => {

  it('provides reaction function', () => {
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
    }

    expect(execute.callCount).to.equal(1);

    disposer();

    for (let i = 0; i < 9; i++) {
      observable.toggleCheck();
    }

    expect(execute.callCount).to.equal(1);
  });

  it('supports multi-target reaction', () => {
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
    }

    expect(execute.callCount).to.equal(1);

    // Reset spy counts further changes shouldn't trigger after dispose
    disposer();

    for (let i = 0; i < 9; i++) {
      b.toggleCheck();
    }

    expect(execute.callCount).to.equal(1);
  });
});

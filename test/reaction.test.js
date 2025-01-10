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
});

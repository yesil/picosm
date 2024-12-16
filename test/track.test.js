import { expect } from '@esm-bundle/chai';
import { makeObservable } from '../src/makeObservable.js';
import TestStore from './TestStore.js';

describe('Pico State Manager', function () {
  const TestObservable = makeObservable(
    TestStore,
    ['toggleCheck'],
    ['random', 'counter'],
  );

  it('provides track/untrack function', function () {
    const test1 = new TestObservable();
    const test2 = new TestObservable();

    test1.toggleCheck();
    test2.toggleCheck();

    expect(test1.counter).to.equal(1);
    expect(test2.counter).to.equal(1);

    test1.connect(test2);
    test2.toggleCheck();

    expect(test1.counter).to.equal(3);

    test1.connect();
    test2.toggleCheck();
  });
});

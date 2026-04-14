import { expect } from '@esm-bundle/chai';
import TestStore from './TestStore.js';

const flush = () => new Promise((r) => queueMicrotask(r));

describe('Pico State Manager', function () {
  it('provides track/untrack function', async function () {
    const test1 = new TestStore();
    const test2 = new TestStore();

    test1.toggleCheck();
    await flush();
    test2.toggleCheck();
    await flush();

    expect(test1.counter).to.equal(1);
    expect(test2.counter).to.equal(1);

    test1.connect(test2);
    await flush();
    test2.toggleCheck();
    await flush();

    expect(test1.counter).to.equal(3);

    test1.connect();
    test2.toggleCheck();
    await flush();
  });
});

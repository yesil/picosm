import { track, untrack } from '../src/track.js';

export default class TestStore {
  constructor() {
    this.checked = false;
    this._counter = 0;
    this._test = undefined;
  }

  toggleCheck() {
    this.checked = !this.checked;
    this._counter++;
  }

  async toggleAsyncCheck() {
    await new Promise((resolve) =>
      setTimeout(() => {
        this.checked = !this.checked;
        this._counter++;
        resolve(true);
      }, 100),
    );
  }

  get counter() {
    return this._counter + (this._test ? this._test.counter : 0);
  }

  set test(test) {
    if (this._test) {
      untrack(this, this._test);
    }
    this._test = test;
    if (test) {
      track(this, test);
    }
  }

  get random() {
    const value = Math.floor(Math.random() * 100);
    return `${this.checked ? 'checked' : 'unchecked'} ${value}`;
  }
}

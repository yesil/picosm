import { track } from '../src/track.js';

export default class TestStore {
  #disposer;
  #connection;
  #counter = 0;

  constructor() {
    this.checked = false;
  }

  toggleCheck() {
    this.checked = !this.checked;
    this.#counter++;
  }

  async toggleAsyncCheck() {
    await new Promise((resolve) =>
      setTimeout(() => {
        this.checked = !this.checked;
        this.#counter++;
        resolve(true);
      }, 100),
    );
  }

  get counter() {
    return this.#counter + (this.#connection ? this.#connection.counter : 0);
  }

  connect(store) {
    this.#disposer?.();
    this.#connection = store;
    if (store) {
      this.#disposer = track(this, store);
    }
  }

  get random() {
    const value = Math.floor(Math.random() * 100);
    return `${this.checked ? 'checked' : 'unchecked'} ${value}`;
  }
}

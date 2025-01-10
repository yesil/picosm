import { makeObservable } from '../src/makeObservable.js';
import { track } from '../src/track.js';

export default class TestStore {
  #disposer;
  #connection;
  #counter = 0;

  static observableActions = ['toggleCheck', 'toggleAsyncCheck'];
  static computedProperties = ['random'];

  constructor() {
    this.checked = false;
  }

  get counter() {
    return this.#counter + (this.#connection ? this.#connection.counter : 0);
  }

  get random() {
    const value = Math.floor(Math.random() * 100);
    return `${this.checked ? 'checked' : 'unchecked'} ${value}`;
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

  connect(store) {
    this.#disposer?.();
    this.#connection = store;
    if (store) {
      this.#disposer = track(this, store);
    }
  }
}

makeObservable(TestStore);

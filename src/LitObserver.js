import { observe } from './makeObservable.js';

export function litObserver(constructor, properties) {
  return class LitObserver extends constructor {
    #observables = new Set();
    #disposers = new Set();
    constructor(...args) {
      super(...args);
    }

    trackProperties() {
      properties.forEach((property) => {
        const observable = this[property];
        if (!observable?.__observers) return;
        if (this.#observables.has(observable)) {
          return;
        }
        this.#observables.add(observable);
        this.#disposers.add(observe(observable, this.requestUpdate.bind(this)));
      });
    }

    update(changedProperties) {
      super.update(changedProperties);
      this.trackProperties();
    }

    connectedCallback() {
      super.connectedCallback();
      this.#observables.forEach((o) => {
        this.#disposers.add(observe(o, this.requestUpdate.bind(this)));
      });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.#disposers.forEach((disposer) => {
        disposer();
      });
      this.#disposers.clear();
      console.log(this.#disposers.size);
    }
  };
}

import { observe } from './makeObservable.js';

export function makeObserver(constructor, properties) {
  return class LitObserver extends constructor {
    constructor(...args) {
      super(...args);
      this.observables = new Set();
      this.disposers = new Set();
    }

    trackProperties() {
      properties.forEach((property) => {
        const observable = this[property];
        if (!observable?.__observers) return;
        if (this.observables.has(observable)) {
          return;
        }
        this.observables.add(observable);
        observe(observable, this.requestUpdate.bind(this));
      });
    }

    update(changedProperties) {
      super.update(changedProperties);
      this.trackProperties();
    }

    connectedCallback() {
      super.connectedCallback();
      this.observables.forEach((o) => {
        observe(o, this.requestUpdate.bind(this));
      });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.disposers.forEach((disposer) => {
        disposer();
      });
      this.disposers.clear();
    }
  };
}

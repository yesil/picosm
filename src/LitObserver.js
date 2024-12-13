import { observe, observeSlow } from './makeObservable.js';

export function litObserver(constructor, properties) {
  class LitObserver extends constructor {
    #observables = new Set();
    #disposers = new Set();
    constructor(...args) {
      super(...args);
    }

    trackProperties() {
      properties.forEach((property) => {
        let observableProperty;
        let delay;
        let observeFn = observe;
        if (Array.isArray(property)) {
          observableProperty = this[property[0]];
          delay = property[1];
          observeFn = observeSlow(delay);
        } else {
          observableProperty = this[property];
        }
        if (!observableProperty?.__observers) return;
        if (this.#observables.has(observableProperty)) {
          return;
        }
        this.#observables.add(observableProperty);
        this.#disposers.add(
          observeFn(observableProperty, this.requestUpdate.bind(this)),
        );
      });
    }

    updated(changedProperties) {
      super.updated(changedProperties);
      this.trackProperties();
    }

    connectedCallback() {
      super.connectedCallback();
      this.#observables.forEach((o) => {
        this.#disposers.add(observeFn(o, this.requestUpdate.bind(this)));
      });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.#disposers.forEach((disposer) => {
        disposer();
      });
      this.#disposers.clear();
    }
  }
  return eval(`(class ${constructor.name} extends LitObserver {})`);
}

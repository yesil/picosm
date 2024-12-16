import { observe } from './makeObservable.js';

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
        if (Array.isArray(property)) {
          observableProperty = this[property[0]];
          delay = property[1];
        } else {
          observableProperty = this[property];
        }
        if (this.#observables.has(observableProperty)) {
          return;
        }
        if (!observableProperty) return;
        this.#observables.add(observableProperty);
        this.#disposers.add(
          observe(observableProperty, this.requestUpdate.bind(this), delay),
        );
      });
    }

    updated(changedProperties) {
      super.updated(changedProperties);
      this.trackProperties();
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

import { observe } from './makeObservable.js';

class ObserverController {
  constructor(host) {
    this.host = host;
    this.disposers = new Map();
    this.observed = new Map();
    host.addController(this);
  }

  hostConnected() {
    this.observeProperties();
  }

  hostDisconnected() {
    // Clean up all observers
    for (const disposer of this.disposers.values()) {
      disposer();
    }
    this.disposers.clear();
    this.observed.clear();
  }

  hostUpdate() {
    // Lit also updates disconnected elements; observing then would let the store retain the element
    if (this.host.isConnected) this.observeProperties();
  }

  observeProperties() {
    // elementProperties includes inherited and decorator-declared properties with their options
    for (const [propName, options] of this.host.constructor.elementProperties) {
      if (options?.observe === true) {
        this.setupObserver(propName, this.host[propName], options);
      }
    }
  }

  setupObserver(propName, value, options) {
    if (this.disposers.has(propName)) {
      if (this.observed.get(propName) === value) return;
      // The property holds a new value: stop observing the previous one
      this.disposers.get(propName)();
      this.disposers.delete(propName);
      this.observed.delete(propName);
    }

    if (value == null) return;
    if (typeof value.__observe !== 'function') {
      throw new TypeError(
        `makeLitObserver: property "${String(propName)}" of <${this.host.localName}> is declared with observe: true, but its value is not an instance of a class passed to makeObservable()`,
      );
    }

    const callback = () => this.host.requestUpdate();
    this.disposers.set(propName, observe(value, callback, options.throttle));
    this.observed.set(propName, value);
  }
}

/**
 * Enhances a LitElement class to automatically observe changes in properties marked with observe
 * @param {Class<LitElement>} constructor
 */
export function makeLitObserver(constructor) {
  const originalConnectedCallback = constructor.prototype.connectedCallback;

  constructor.prototype.connectedCallback = function () {
    if (!this.__observer) {
      this.__observer = new ObserverController(this);
    }
    if (originalConnectedCallback) {
      originalConnectedCallback.call(this);
    }
  };

  return constructor;
}

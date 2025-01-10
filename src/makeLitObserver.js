import { observe } from './makeObservable.js';

class ObserverController {
  constructor(host) {
    this.host = host;
    this.disposers = new Map();
    host.addController(this);
    const constructor = this.host.constructor;
    // Get the properties descriptor to check if it's a getter
    const descriptor = Object.getOwnPropertyDescriptor(
      constructor,
      'properties',
    );
    this.getProperties = () => {
      if (descriptor && descriptor.get) {
        return constructor.properties || {};
      }
      return constructor.hasOwnProperty('properties')
        ? constructor.properties
        : {};
    };
  }

  hostConnected() {
    const props = this.getProperties();

    for (const [propName, config] of Object.entries(props)) {
      this.setupObserver(propName, this.host[propName], config);
    }
  }

  hostDisconnected() {
    // Clean up all observers
    for (const disposer of this.disposers.values()) {
      disposer();
    }
    this.disposers.clear();
  }

  hostUpdate() {
    const props = this.getProperties();

    // Check all observable properties
    for (const [propName, config] of Object.entries(props)) {
      if (config && config.observe !== false) {
        const currentValue = this.host[propName];
        this.setupObserver(propName, currentValue, config);
      }
    }
  }

  setupObserver(propName, value, config) {
    const oldDisposer = this.disposers.get(propName);
    const shouldObserve =
      config &&
      config.observe !== false &&
      value !== null &&
      value !== undefined &&
      typeof value === 'object';

    // Only dispose if we're not going to observe the new value
    if (oldDisposer && !shouldObserve) {
      oldDisposer();
      this.disposers.delete(propName);
    }

    // Set up new observer if needed
    if (shouldObserve && !this.disposers.has(propName)) {
      const callback = () => this.host.requestUpdate();
      const disposer = observe(value, callback, config.throttle);
      this.disposers.set(propName, disposer);
    }
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

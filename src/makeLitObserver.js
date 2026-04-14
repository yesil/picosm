import { observe } from './makeObservable.js';

class ObserverController {
  constructor(host) {
    this.host = host;
    this.disposers = new Map();
    this.observed = new Map();
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
    this.observed.clear();
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
    const shouldObserve =
      config?.observe === true &&
      value !== null &&
      value !== undefined &&
      typeof value === 'object';

    const currentlyObserved = this.observed.get(propName);

    // Dispose if value changed or we should no longer observe
    if (currentlyObserved !== undefined && (currentlyObserved !== value || !shouldObserve)) {
      this.disposers.get(propName)?.();
      this.disposers.delete(propName);
      this.observed.delete(propName);
    }

    // Set up new observer if needed
    if (shouldObserve && !this.disposers.has(propName)) {
      const callback = () => this.host.requestUpdate();
      const disposer = observe(value, callback, config.throttle);
      this.disposers.set(propName, disposer);
      this.observed.set(propName, value);
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

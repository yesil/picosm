// src/makeObservable.js
function instrumentAction(prototype, methodName) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
  if (descriptor && typeof descriptor.value === "function") {
    const originalMethod = descriptor.value;
    descriptor.value = originalMethod.constructor.name === "AsyncFunction" ? async function(...args) {
      const response = await originalMethod.call(this, ...args);
      this.__resetComputedProperties();
      this.__notifyObservers();
      return response;
    } : function(...args) {
      const response = originalMethod.call(this, ...args);
      this.__resetComputedProperties();
      this.__notifyObservers();
      return response;
    };
    Object.defineProperty(prototype, methodName, descriptor);
  }
}
function instrumentComputed(prototype, getterName) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, getterName);
  if (descriptor && typeof descriptor.get === "function") {
    const originalGetter = descriptor.get;
    descriptor.get = function() {
      if (!this.__computedProperties) {
        Object.defineProperty(this, "__computedProperties", {
          value: /* @__PURE__ */ new Map(),
          enumerable: false,
          writable: false
        });
      }
      if (this.__computedProperties.has(getterName)) {
        return this.__computedProperties.get(getterName);
      }
      const cachedValue = originalGetter.call(this);
      this.__computedProperties.set(getterName, cachedValue);
      return cachedValue;
    };
    Object.defineProperty(prototype, getterName, descriptor);
  }
}
function definePrivateProperty(instance, propertyName, initialValue) {
  Object.defineProperty(instance, propertyName, {
    value: initialValue,
    enumerable: false,
    writable: false
  });
}
function makeObservable(constructor) {
  Object.assign(constructor.prototype, {
    __notifyObservers() {
      this.__observers?.forEach((listener) => listener());
    },
    __resetComputedProperties() {
      this.__computedProperties?.clear();
    },
    __observe(callback) {
      if (!this.__observers) {
        definePrivateProperty(this, "__observers", /* @__PURE__ */ new Set());
      }
      this.__observers.add(callback);
      return () => this.__observers.delete(callback);
    },
    __subscribe(onMessageCallback) {
      if (!this.__subscribers) {
        definePrivateProperty(this, "__subscribers", /* @__PURE__ */ new Set());
      }
      this.__subscribers.add(onMessageCallback);
      return () => this.__subscribers.delete(onMessageCallback);
    }
  });
  const observableActions = constructor.observableActions ?? [];
  observableActions.forEach(
    (methodName) => instrumentAction(constructor.prototype, methodName)
  );
  const computedProperties = constructor.computedProperties ?? [];
  computedProperties.forEach(
    (propertyName) => instrumentComputed(constructor.prototype, propertyName)
  );
}
function observeSlow(target, callback, timeout) {
  let isThrottled = false;
  let pendingCallback = false;
  const listener = () => {
    if (isThrottled) {
      pendingCallback = true;
      return;
    }
    callback();
    isThrottled = true;
    setTimeout(() => {
      isThrottled = false;
      if (pendingCallback) {
        pendingCallback = false;
        callback();
      }
    }, timeout);
  };
  return target.__observe(listener);
}
function observe(target, callback, timeout) {
  return timeout ? observeSlow(target, callback, timeout) : target.__observe(callback);
}
function subscribe(target, onMessageCallback) {
  return target.__subscribe(onMessageCallback);
}
function notify(target, message) {
  target.__subscribers?.forEach((listener) => listener(message));
}

// src/reaction.js
function reaction(targetOrTargets, callback, execute, timeout) {
  let lastProps = [];
<<<<<<< HEAD
  const targets = Array.isArray(targetOrTargets) ? targetOrTargets : [targetOrTargets];
  const runner = () => {
    const props = targets.length === 1 ? callback(targets[0]) : callback(...targets);
    if (lastProps === props)
      return;
    let shouldExecute = false;
    for (let i = 0; i < props.length; i++) {
      if (lastProps[i] !== props[i]) {
        shouldExecute = true;
        break;
=======
  return observe(
    target,
    () => {
      const props = callback(target);
      if (lastProps === props) return;
      let shouldExecute = false;
      for (let i = 0; i < props.length; i++) {
        if (lastProps[i] !== props[i]) {
          shouldExecute = true;
          break;
        }
>>>>>>> d9ecd5e898e2cf61da756159510bf563cf971051
      }
    }
    if (shouldExecute) {
      lastProps = props;
      execute(...props);
    }
  };
  const disposers = targets.map((t) => observe(t, runner, timeout));
  return () => disposers.forEach((d) => d());
}

// src/track.js
function track(target, source) {
  const disposer = source.__observe?.(() => {
    target.__resetComputedProperties();
    target.__notifyObservers();
  });
  target.__resetComputedProperties();
  target.__notifyObservers();
  return disposer;
}

// src/makeLitObserver.js
var ObserverController = class {
  constructor(host) {
    this.host = host;
    this.disposers = /* @__PURE__ */ new Map();
    host.addController(this);
    const constructor = this.host.constructor;
    const descriptor = Object.getOwnPropertyDescriptor(
      constructor,
      "properties"
    );
    this.getProperties = () => {
      if (descriptor && descriptor.get) {
        return constructor.properties || {};
      }
      return constructor.hasOwnProperty("properties") ? constructor.properties : {};
    };
  }
  hostConnected() {
    const props = this.getProperties();
    for (const [propName, config] of Object.entries(props)) {
      this.setupObserver(propName, this.host[propName], config);
    }
  }
  hostDisconnected() {
    for (const disposer of this.disposers.values()) {
      disposer();
    }
    this.disposers.clear();
  }
  hostUpdate() {
    const props = this.getProperties();
    for (const [propName, config] of Object.entries(props)) {
      if (config && config.observe !== false) {
        const currentValue = this.host[propName];
        this.setupObserver(propName, currentValue, config);
      }
    }
  }
  setupObserver(propName, value, config) {
    const oldDisposer = this.disposers.get(propName);
    const shouldObserve = config?.observe === true && value !== null && value !== void 0 && typeof value === "object";
    if (oldDisposer && !shouldObserve) {
      oldDisposer();
      this.disposers.delete(propName);
    }
    if (shouldObserve && !this.disposers.has(propName)) {
      const callback = () => this.host.requestUpdate();
      const disposer = observe(value, callback, config.throttle);
      this.disposers.set(propName, disposer);
    }
  }
};
function makeLitObserver(constructor) {
  const originalConnectedCallback = constructor.prototype.connectedCallback;
  constructor.prototype.connectedCallback = function() {
    if (!this.__observer) {
      this.__observer = new ObserverController(this);
    }
    if (originalConnectedCallback) {
      originalConnectedCallback.call(this);
    }
  };
  return constructor;
}
export {
  makeLitObserver,
  makeObservable,
  notify,
  observe,
  reaction,
  subscribe,
  track
};

// src/makeObservable.js
function instrumentAction(target, methodName) {
  const prototype = Object.getPrototypeOf(target).prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
  if (descriptor && typeof descriptor.value === "function") {
    const originalMethod = descriptor.value;
    if (originalMethod.constructor.name === "AsyncFunction") {
      descriptor.value = async function(...args) {
        const response = await originalMethod.call(this, ...args);
        this.__resetComputedProperties();
        this.__notifyListeners();
        return response;
      };
    } else {
      descriptor.value = function(...args) {
        const response = originalMethod.call(this, ...args);
        this.__resetComputedProperties();
        this.__notifyListeners();
        return response;
      };
    }
    Object.defineProperty(prototype, methodName, descriptor);
  }
}
function instrumentComputed(target, getterName) {
  const prototype = Object.getPrototypeOf(target).prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, getterName);
  if (descriptor && typeof descriptor.get === "function") {
    const originalGetter = descriptor.get;
    descriptor.get = function() {
      if (this.__computedValues.has(getterName)) {
        return this.__computedValues.get(getterName);
      }
      const cachedValue = originalGetter.call(this);
      this.__computedValues.set(getterName, cachedValue);
      return cachedValue;
    };
    Object.defineProperty(prototype, getterName, descriptor);
  }
}
function makeObservable(constructor, actions = [], computeds = []) {
  class SuperClass extends constructor {
    constructor(...args) {
      super(...args);
      this.__observers = /* @__PURE__ */ new Set();
      this.__computedValues = /* @__PURE__ */ new Map();
      this.__dependencies = /* @__PURE__ */ new WeakMap();
    }
    __notifyListeners() {
      this.__observers.forEach((listener) => {
        listener();
      });
    }
    __resetComputedProperties() {
      this.__computedValues.clear();
    }
    __observe(callback) {
      this.__observers.add(callback);
      return () => {
        this.__observers.delete(callback);
      };
    }
  }
  actions.forEach((methodName) => {
    instrumentAction(SuperClass, methodName);
  });
  computeds.forEach((propertyName) => {
    instrumentComputed(SuperClass, propertyName);
  });
  return SuperClass;
}
function observe(target, callback) {
  return target.__observe(callback);
}

// src/reaction.js
function reaction(target, callback, execute) {
  let lastProps = [];
  return target.__observe(async () => {
    const props = callback(target);
    if (lastProps === props)
      return;
    let shouldExecute = false;
    for (let i = 0; i < props.length; i++) {
      if (lastProps[i] !== props[i]) {
        shouldExecute = true;
        break;
      }
    }
    if (shouldExecute) {
      lastProps = props;
      execute(...props);
    }
  });
}

// src/track.js
function track(target, source) {
  if (!target.__observers || !source?.__observers)
    return;
  const disposer = source.__observe(() => {
    target.__resetComputedProperties();
    target.__notifyListeners();
  });
  target.__dependencies.set(source, disposer);
  target.__resetComputedProperties();
  target.__notifyListeners();
}
function untrack(target, source) {
  if (!target.__observers || !source?.__observers)
    return;
  const disposer = target.__dependencies.get(source);
  if (disposer) {
    target.__dependencies.delete(source);
    disposer();
    target.__resetComputedProperties();
    target.__notifyListeners();
  }
}

// src/LitObserver.js
function makeObserver(constructor, properties) {
  return class LitObserver extends constructor {
    constructor(...args) {
      super(...args);
      this.observables = /* @__PURE__ */ new Set();
      this.disposers = /* @__PURE__ */ new Set();
    }
    trackProperties() {
      properties.forEach((property) => {
        const observable = this[property];
        if (!observable?.__observers)
          return;
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
export {
  makeObservable,
  makeObserver,
  observe,
  reaction,
  track,
  untrack
};

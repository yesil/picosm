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
function makeObservable(constructor2, actions = [], computeds = []) {
  class SuperClass extends constructor2 {
    constructor(...args) {
      super(...args);
      Object.defineProperties(
        this,
        {
          __observers: { value: /* @__PURE__ */ new Set() },
          __computedValues: { value: /* @__PURE__ */ new Map() },
          __dependencies: { value: /* @__PURE__ */ new WeakMap() }
        },
        {
          __observers: { enumerable: false, writable: false },
          __computedValues: { enumerable: false, writable: false },
          __dependencies: { enumerable: false, writable: false }
        }
      );
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
function observeSlow(timeout) {
  return (target, callback) => {
    let timer;
    const listener = () => {
      clearTimeout(timer);
      timer = setTimeout(callback, timeout);
    };
    return target.__observe(listener);
  };
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
function litObserver(constructor, properties) {
  class LitObserver extends constructor {
    #observables = /* @__PURE__ */ new Set();
    #disposers = /* @__PURE__ */ new Set();
    constructor(...args) {
      super(...args);
    }
    trackProperties() {
      properties.forEach((property) => {
        let observableProperty;
        let delay;
        let observeFn2 = observe;
        if (Array.isArray(property)) {
          observableProperty = this[property[0]];
          delay = property[1];
          observeFn2 = observeSlow(delay);
        } else {
          observableProperty = this[property];
        }
        if (!observableProperty?.__observers)
          return;
        if (this.#observables.has(observableProperty)) {
          return;
        }
        this.#observables.add(observableProperty);
        this.#disposers.add(
          observeFn2(observableProperty, this.requestUpdate.bind(this))
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
export {
  litObserver,
  makeObservable,
  observe,
  observeSlow,
  reaction,
  track,
  untrack
};

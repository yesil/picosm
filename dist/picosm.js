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
        this.__notifyObservers();
        return response;
      };
    } else {
      descriptor.value = function(...args) {
        const response = originalMethod.call(this, ...args);
        this.__resetComputedProperties();
        this.__notifyObservers();
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
      if (!this.__computedProperties) {
        Object.defineProperties(
          this,
          {
            __computedProperties: { value: /* @__PURE__ */ new Map() }
          },
          {
            __computedProperties: { enumerable: false, writable: false }
          }
        );
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
function makeObservable(constructor2, actions = [], computeds = []) {
  class SuperClass extends constructor2 {
    __notifyObservers() {
      this.__observers?.forEach((listener) => {
        listener();
      });
    }
    __resetComputedProperties() {
      this.__computedProperties?.clear();
    }
    __observe(callback) {
      if (!this.__observers) {
        Object.defineProperties(
          this,
          {
            __observers: { value: /* @__PURE__ */ new Set() }
          },
          {
            __observers: { enumerable: false, writable: false }
          }
        );
      }
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
function observeSlow(target, callback, timeout) {
  let timer;
  const listener = () => {
    clearTimeout(timer);
    timer = setTimeout(callback, timeout);
  };
  return target.__observe(listener);
}
function observe(target, callback, timeout) {
  if (timeout) {
    return observeSlow(target, callback, timeout);
  } else {
    return target.__observe(callback);
  }
}

// src/reaction.js
function reaction(target, callback, execute, timeout) {
  let lastProps = [];
  return observe(
    target,
    async () => {
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
    },
    timeout
  );
}

// src/track.js
function track(target, source) {
  const disposer = source.__observe?.(() => {
    target.__resetComputedProperties();
    target.__notifyObservers();
  });
  target.__resetComputedProperties();
  target.__notifyObservers();
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
        if (Array.isArray(property)) {
          observableProperty = this[property[0]];
          delay = property[1];
        } else {
          observableProperty = this[property];
        }
        if (this.#observables.has(observableProperty)) {
          return;
        }
        if (!observableProperty)
          return;
        this.#observables.add(observableProperty);
        this.#disposers.add(
          observe(observableProperty, this.requestUpdate.bind(this), delay)
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
export {
  litObserver,
  makeObservable,
  observe,
  reaction,
  track
};

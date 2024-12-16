function instrumentAction(target, methodName) {
  const prototype = Object.getPrototypeOf(target).prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);

  if (descriptor && typeof descriptor.value === 'function') {
    const originalMethod = descriptor.value;
    if (originalMethod.constructor.name === 'AsyncFunction') {
      descriptor.value = async function (...args) {
        const response = await originalMethod.call(this, ...args);
        this.__resetComputedProperties();
        this.__notifyObservers();
        return response;
      };
    } else {
      descriptor.value = function (...args) {
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

  if (descriptor && typeof descriptor.get === 'function') {
    const originalGetter = descriptor.get;

    descriptor.get = function () {
      if (!this.__computedProperties) {
        Object.defineProperties(
          this,
          {
            __computedProperties: { value: new Map() },
          },
          {
            __computedProperties: { enumerable: false, writable: false },
          },
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

export function makeObservable(constructor, actions = [], computeds = []) {
  class SuperClass extends constructor {
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
            __observers: { value: new Set() },
          },
          {
            __observers: { enumerable: false, writable: false },
          },
        );
      }
      this.__observers.add(callback);
      return () => {
        this.__observers.delete(callback);
      };
    }

    __subscribe(onMessageCallback) {
      if (!this.__subscribers) {
        Object.defineProperties(
          this,
          {
            __subscribers: { value: new Set() },
          },
          {
            __subscribers: { enumerable: false, writable: false },
          },
        );
      }
      this.__subscribers.add(onMessageCallback);
      return () => {
        this.__subscribers.delete(onMessageCallback);
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

export function observe(target, callback, timeout) {
  if (timeout) {
    return observeSlow(target, callback, timeout);
  } else {
    return target.__observe(callback);
  }
}

export function subscribe(target, onMessageCallback) {
  return target.__subscribe(onMessageCallback);
}

export function notify(target, message) {
  target.__subscribers?.forEach((listener) => {
    listener(message);
  });
}

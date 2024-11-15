function instrumentAction(target, methodName) {
  const prototype = Object.getPrototypeOf(target).prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);

  if (descriptor && typeof descriptor.value === 'function') {
    const originalMethod = descriptor.value;
    if (originalMethod.constructor.name === 'AsyncFunction') {
      descriptor.value = async function (...args) {
        const response = await originalMethod.call(this, ...args);
        this.__resetComputedProperties();
        this.__notifyListeners();
        return response;
      };
    } else {
      descriptor.value = function (...args) {
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

  if (descriptor && typeof descriptor.get === 'function') {
    const originalGetter = descriptor.get;

    descriptor.get = function () {
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

export function makeObservable(constructor, actions = [], computeds = []) {
  class SuperClass extends constructor {
    constructor(...args) {
      super(...args);
      this.__observers = new Set();
      this.__computedValues = new Map();
      this.__dependencies = new WeakMap();
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

export function observe(target, callback) {
  return target.__observe(callback);
}

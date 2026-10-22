import { assertObservable, reportAsync } from './internal.js';
import {
  activeTrace,
  beginCause,
  beginNotification,
  beginSpan,
  endAction,
  endComputed,
  endMessage,
  endNotification,
  traceAsyncAction,
  traceComputedHit,
  traceNotificationQueued,
} from './trace.js';

const ACTION = Symbol('picosm.action');
const COMPUTED = Symbol('picosm.computed');
// Instances with a notification already queued for the current microtask
const pendingNotifications = new WeakSet();

/**
 * Finds a property descriptor on the prototype or on one of its ancestors.
 * @param {Object} prototype - The prototype to start from
 * @param {string} name - The property name
 * @returns {PropertyDescriptor|undefined}
 */
function findDescriptor(prototype, name) {
  for (let proto = prototype; proto && proto !== Object.prototype; ) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, name);
    if (descriptor) return descriptor;
    proto = Object.getPrototypeOf(proto);
  }
  return undefined;
}

/**
 * Instruments an action method to notify observers and reset computed properties after execution,
 * including when it throws or its returned Promise rejects.
 * @param {Function} constructor - The class declaring the action
 * @param {string} methodName - The name of the method to instrument
 */
function instrumentAction(constructor, methodName) {
  const descriptor = findDescriptor(constructor.prototype, methodName);

  if (typeof descriptor?.value !== 'function') {
    throw new TypeError(
      `makeObservable(${constructor.name}): "${methodName}" is listed in observableActions but is not a method (arrow functions and other class fields cannot be instrumented)`,
    );
  }

  const originalMethod = descriptor.value;
  // Already instrumented by an observable base class
  if (originalMethod[ACTION]) return;

  descriptor.value = function (...args) {
    const settle = () => {
      this.__resetComputedProperties();
      this.__notifyObservers();
    };
    const span = beginCause();
    let response;
    try {
      response = originalMethod.call(this, ...args);
    } catch (error) {
      settle();
      if (span !== null) endAction(span, this, methodName, 'threw');
      throw error;
    }
    if (response instanceof Promise) {
      if (span === null) return response.finally(settle);
      const tracedSettle = traceAsyncAction(
        span,
        this,
        methodName,
        response,
        settle,
      );
      endAction(span, this, methodName, 'pending');
      return response.finally(tracedSettle);
    }
    settle();
    if (span !== null) endAction(span, this, methodName, 'returned');
    return response;
  };
  descriptor.value[ACTION] = true;

  Object.defineProperty(constructor.prototype, methodName, descriptor);
}

/**
 * Instruments a computed property to cache its value until invalidated.
 * @param {Function} constructor - The class declaring the computed property
 * @param {string} getterName - The name of the computed property
 */
function instrumentComputed(constructor, getterName) {
  const descriptor = findDescriptor(constructor.prototype, getterName);

  if (typeof descriptor?.get !== 'function') {
    throw new TypeError(
      `makeObservable(${constructor.name}): "${getterName}" is listed in computedProperties but is not a getter`,
    );
  }

  const originalGetter = descriptor.get;
  // Already instrumented by an observable base class
  if (originalGetter[COMPUTED]) return;

  descriptor.get = function () {
    // Initialize computed properties cache if it doesn't exist
    if (!this.__computedProperties) {
      definePrivateProperty(this, '__computedProperties', new Map());
    }

    // Keyed by getter so an overriding getter and super's getter keep separate values
    if (this.__computedProperties.has(originalGetter)) {
      if (activeTrace !== null) traceComputedHit(this, getterName);
      return this.__computedProperties.get(originalGetter);
    }

    // Calculate and cache the value
    const span = beginSpan();
    const cachedValue = originalGetter.call(this);
    this.__computedProperties.set(originalGetter, cachedValue);
    if (span !== null) endComputed(span, this, getterName);
    return cachedValue;
  };
  descriptor.get[COMPUTED] = true;

  Object.defineProperty(constructor.prototype, getterName, descriptor);
}

/**
 * Creates a private property on the instance with proper configuration
 * @param {Object} instance - The object to add the property to
 * @param {string} propertyName - The name of the property
 * @param {*} initialValue - The initial value for the property
 */
function definePrivateProperty(instance, propertyName, initialValue) {
  Object.defineProperty(instance, propertyName, {
    value: initialValue,
    enumerable: false,
    writable: false,
  });
}

/**
 * Reads a static name list (observableActions or computedProperties) from the class.
 * @param {Function} constructor - The class
 * @param {string} listName - The static property holding the list
 * @returns {string[]}
 */
function declaredNames(constructor, listName) {
  const names = constructor[listName] ?? [];
  if (!Array.isArray(names)) {
    throw new TypeError(
      `makeObservable(${constructor.name}): static ${listName} must be an array of names`,
    );
  }
  return names;
}

const observableMethods = {
  __notifyObservers() {
    if (activeTrace !== null) traceNotificationQueued(this);
    if (pendingNotifications.has(this)) return;
    pendingNotifications.add(this);
    queueMicrotask(() => {
      pendingNotifications.delete(this);
      const span = beginNotification(this);
      if (!this.__observers) {
        if (span !== null) endNotification(span, this, 0);
        return;
      }
      // Iterate a snapshot: observers added now wait for the next change
      const listeners = [...this.__observers];
      for (const listener of listeners) {
        // Skip observers disposed by an earlier observer in this pass
        if (!this.__observers.has(listener)) continue;
        try {
          listener();
        } catch (error) {
          // A failing observer must not keep the others from being notified
          reportAsync(error);
        }
      }
      if (span !== null) endNotification(span, this, listeners.length);
    });
  },

  __resetComputedProperties() {
    this.__computedProperties?.clear();
  },

  __observe(callback) {
    if (!this.__observers) {
      definePrivateProperty(this, '__observers', new Set());
    }
    this.__observers.add(callback);
    return () => this.__observers.delete(callback);
  },

  __subscribe(onMessageCallback) {
    if (!this.__subscribers) {
      definePrivateProperty(this, '__subscribers', new Set());
    }
    this.__subscribers.add(onMessageCallback);
    return () => this.__subscribers.delete(onMessageCallback);
  },
};

/**
 * Makes a class observable by adding reactive capabilities. Call it once, after the class declaration.
 * Supports action methods, computed properties, and observer/subscriber patterns.
 * Subclasses of an observable class can be passed too, to instrument their own declarations.
 * @param {Function} constructor - The class constructor to make observable
 */
export function makeObservable(constructor) {
  // Own check: a subclass inherits the flag of its observable base class
  if (Object.hasOwn(constructor, '__observable')) return;

  if (!('__observe' in constructor.prototype)) {
    for (const [name, value] of Object.entries(observableMethods)) {
      Object.defineProperty(constructor.prototype, name, {
        value,
        writable: true,
        configurable: true,
      });
    }
  }

  // Instrument observable actions
  for (const methodName of declaredNames(constructor, 'observableActions')) {
    instrumentAction(constructor, methodName);
  }

  // Instrument computed properties
  for (const propertyName of declaredNames(constructor, 'computedProperties')) {
    instrumentComputed(constructor, propertyName);
  }

  Object.defineProperty(constructor, '__observable', { value: true });
}

/**
 * Creates a throttled observer that triggers at most once per timeout period
 * @param {Object} target - The observable target
 * @param {Function} callback - The callback to execute
 * @param {number} timeout - The throttle timeout in milliseconds
 * @returns {Function} Cleanup function to remove the observer
 */
function observeSlow(target, callback, timeout) {
  let timer = null;
  let pendingCallback = false;

  // A change during the window runs once when it closes, which opens the next window
  const startWindow = () => {
    timer = setTimeout(() => {
      timer = null;
      if (pendingCallback) {
        pendingCallback = false;
        startWindow();
        callback();
      }
    }, timeout);
  };

  const listener = () => {
    if (timer !== null) {
      // Mark that a change occurred during throttle period
      pendingCallback = true;
      return;
    }
    startWindow();
    callback();
  };

  const stopObserving = target.__observe(listener);
  return () => {
    stopObserving();
    clearTimeout(timer);
    timer = null;
    pendingCallback = false;
  };
}

function assertCallback(callback, caller) {
  if (typeof callback !== 'function') {
    throw new TypeError(`picosm: ${caller} expects a callback function`);
  }
}

/**
 * Observes changes in an observable instance with optional throttling
 * @param {Object} target - The observable target
 * @param {Function} callback - The callback to execute on changes
 * @param {number} [timeout] - Optional throttle timeout in milliseconds
 * @returns {Function} Cleanup function to remove the observer
 */
export function observe(target, callback, timeout) {
  assertObservable(target, 'observe()');
  assertCallback(callback, 'observe()');
  return timeout != null && timeout > 0
    ? observeSlow(target, callback, timeout)
    : target.__observe(callback);
}

/**
 * Subscribes to messages from an observable instance
 * @param {Object} target - The observable target
 * @param {Function} onMessageCallback - Callback to handle messages
 * @returns {Function} Cleanup function to remove the subscriber
 */
export function subscribe(target, onMessageCallback) {
  assertObservable(target, 'subscribe()');
  assertCallback(onMessageCallback, 'subscribe()');
  return target.__subscribe(onMessageCallback);
}

/**
 * Sends a message to all subscribers of an observable instance
 * @param {Object} target - The observable target
 * @param {*} message - The message to send to subscribers
 */
export function notify(target, message) {
  assertObservable(target, 'notify()');
  if (!target.__subscribers) return;
  const span = beginSpan();
  const listeners = [...target.__subscribers];
  for (const listener of listeners) {
    if (target.__subscribers.has(listener)) listener(message);
  }
  if (span !== null) endMessage(span, target, listeners.length);
}

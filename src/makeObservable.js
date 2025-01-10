/**
 * Instruments an action method to notify observers and reset computed properties after execution.
 * @param {Object} prototype - The prototype object containing the method
 * @param {string} methodName - The name of the method to instrument
 */
function instrumentAction(prototype, methodName) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);

  if (descriptor && typeof descriptor.value === 'function') {
    const originalMethod = descriptor.value;

    // Create a wrapper that maintains the original method's async/sync nature
    descriptor.value =
      originalMethod.constructor.name === 'AsyncFunction'
        ? async function (...args) {
            const response = await originalMethod.call(this, ...args);
            this.__resetComputedProperties();
            this.__notifyObservers();
            return response;
          }
        : function (...args) {
            const response = originalMethod.call(this, ...args);
            this.__resetComputedProperties();
            this.__notifyObservers();
            return response;
          };

    Object.defineProperty(prototype, methodName, descriptor);
  }
}

/**
 * Instruments a computed property to cache its value until invalidated.
 * @param {Object} prototype - The prototype object containing the getter
 * @param {string} getterName - The name of the computed property
 */
function instrumentComputed(prototype, getterName) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, getterName);

  if (descriptor && typeof descriptor.get === 'function') {
    const originalGetter = descriptor.get;

    descriptor.get = function () {
      // Initialize computed properties cache if it doesn't exist
      if (!this.__computedProperties) {
        Object.defineProperty(this, '__computedProperties', {
          value: new Map(),
          enumerable: false,
          writable: false,
        });
      }

      // Return cached value if available
      if (this.__computedProperties.has(getterName)) {
        return this.__computedProperties.get(getterName);
      }

      // Calculate and cache the value
      const cachedValue = originalGetter.call(this);
      this.__computedProperties.set(getterName, cachedValue);
      return cachedValue;
    };

    Object.defineProperty(prototype, getterName, descriptor);
  }
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
 * Decorator function that makes a class observable by adding reactive capabilities.
 * Supports action methods, computed properties, and observer/subscriber patterns.
 * @param {Function} constructor - The class constructor to make observable
 */
export function makeObservable(constructor) {
  Object.assign(constructor.prototype, {
    __notifyObservers() {
      this.__observers?.forEach((listener) => listener());
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
  });

  // Instrument observable actions
  const observableActions = constructor.observableActions ?? [];
  observableActions.forEach((methodName) =>
    instrumentAction(constructor.prototype, methodName),
  );

  // Instrument computed properties
  const computedProperties = constructor.computedProperties ?? [];
  computedProperties.forEach((propertyName) =>
    instrumentComputed(constructor.prototype, propertyName),
  );
}

/**
 * Creates a throttled observer that triggers at most once per timeout period
 * @param {Object} target - The observable target
 * @param {Function} callback - The callback to execute
 * @param {number} timeout - The throttle timeout in milliseconds
 * @returns {Function} Cleanup function to remove the observer
 */
function observeSlow(target, callback, timeout) {
  let isThrottled = false;
  let pendingCallback = false;

  const listener = () => {
    if (isThrottled) {
      // Mark that a change occurred during throttle period
      pendingCallback = true;
      return;
    }

    // Execute callback immediately
    callback();
    isThrottled = true;

    // Start throttle timer
    setTimeout(() => {
      isThrottled = false;
      // If changes occurred during throttle period, execute one more time
      if (pendingCallback) {
        pendingCallback = false;
        callback();
      }
    }, timeout);
  };

  return target.__observe(listener);
}

/**
 * Observes changes in an observable instance with optional debouncing
 * @param {Object} target - The observable target
 * @param {Function} callback - The callback to execute on changes
 * @param {number} [timeout] - Optional timeout for debouncing
 * @returns {Function} Cleanup function to remove the observer
 */
export function observe(target, callback, timeout) {
  return timeout
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
  return target.__subscribe(onMessageCallback);
}

/**
 * Sends a message to all subscribers of an observable instance
 * @param {Object} target - The observable target
 * @param {*} message - The message to send to subscribers
 */
export function notify(target, message) {
  target.__subscribers?.forEach((listener) => listener(message));
}

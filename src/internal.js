function describe(value) {
  if (typeof value === 'function') return `the class/function ${value.name || '(anonymous)'}`;
  if (value === null || typeof value !== 'object') return String(value);
  return `an instance of ${value.constructor?.name || 'Object'}`;
}

/**
 * Throws a descriptive error unless the target is an instance of a class passed to makeObservable.
 * @param {*} target - The value to check
 * @param {string} caller - The API name used in the error message
 */
export function assertObservable(target, caller) {
  if (typeof target?.__observe !== 'function') {
    throw new TypeError(
      `picosm: ${caller} expects an instance of a class passed to makeObservable(), got ${describe(target)}`,
    );
  }
}

/**
 * Reports an error as uncaught without interrupting the loop that caught it.
 * @param {*} error - The error to report
 */
export function reportAsync(error) {
  queueMicrotask(() => {
    throw error;
  });
}

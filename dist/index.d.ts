/** Instance of a class instrumented by makeObservable */
export interface ObservableTarget {
  __notifyObservers(): void;
  __resetComputedProperties(): void;
  __observe(callback: () => void): () => void;
  __subscribe(onMessageCallback: (message: any) => void): () => void;
  [key: string]: any;
}

/** Constructor passed to makeObservable */
export interface ObservableConstructor {
  new (...args: any[]): ObservableTarget;
  prototype: ObservableTarget;
  observableActions?: string[];
  computedProperties?: string[];
}

/** Cleanup function returned by observe, reaction, track, subscribe */
export type Disposer = () => void;

/**
 * Makes a class observable. Call once per class, after the class declaration.
 * The class should declare `static observableActions` and optionally `static computedProperties`.
 * Calling twice on the same class is a no-op.
 */
export function makeObservable(constructor: ObservableConstructor): void;

/**
 * Observes changes on an observable instance.
 * Notifications are batched via microtask — multiple synchronous actions produce a single callback.
 * @param target - The observable instance
 * @param callback - Fires when an observable action completes
 * @param timeout - Optional throttle in milliseconds
 * @returns Disposer function
 */
export function observe(target: ObservableTarget, callback: () => void, timeout?: number): Disposer;

/**
 * Subscribes to messages sent via `notify`. Messages are delivered synchronously.
 * @param target - The observable instance
 * @param onMessageCallback - Receives the message payload
 * @returns Disposer function
 */
export function subscribe(target: ObservableTarget, onMessageCallback: (message: any) => void): Disposer;

/**
 * Sends a message to all subscribers of an observable instance.
 * @param target - The observable instance
 * @param message - Any value to broadcast
 */
export function notify(target: ObservableTarget, message: any): void;

/**
 * Reacts to specific value changes on one or more observable targets.
 * The selector returns an array of values; the effect runs when that array changes element-wise.
 * Return an empty array from the selector to skip execution.
 * @param target - Single observable target
 * @param selector - Extracts values to watch
 * @param effect - Runs with the extracted values when they change
 * @param timeout - Optional throttle in milliseconds
 * @returns Disposer function
 */
export function reaction<T extends any[]>(
  target: ObservableTarget,
  selector: (target: ObservableTarget) => T,
  effect: (...props: T) => void,
  timeout?: number
): Disposer;

/**
 * Multi-target reaction. The selector receives all targets as positional arguments.
 */
export function reaction<T extends any[]>(
  targets: ObservableTarget[],
  selector: (...targets: ObservableTarget[]) => T,
  effect: (...props: T) => void,
  timeout?: number
): Disposer;

/**
 * Forwards notifications from source to target.
 * When source's actions fire, target's observers are notified and computed properties invalidated.
 * @param target - The observable to notify
 * @param source - The observable to watch
 * @returns Disposer function
 */
export function track(target: ObservableTarget, source: ObservableTarget): Disposer;

/**
 * Enhances a LitElement class to automatically observe properties with `observe: true`.
 * Supports `throttle` option on property config. Re-binds when property values change.
 * @param constructor - A LitElement class
 * @returns The same constructor (for chaining)
 */
export function makeLitObserver<T extends new (...args: any[]) => any>(constructor: T): T;

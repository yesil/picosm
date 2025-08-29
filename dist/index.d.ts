// Type placeholder for instances of classes decorated with makeObservable
export interface ObservableTarget {
  // Internal methods added by makeObservable
  __notifyObservers(): void;
  __resetComputedProperties(): void;
  __observe(callback: () => void): () => void; // Returns disposer
  __subscribe(onMessageCallback: (message: any) => void): () => void; // Returns disposer

  // Optional internal properties (assuming they might exist)
  __observers?: Set<() => void>;
  __subscribers?: Set<(message: any) => void>;
  __computedProperties?: Map<string, any>;

  // Allow any other properties
  [key: string]: any;
}

// Interface for the constructor passed to makeObservable
export interface ObservableConstructor {
  new (...args: any[]): ObservableTarget;
  prototype: ObservableTarget;
  observableActions?: string[];
  computedProperties?: string[];
}

// Disposer function returned by observers/subscribers/reactions
export type Disposer = () => void;

/**
 * Decorator function that makes a class observable by adding reactive capabilities.
 * Supports action methods, computed properties, and observer/subscriber patterns.
 * @param constructor - The class constructor to make observable
 */
export function makeObservable(constructor: ObservableConstructor): void;

/**
 * Observes changes in an observable instance with optional debouncing/throttling.
 * @param target - The observable target instance.
 * @param callback - The callback to execute on changes.
 * @param timeout - Optional timeout in milliseconds for throttling.
 * @returns Cleanup function to remove the observer.
 */
export function observe(target: ObservableTarget, callback: () => void, timeout?: number): () => void;

/**
 * Subscribes to messages broadcasted from an observable instance.
 * @param target - The observable target instance.
 * @param onMessageCallback - Callback to handle messages. Receives the message as an argument.
 * @returns Cleanup function to remove the subscriber.
 */
export function subscribe(target: ObservableTarget, onMessageCallback: (message: any) => void): () => void;

/**
 * Sends a message to all subscribers of an observable instance.
 * @param target - The observable target instance.
 * @param message - The message to send to subscribers.
 */
export function notify(target: ObservableTarget, message: any): void;

/**
 * Creates a reaction that runs a side effect when selected data changes.
 * @param target - The observable target instance.
 * @param callback - A function that tracks observable properties and returns an array of their values.
 * @param execute - A function that runs when the values returned by `callback` change. Receives the values as arguments.
 * @param timeout - Optional timeout in milliseconds for debouncing/throttling the reaction.
 * @returns Cleanup function to remove the reaction.
 */
export function reaction<T extends any[]>(
  target: ObservableTarget,
  callback: (target: ObservableTarget) => T,
  execute: (...props: T) => void,
  timeout?: number
): Disposer;

export function reaction<T extends any[]>(
  targets: [ObservableTarget, ...ObservableTarget[]],
  callback: (...targets: ObservableTarget[]) => T,
  execute: (...props: T) => void,
  timeout?: number
): Disposer;


/**
 * Tracks changes in a source observable and triggers updates in a target observable.
 * When the source notifies observers, the target's computed properties are reset, and its observers are notified.
 * @param target - The target observable instance whose observers will be notified.
 * @param source - The source observable instance to track changes from.
 * @returns Cleanup function to stop tracking.
 */
export function track(target: ObservableTarget, source: ObservableTarget): () => void; 

/**
 * Enhances a LitElement-like class to observe reactive properties on instances.
 * Returns the same constructor for chaining.
 * @param constructor - A class with LitController lifecycle hooks
 */
export function makeLitObserver<T extends new (...args: any[]) => any>(constructor: T): T;

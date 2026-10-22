/** Runtime shape of an instance whose class was passed to makeObservable */
export interface ObservableTarget {
  __notifyObservers(): void;
  __resetComputedProperties(): void;
  __observe(callback: () => void): () => void;
  __subscribe(onMessageCallback: (message: any) => void): () => void;
}

/** Class passed to makeObservable */
export interface ObservableConstructor {
  new (...args: any[]): object;
  observableActions?: readonly string[];
  computedProperties?: readonly string[];
}

/** Cleanup function returned by observe, reaction, track, subscribe */
export type Disposer = () => void;

/**
 * Makes a class observable. Call once per class, after the class declaration.
 * The class should declare `static observableActions` and optionally `static computedProperties`.
 * Throws a TypeError when a listed name is not a method (actions) or a getter (computed properties).
 * Subclasses of an observable class can be passed too, to instrument their own declarations.
 * Calling twice on the same class is a no-op.
 */
export function makeObservable(constructor: ObservableConstructor): void;

/**
 * Observes changes on an observable instance.
 * Notifications are batched via microtask — multiple synchronous actions produce a single callback.
 * @param target - An instance of a class passed to makeObservable
 * @param callback - Fires when an observable action completes, throws or rejects
 * @param timeout - Optional throttle in milliseconds: at most one call per window, trailing call included
 * @returns Disposer function
 */
export function observe(target: object, callback: () => void, timeout?: number): Disposer;

/**
 * Subscribes to messages sent via `notify`. Messages are delivered synchronously.
 * @param target - An instance of a class passed to makeObservable
 * @param onMessageCallback - Receives the message payload
 * @returns Disposer function
 */
export function subscribe<M = any>(target: object, onMessageCallback: (message: M) => void): Disposer;

/**
 * Sends a message to all subscribers of an observable instance.
 * @param target - An instance of a class passed to makeObservable
 * @param message - Any value to broadcast
 */
export function notify(target: object, message: any): void;

/**
 * Multi-target reaction. The selector receives all targets as positional arguments.
 */
export function reaction<S extends object[], T extends any[]>(
  targets: [...S],
  selector: (...targets: S) => T,
  effect: (...props: T) => void,
  timeout?: number
): Disposer;

/**
 * Reacts to specific value changes on an observable target.
 * The selector runs immediately to record the starting values, then after each action;
 * the effect runs when the returned array changes element-wise (Object.is).
 * Return an empty array from the selector to skip execution.
 * @param target - An instance of a class passed to makeObservable
 * @param selector - Extracts values to watch; must return an array
 * @param effect - Runs with the extracted values when they change
 * @param timeout - Optional throttle in milliseconds
 * @returns Disposer function
 */
export function reaction<S extends object, T extends any[]>(
  target: S,
  selector: (target: S) => T,
  effect: (...props: T) => void,
  timeout?: number
): Disposer;

/**
 * Forwards notifications from source to target.
 * When source's actions fire, target's observers are notified and computed properties invalidated.
 * Throws if the link would create a notification cycle.
 * @param target - The observable to notify
 * @param source - The observable to watch
 * @returns Disposer function
 */
export function track(target: object, source: object): Disposer;

/**
 * Enhances a LitElement class to automatically observe properties declared with `observe: true`,
 * including inherited ones.
 * Supports `throttle` option on property config. Re-binds when property values change.
 * @param constructor - A LitElement class
 * @returns The same constructor (for chaining)
 */
export function makeLitObserver<T extends new (...args: any[]) => any>(constructor: T): T;

/** Options for startTrace */
export interface TraceOptions {
  /** Most events to record (default 100000). Later events are counted in otherData.droppedEventCount. */
  maxEvents?: number;
}

/** One event in the Chrome trace event format */
export interface TraceEvent {
  name: string;
  /** X: a span, M: process and thread names */
  ph: 'X' | 'M';
  pid: number;
  tid: number;
  cat?: string;
  /** Microseconds on the performance.now() clock */
  ts?: number;
  /** Microseconds */
  dur?: number;
  args: Record<string, unknown>;
}

/** The updates of every view element with one tag name during a trace */
export interface TraceViewSummary {
  /** Updates, first updates and those past maxEvents included */
  updates: number;
  /** updates divided by the trace's duration in seconds; null when the trace lasted 0 ms on the browser's rounded clock */
  updatesPerSecond: number | null;
  /** Milliseconds spent in those updates */
  totalMs: number;
}

/** A recorded trace in the Chrome trace event format, ready for JSON.stringify */
export interface Trace {
  traceEvents: TraceEvent[];
  displayTimeUnit: 'ms';
  otherData: {
    /** performance.now() when the trace started, the startTime of its 'picosm trace start' mark */
    startTime: number;
    /** performance.now() when the trace stopped */
    endTime: number;
    /** Events not recorded because the trace reached maxEvents */
    droppedEventCount: number;
    /** Per view tag name, the views with the most time spent in updates first */
    views: Record<string, TraceViewSummary>;
  };
}

/**
 * Starts recording which store changes ask Lit views made with makeLitObserver to update, and each
 * update's duration, summed up per view. Records names, counts and timings only, never store
 * values. Adds a 'picosm trace start' performance mark.
 * Throws when a trace is already recording, or when maxEvents is not a positive integer.
 */
export function startTrace(options?: TraceOptions): void;

/**
 * Stops recording and returns the trace, which Perfetto and the Chrome DevTools Performance panel open.
 * Throws when no trace is recording.
 */
export function stopTrace(): Trace;

export * from './router';

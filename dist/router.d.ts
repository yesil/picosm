import { ObservableTarget } from './index';

export interface RouteData {
  path: string;
  query: Record<string, string>;
  hash: Record<string, string>;
}

export interface URLParts {
  path?: string;
  query?: Record<string, string>;
  hash?: Record<string, string>;
  /** When true, store-triggered URL changes use replaceState instead of pushState. */
  replace?: boolean;
}

export interface RegisterOptions {
  /** Receives parsed URL data. Called on registration, popstate, navigate, replace. */
  onRoute?: (data: RouteData) => void;
  /** Returns the store's contribution to the URL. Router merges all results. */
  toURL?: () => URLParts;
  /** Navigation guard. Return false (or Promise<false>) to block navigation. Guards run sequentially — first rejection short-circuits. */
  before?: (destination: RouteData) => boolean | Promise<boolean>;
}

export interface Router {
  /** Register a store. Returns a disposer to unregister. */
  register(store: ObservableTarget, options: RegisterOptions): () => void;
  /** pushState + calls all onRoute handlers. Awaits before guards first. */
  navigate(path: string, opts?: { query?: Record<string, string>; hash?: Record<string, string> }): Promise<void>;
  /** replaceState + calls all onRoute handlers. Awaits before guards first. */
  replace(path: string, opts?: { query?: Record<string, string>; hash?: Record<string, string> }): Promise<void>;
  /** history.back() */
  back(): void;
  /** history.forward() */
  forward(): void;
  /** Bound click handler for <a> event delegation. */
  go(event: Event): void;
  /** Removes all listeners and store registrations. */
  destroy(): void;
}

/** Creates a router that coordinates multiple stores with the browser History API. */
export function createRouter(): Router;

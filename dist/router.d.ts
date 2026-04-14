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
}

export interface RegisterOptions {
  /** Receives parsed URL data. Called on registration, popstate, navigate, replace. */
  onRoute?: (data: RouteData) => void;
  /** Returns the store's contribution to the URL. Router merges all results. */
  toURL?: () => URLParts;
}

export interface Router {
  /** Register a store. Returns a disposer to unregister. */
  register(store: ObservableTarget, options: RegisterOptions): () => void;
  /** pushState + calls all onRoute handlers. */
  navigate(path: string, opts?: { query?: Record<string, string>; hash?: Record<string, string> }): void;
  /** replaceState + calls all onRoute handlers. */
  replace(path: string, opts?: { query?: Record<string, string>; hash?: Record<string, string> }): void;
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

export interface RouteData {
  path: string;
  query: Record<string, string>;
  hash: Record<string, string>;
}

export type ParamValue = string | number | boolean | null | undefined;

export interface URLParts {
  path?: string;
  /** null/undefined/'' values omit the key. */
  query?: Record<string, ParamValue>;
  /** null/undefined values omit the key; '' produces a bare key (#intro). */
  hash?: Record<string, ParamValue>;
  /** When true, store-triggered URL changes use replaceState instead of pushState. */
  replace?: boolean;
}

export interface RegisterOptions {
  /**
   * Receives parsed URL data. Called on registration, popstate, navigate, replace.
   * On registration, values stored under `key` fill in the query/hash keys missing from the URL.
   */
  onRoute?: (data: RouteData) => void;
  /** Returns the store's contribution to the URL. Router merges the results of all stores. */
  toURL?: () => URLParts;
  /** Navigation guard. Return false (or Promise<false>) to block navigation. Guards run sequentially — first rejection short-circuits. */
  before?: (destination: RouteData) => boolean | Promise<boolean>;
  /** Persists the query and hash of toURL() on every change and restores them on registration. Requires onRoute, toURL and key. */
  storage?: Storage;
  /** Storage key, required with `storage`. */
  key?: string;
}

export interface NavigateOptions {
  /** Merged over the query string of the path. */
  query?: Record<string, ParamValue>;
  /** Merged over the hash of the path. */
  hash?: Record<string, ParamValue>;
}

export interface Router {
  /** Register a store. Returns a disposer to unregister. */
  register(store: object, options: RegisterOptions): () => void;
  /**
   * Goes to exactly this URL: pushState (replaceState when it is the current URL) + calls all onRoute handlers.
   * The path may be relative and include a query string and a hash. Awaits before guards first.
   */
  navigate(path: string, opts?: NavigateOptions): Promise<void>;
  /** Same as navigate, with replaceState. */
  replace(path: string, opts?: NavigateOptions): Promise<void>;
  /** history.back() */
  back(): void;
  /** history.forward() */
  forward(): void;
  /**
   * Bound click handler for event delegation on elements with href.
   * Leaves external, new-tab, download, modified and already handled clicks, and same-page anchors, to the browser.
   */
  go(event: Event): void;
  /** Removes all listeners and store registrations. */
  destroy(): void;
}

/** Creates a router that coordinates multiple stores with the browser History API. */
export function createRouter(): Router;

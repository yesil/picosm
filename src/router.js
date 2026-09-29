import { observe } from './makeObservable.js';
import { assertObservable } from './internal.js';

function parseParams(str) {
  return Object.fromEntries(new URLSearchParams(str));
}

function parseQuery(search) {
  return parseParams(search);
}

function parseHash(hash) {
  return parseParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

// null/undefined always omit a key; '' omits a query key but keeps a bare hash key (#intro)
function serializeParams(params, keepEmpty, sorted) {
  const entries = Object.entries(params).filter(
    ([, value]) => value != null && (keepEmpty || value !== ''),
  );
  if (sorted) entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries
    .map(([key, value]) => {
      const pair = new URLSearchParams([[key, value]]).toString();
      return value === '' ? pair.slice(0, -1) : pair;
    })
    .join('&');
}

function serializeQuery(query, sorted) {
  const str = serializeParams(query, false, sorted);
  return str ? `?${str}` : '';
}

function serializeHash(hash, sorted) {
  const str = serializeParams(hash, true, sorted);
  return str ? `#${str}` : '';
}

function parseURL() {
  return {
    path: window.location.pathname,
    query: parseQuery(window.location.search),
    hash: parseHash(window.location.hash),
  };
}

function buildURL(route) {
  return `${route.path}${serializeQuery(route.query)}${serializeHash(route.hash)}`;
}

// Order-insensitive identity of a route or of a toURL() result
function routeKey(parts) {
  return JSON.stringify([
    parts.path ?? null,
    serializeQuery(parts.query ?? {}, true),
    serializeHash(parts.hash ?? {}, true),
  ]);
}

function resolveRoute(path, opts = {}) {
  if (typeof path !== 'string') {
    throw new TypeError('picosm router: navigate() and replace() expect a path string');
  }
  const url = new URL(path, document.baseURI);
  if (url.origin !== window.location.origin) {
    throw new Error(
      `picosm router: cannot navigate to "${path}", only same-origin URLs are supported`,
    );
  }
  return {
    path: url.pathname,
    query: { ...parseQuery(url.search), ...opts.query },
    hash: { ...parseHash(url.hash), ...opts.hash },
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateOptions(store, options) {
  if (!isPlainObject(options)) {
    throw new TypeError('picosm router: register(store, options) requires an options object');
  }
  for (const name of ['onRoute', 'toURL', 'before']) {
    if (options[name] != null && typeof options[name] !== 'function') {
      throw new TypeError(`picosm router: register() option "${name}" must be a function`);
    }
  }
  if (options.toURL) assertObservable(store, 'router.register() with toURL');
  if (options.storage != null) {
    if (!options.onRoute || !options.toURL) {
      throw new TypeError(
        'picosm router: register() option "storage" requires both "onRoute" and "toURL"',
      );
    }
    if (typeof options.key !== 'string' || options.key === '') {
      throw new TypeError(
        'picosm router: register() option "storage" requires a non-empty string "key"',
      );
    }
  }
}

function readStored(storage, key) {
  const raw = storage.getItem(key);
  if (raw == null) return null;
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (error) {
    throw new Error(`picosm router: stored value for key "${key}" is not valid JSON`, {
      cause: error,
    });
  }
  const valid =
    isPlainObject(saved) &&
    (saved.query == null || isPlainObject(saved.query)) &&
    (saved.hash == null || isPlainObject(saved.hash));
  if (!valid) {
    throw new TypeError(
      `picosm router: stored value for key "${key}" must be an object like { query, hash }`,
    );
  }
  return saved;
}

export function createRouter() {
  const registrations = [];
  let current = parseURL();
  // Store changes caused by applying a route canonicalize the URL instead of adding history entries
  let applyingRoute = 0;

  function applying(callback) {
    applyingRoute++;
    try {
      callback();
    } finally {
      // Queued after the store notifications that callback() triggered
      queueMicrotask(() => applyingRoute--);
    }
  }

  async function checkGuards(destination) {
    for (const reg of [...registrations]) {
      if (reg.disposed || !reg.options.before) continue;
      const allowed = await reg.options.before(destination);
      if (!allowed) return false;
    }
    return true;
  }

  function notifyStores(route) {
    const errors = [];
    applying(() => {
      for (const reg of [...registrations]) {
        if (reg.disposed || !reg.options.onRoute) continue;
        try {
          reg.options.onRoute(route);
        } catch (error) {
          errors.push(error);
        }
      }
    });
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'picosm router: several onRoute handlers threw');
    }
  }

  function write(route, replace) {
    const url = buildURL(route);
    if (replace) {
      history.replaceState(null, '', url);
    } else {
      history.pushState(null, '', url);
    }
    current = route;
  }

  function readURL(reg) {
    const parts = reg.options.toURL();
    if (!isPlainObject(parts)) {
      throw new TypeError(
        `picosm router: toURL() registered for ${reg.store.constructor?.name} must return an object`,
      );
    }
    return parts;
  }

  function cacheURL(reg, parts) {
    reg.cachedURL = parts;
    reg.cachedKey = routeKey(parts);
    if (parts.query) reg.ownsQuery = true;
    if (parts.hash) reg.ownsHash = true;
  }

  function mergedRoute() {
    const url = parseURL();
    // Like the path, a part of the URL no store has produced yet keeps its current value
    const route = {
      path: url.path,
      query: registrations.some((reg) => reg.ownsQuery) ? {} : url.query,
      hash: registrations.some((reg) => reg.ownsHash) ? {} : url.hash,
    };
    for (const reg of registrations) {
      const parts = reg.cachedURL;
      if (!parts) continue;
      if (parts.path != null) route.path = parts.path;
      Object.assign(route.query, parts.query);
      Object.assign(route.hash, parts.hash);
    }
    return route;
  }

  // Rebuilds the URL from every store, so stores that change together produce one history entry
  function syncStores() {
    let changed = false;
    let push = false;
    for (const reg of registrations) {
      if (!reg.options.toURL) continue;
      const parts = readURL(reg);
      if (routeKey(parts) === reg.cachedKey) continue;
      cacheURL(reg, parts);
      changed = true;
      if (!parts.replace) push = true;
      if (reg.options.storage) {
        const { query, hash } = parts;
        reg.options.storage.setItem(reg.options.key, JSON.stringify({ query, hash }));
      }
    }
    if (!changed) return;
    const route = mergedRoute();
    if (routeKey(route) === routeKey(current)) return;
    write(route, !push || applyingRoute > 0);
  }

  async function navigateTo(path, opts, replace) {
    const route = resolveRoute(path, opts);
    if (!(await checkGuards(route))) return;
    // Navigating to the current URL replaces the entry instead of duplicating it
    write(route, replace || routeKey(route) === routeKey(current));
    notifyStores(route);
  }

  async function onPopState() {
    const route = parseURL();
    let allowed = false;
    try {
      allowed = await checkGuards(route);
    } finally {
      // Guard rejected or threw: the browser already moved, push the previous URL back
      if (!allowed) history.pushState(null, '', buildURL(current));
    }
    if (!allowed) return;
    current = route;
    notifyStores(route);
  }

  window.addEventListener('popstate', onPopState);

  const router = {
    register(store, options) {
      validateOptions(store, options);
      const reg = {
        store,
        options,
        cachedURL: null,
        cachedKey: null,
        ownsQuery: false,
        ownsHash: false,
        disposer: null,
        disposed: false,
      };
      // Stored query/hash values fill in the keys missing from the current URL
      let route = parseURL();
      const saved = options.storage ? readStored(options.storage, options.key) : null;
      if (saved) {
        route = {
          path: route.path,
          query: { ...saved.query, ...route.query },
          hash: { ...saved.hash, ...route.hash },
        };
      }

      if (options.toURL) cacheURL(reg, readURL(reg));
      if (options.onRoute) applying(() => options.onRoute(route));

      registrations.push(reg);
      if (options.toURL) reg.disposer = observe(store, () => syncStores());

      return () => {
        if (reg.disposed) return;
        reg.disposed = true;
        registrations.splice(registrations.indexOf(reg), 1);
        reg.disposer?.();
      };
    },

    navigate(path, opts) {
      return navigateTo(path, opts, false);
    },

    replace(path, opts) {
      return navigateTo(path, opts, true);
    },

    back() {
      history.back();
    },

    forward() {
      history.forward();
    },

    destroy() {
      window.removeEventListener('popstate', onPopState);
      for (const reg of registrations) {
        reg.disposed = true;
        reg.disposer?.();
      }
      registrations.length = 0;
    },
  };

  // Bound click handler for event delegation on elements with href
  router.go = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // composedPath() also reaches links inside the shadow roots of nested components
    const el = event
      .composedPath()
      .find((node) => node instanceof Element && node.hasAttribute('href'));
    if (!el) return;
    const target = el.getAttribute('target');
    if ((target && target !== '_self') || el.hasAttribute('download')) return;
    let url;
    try {
      url = new URL(el.getAttribute('href'), document.baseURI);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    const samePage =
      url.pathname === window.location.pathname && url.search === window.location.search;
    // Same-page anchors: the browser scrolls and fires popstate, which notifies the stores
    if (samePage && url.hash) return;
    event.preventDefault();
    router.navigate(url.pathname + url.search + url.hash);
  };

  return router;
}

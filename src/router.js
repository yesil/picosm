import { observe } from './makeObservable.js';

function parseQuery(search) {
  const params = new URLSearchParams(search);
  const obj = {};
  for (const [key, value] of params) {
    obj[key] = value;
  }
  return obj;
}

function serializeQuery(obj) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value != null && value !== '') {
      params.set(key, value);
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

function parseHash(hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return {};
  const params = new URLSearchParams(raw);
  const obj = {};
  for (const [key, value] of params) {
    obj[key] = value;
  }
  return obj;
}

function serializeHash(obj) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value != null && value !== '') {
      params.set(key, value);
    }
  }
  const str = params.toString();
  return str ? `#${str}` : '';
}

function parseURL() {
  return {
    path: window.location.pathname,
    query: parseQuery(window.location.search),
    hash: parseHash(window.location.hash),
  };
}

function buildURL(parts) {
  const path = parts.path || '/';
  const query = serializeQuery(parts.query || {});
  const hash = serializeHash(parts.hash || {});
  return `${path}${query}${hash}`;
}

export function createRouter() {
  const registrations = [];
  let currentURL = '';

  function notifyStores(parsed) {
    for (const reg of registrations) {
      reg.onRoute?.(parsed);
    }
  }

  function collectURL() {
    const merged = { path: '/', query: {}, hash: {} };
    for (const reg of registrations) {
      if (!reg.toURL) continue;
      const part = reg.toURL();
      if (part.path != null) merged.path = part.path;
      if (part.query) Object.assign(merged.query, part.query);
      if (part.hash) Object.assign(merged.hash, part.hash);
    }
    return merged;
  }

  function pushURL(url) {
    if (url !== currentURL) {
      currentURL = url;
      history.pushState(null, '', url);
    }
  }

  function replaceURL(url) {
    if (url !== currentURL) {
      currentURL = url;
      history.replaceState(null, '', url);
    }
  }

  function onStoreChange() {
    const merged = collectURL();
    const url = buildURL(merged);
    pushURL(url);
  }

  function onPopState() {
    const parsed = parseURL();
    currentURL = buildURL(parsed);
    notifyStores(parsed);
  }

  window.addEventListener('popstate', onPopState);

  // Init: track current URL
  currentURL = buildURL(parseURL());

  const router = {
    register(store, options) {
      const reg = {
        store,
        onRoute: options.onRoute,
        toURL: options.toURL,
        disposer: null,
      };

      registrations.push(reg);

      if (options.toURL) {
        reg.disposer = observe(store, onStoreChange);
      }

      // Notify this store with current URL on registration
      options.onRoute?.(parseURL());

      return () => {
        const idx = registrations.indexOf(reg);
        if (idx !== -1) registrations.splice(idx, 1);
        reg.disposer?.();
      };
    },

    navigate(path, opts) {
      const query = opts?.query || {};
      const hash = opts?.hash || {};
      const parsed = { path, query, hash };
      const url = buildURL(parsed);
      currentURL = url;
      history.pushState(null, '', url);
      notifyStores(parsed);
    },

    replace(path, opts) {
      const query = opts?.query || {};
      const hash = opts?.hash || {};
      const parsed = { path, query, hash };
      const url = buildURL(parsed);
      currentURL = url;
      history.replaceState(null, '', url);
      notifyStores(parsed);
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
        reg.disposer?.();
      }
      registrations.length = 0;
    },
  };

  // Bound click handler for <a> event delegation
  router.go = (event) => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    if (anchor.origin !== window.location.origin) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    event.preventDefault();
    const path = anchor.pathname;
    const query = parseQuery(anchor.search);
    const hash = parseHash(anchor.hash);
    router.navigate(path, { query, hash });
  };

  return router;
}

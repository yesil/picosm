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

  async function checkGuards(destination) {
    for (const reg of registrations) {
      if (!reg.before) continue;
      const allowed = await reg.before(destination);
      if (!allowed) return false;
    }
    return true;
  }

  function notifyStores(parsed) {
    for (const reg of registrations) {
      reg.onRoute?.(parsed);
    }
  }

  function syncURL(url, replace) {
    if (url !== currentURL) {
      currentURL = url;
      if (replace) {
        history.replaceState(null, '', url);
      } else {
        history.pushState(null, '', url);
      }
    }
  }

  function buildMergedURL() {
    const merged = { path: window.location.pathname, query: {}, hash: {} };
    for (const r of registrations) {
      if (!r.cachedURL) continue;
      if (r.cachedURL.path != null) merged.path = r.cachedURL.path;
      if (r.cachedURL.query) Object.assign(merged.query, r.cachedURL.query);
      if (r.cachedURL.hash) Object.assign(merged.hash, r.cachedURL.hash);
    }
    return merged;
  }

  function onStoreChange(reg) {
    reg.cachedURL = reg.toURL();
    const url = buildURL(buildMergedURL());
    syncURL(url, !!reg.cachedURL.replace);
    if (reg.storage) {
      reg.storage.setItem(reg.store.constructor.name, JSON.stringify(reg.cachedURL));
    }
  }

  async function onPopState() {
    const parsed = parseURL();
    const newURL = buildURL(parsed);
    if (!(await checkGuards(parsed))) {
      // Guard rejected — push old URL back
      history.pushState(null, '', currentURL);
      return;
    }
    currentURL = newURL;
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
        before: options.before,
        storage: options.storage ?? null,
        cachedURL: null,
        disposer: null,
      };

      registrations.push(reg);

      if (options.toURL) {
        reg.cachedURL = options.toURL();
        reg.disposer = observe(store, () => onStoreChange(reg));
      }

      if (options.storage) {
        const raw = options.storage.getItem(store.constructor.name);
        if (raw != null) {
          try { options.onRoute?.(JSON.parse(raw)); } catch {}
        }
      }

      // Notify this store with current URL on registration
      options.onRoute?.(parseURL());

      return () => {
        const idx = registrations.indexOf(reg);
        if (idx !== -1) registrations.splice(idx, 1);
        reg.disposer?.();
      };
    },

    async navigate(path, opts) {
      const merged = buildMergedURL();
      merged.path = path;
      if (opts?.query) Object.assign(merged.query, opts.query);
      if (opts?.hash) Object.assign(merged.hash, opts.hash);
      if (!(await checkGuards(merged))) return;
      const url = buildURL(merged);
      currentURL = url;
      history.pushState(null, '', url);
      notifyStores(merged);
    },

    async replace(path, opts) {
      const merged = buildMergedURL();
      merged.path = path;
      if (opts?.query) Object.assign(merged.query, opts.query);
      if (opts?.hash) Object.assign(merged.hash, opts.hash);
      if (!(await checkGuards(merged))) return;
      const url = buildURL(merged);
      currentURL = url;
      history.replaceState(null, '', url);
      notifyStores(merged);
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

  // Bound click handler for event delegation on elements with href
  router.go = (event) => {
    const el = event.target.closest('[href]');
    if (!el) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    let url;
    try {
      url = new URL(el.getAttribute('href'), window.location.origin);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    router.navigate(url.pathname, {
      query: parseQuery(url.search),
      hash: parseHash(url.hash),
    });
  };

  return router;
}

/**
 * PineJS v1.3.0 "Cedar"
 * Next-Generation Fine-Grained Reactive Declarative Micro-Framework
 * Complete Alpine.js Parity + True Fine-Grained Signals + Built-in Plugins
 * (c) 2026 PineJS Core Team - MIT License
 * https://pinejs.dev
 */
(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    const Pine = factory();
    global.Pine = Pine;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Pine.start());
      } else {
        Pine.start();
      }
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // 1. FINE-GRAINED SIGNALS ENGINE
  // =========================================================================
  let activeEffect = null;
  const effectStack = [];
  let batchDepth = 0;
  const pendingEffects = new Set();
  const RAW_SYMBOL = Symbol('__pine_raw__');
  const PROXY_SYMBOL = Symbol('__pine_proxy__');
  const SCOPE_SYMBOL = Symbol('__pine_scope__');

  class Signal {
    constructor(value) {
      this._value = value;
      this.subscribers = new Set();
    }

    get value() {
      if (activeEffect) {
        this.subscribers.add(activeEffect);
        activeEffect.dependencies.add(this);
      }
      return this._value;
    }

    set value(nextValue) {
      if (!Object.is(this._value, nextValue)) {
        this._value = nextValue;
        this.notify();
      }
    }

    peek() {
      return this._value;
    }

    notify() {
      for (const subscriber of Array.from(this.subscribers)) {
        if (batchDepth > 0) {
          pendingEffects.add(subscriber);
        } else {
          subscriber.run();
        }
      }
    }
  }

  function signal(initialValue) {
    return new Signal(initialValue);
  }

  class Computed {
    constructor(getter) {
      this.getter = getter;
      this._value = undefined;
      this._dirty = true;
      this.subscribers = new Set();
      this.effect = new ReactiveEffect(() => {
        if (!this._dirty) {
          this._dirty = true;
          this.notify();
        }
      });
    }

    get value() {
      if (activeEffect) {
        this.subscribers.add(activeEffect);
        activeEffect.dependencies.add(this);
      }
      if (this._dirty) {
        const prevEffect = activeEffect;
        activeEffect = this.effect;
        try {
          this.effect.cleanup();
          this._value = this.getter();
          this._dirty = false;
        } finally {
          activeEffect = prevEffect;
        }
      }
      return this._value;
    }

    peek() {
      return this._value;
    }

    notify() {
      for (const subscriber of Array.from(this.subscribers)) {
        if (batchDepth > 0) {
          pendingEffects.add(subscriber);
        } else {
          subscriber.run();
        }
      }
    }

    destroy() {
      this.effect.destroy();
      this.subscribers.clear();
    }
  }

  function computed(getter) {
    return new Computed(getter);
  }

  class ReactiveEffect {
    constructor(fn, options = {}) {
      this.fn = fn;
      this.dependencies = new Set();
      this.active = true;
      this.scheduler = options.scheduler || null;
      this.onCleanup = null;
    }

    run() {
      if (!this.active) return;
      this.cleanup();
      effectStack.push(activeEffect);
      activeEffect = this;
      try {
        if (typeof this.onCleanup === 'function') {
          this.onCleanup();
          this.onCleanup = null;
        }
        return this.fn((cleanupFn) => {
          this.onCleanup = cleanupFn;
        });
      } finally {
        activeEffect = effectStack.pop();
      }
    }

    cleanup() {
      for (const dep of this.dependencies) {
        dep.subscribers.delete(this);
      }
      this.dependencies.clear();
    }

    destroy() {
      if (this.active) {
        if (typeof this.onCleanup === 'function') {
          this.onCleanup();
          this.onCleanup = null;
        }
        this.cleanup();
        this.active = false;
      }
    }
  }

  function effect(fn, options) {
    const rxEffect = new ReactiveEffect(fn, options);
    rxEffect.run();
    return () => rxEffect.destroy();
  }

  function batch(fn) {
    batchDepth++;
    try {
      return fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0) {
        const effectsToRun = Array.from(pendingEffects);
        pendingEffects.clear();
        for (const eff of effectsToRun) {
          eff.run();
        }
      }
    }
  }

  function untrack(fn) {
    const prev = activeEffect;
    activeEffect = null;
    try {
      return fn();
    } finally {
      activeEffect = prev;
    }
  }

  // =========================================================================
  // 2. FINE-GRAINED REACTIVE PROXY & SCOPE SYSTEM
  // =========================================================================
  const signalMap = new WeakMap();
  const rawToProxyMap = new WeakMap();
  const proxyToRawMap = new WeakMap();

  function getSignalForProp(target, prop) {
    let targetMap = signalMap.get(target);
    if (!targetMap) {
      targetMap = new Map();
      signalMap.set(target, targetMap);
    }
    let sig = targetMap.get(prop);
    if (!sig) {
      sig = signal(target[prop]);
      targetMap.set(prop, sig);
    }
    return sig;
  }

  function isObject(val) {
    return val !== null && typeof val === 'object';
  }

  function reactive(target) {
    if (!isObject(target)) return target;
    if (target[RAW_SYMBOL]) return target;
    if (rawToProxyMap.has(target)) return rawToProxyMap.get(target);

    const arrayMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

    const proxy = new Proxy(target, {
      get(obj, prop, receiver) {
        if (prop === RAW_SYMBOL) return obj;
        if (prop === PROXY_SYMBOL) return proxy;

        if (Array.isArray(obj) && arrayMethods.includes(prop)) {
          return function (...args) {
            const lengthSig = getSignalForProp(obj, 'length');
            const result = Array.prototype[prop].apply(obj, args);
            lengthSig.value = obj.length;
            lengthSig.notify();
            const arrSig = getSignalForProp(obj, '__array_mut__');
            arrSig.value = (arrSig._value || 0) + 1;
            arrSig.notify();
            return result;
          };
        }

        if (typeof prop === 'symbol') {
          return Reflect.get(obj, prop, receiver);
        }

        const desc = Object.getOwnPropertyDescriptor(obj, prop) || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj) || {}, prop);
        if (desc && desc.get) {
          const getterResult = desc.get.call(proxy);
          return isObject(getterResult) ? reactive(getterResult) : getterResult;
        }

        const sig = getSignalForProp(obj, prop);
        const currentSigVal = sig.value;
        const currentTargetVal = obj[prop];

        if (typeof currentTargetVal === 'function') {
          return currentTargetVal.bind(proxy);
        }

        if (isObject(currentTargetVal)) {
          return reactive(currentTargetVal);
        }

        return currentTargetVal !== undefined ? currentTargetVal : currentSigVal;
      },

      set(obj, prop, value, receiver) {
        if (typeof prop === 'symbol') {
          return Reflect.set(obj, prop, value, receiver);
        }

        const rawVal = value && value[RAW_SYMBOL] ? value[RAW_SYMBOL] : value;
        const oldValue = obj[prop];

        if (!Object.is(oldValue, rawVal)) {
          const sig = getSignalForProp(obj, prop);
          obj[prop] = rawVal;
          sig.value = rawVal;

          if (Array.isArray(obj) && prop === 'length') {
            const lenSig = getSignalForProp(obj, 'length');
            lenSig.notify();
          }
        }
        return true;
      },

      deleteProperty(obj, prop) {
        const hasProp = Object.prototype.hasOwnProperty.call(obj, prop);
        const result = Reflect.deleteProperty(obj, prop);
        if (hasProp) {
          const sig = getSignalForProp(obj, prop);
          sig.value = undefined;
          sig.notify();
        }
        return result;
      }
    });

    rawToProxyMap.set(target, proxy);
    proxyToRawMap.set(proxy, target);
    return proxy;
  }

  function raw(proxyObj) {
    if (!isObject(proxyObj)) return proxyObj;
    return proxyObj[RAW_SYMBOL] || proxyToRawMap.get(proxyObj) || proxyObj;
  }

  class Scope {
    constructor(data = {}, parent = null, el = null) {
      this.localData = reactive(isObject(data) ? data : {});
      this.parent = parent;
      this.el = el;
      this.cleanups = [];
      this.refs = {};
      this.scopedIds = {};

      this.data = new Proxy(this.localData, {
        get: (target, prop, receiver) => {
          if (prop === RAW_SYMBOL) return target;
          if (prop === PROXY_SYMBOL) return this.data;
          if (prop in target) {
            return target[prop];
          }
          if (this.parent && this.parent.data && prop in this.parent.data) {
            return this.parent.data[prop];
          }
          return target[prop];
        },
        set: (target, prop, val, receiver) => {
          if (prop in target) {
            target[prop] = val;
            return true;
          }
          if (this.parent && this.parent.data && prop in this.parent.data) {
            this.parent.data[prop] = val;
            return true;
          }
          target[prop] = val;
          return true;
        },
        has: (target, prop) => {
          if (prop in target) return true;
          if (this.parent && this.parent.data && prop in this.parent.data) return true;
          return false;
        },
        deleteProperty: (target, prop) => {
          if (prop in target) {
            return delete target[prop];
          }
          if (this.parent && this.parent.data && prop in this.parent.data) {
            return delete this.parent.data[prop];
          }
          return true;
        }
      });
    }

    get(key) {
      return this.data[key];
    }

    set(key, val) {
      this.data[key] = val;
      return true;
    }

    has(key) {
      return key in this.data;
    }

    addCleanup(fn) {
      if (typeof fn === 'function') {
        this.cleanups.push(fn);
      }
    }

    destroy() {
      for (const fn of this.cleanups) {
        try {
          fn();
        } catch (e) {
          console.error('[PineJS] Cleanup error:', e);
        }
      }
      this.cleanups = [];
    }
  }

  function getScope(el) {
    let curr = el;
    while (curr) {
      if (curr[SCOPE_SYMBOL]) return curr[SCOPE_SYMBOL];
      if (curr.__pine_scope__) return curr.__pine_scope__;
      if (curr._pineScope) return curr._pineScope;
      curr = curr.parentElement;
    }
    return null;
  }

  function getClosestComponent(el) {
    let curr = el;
    while (curr) {
      if (curr.hasAttribute && (curr.hasAttribute('p-data') || curr[SCOPE_SYMBOL])) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  // =========================================================================
  // 3. EXPRESSION EVALUATOR & SAFE RUNNER
  // =========================================================================
  const fnCache = new Map();

  function buildEvaluator(expression) {
    const trimmed = expression.trim();
    if (fnCache.has(trimmed)) {
      return fnCache.get(trimmed);
    }

    let fn;
    try {
      fn = new Function(
        '__scope__',
        '__magics__',
        `with (__magics__) {
          with (__scope__) {
            return (${trimmed});
          }
        }`
      );
    } catch (err) {
      try {
        fn = new Function(
          '__scope__',
          '__magics__',
          `with (__magics__) {
            with (__scope__) {
              ${trimmed};
            }
          }`
        );
      } catch (innerErr) {
        console.error(`[PineJS] Syntax error in expression: "${trimmed}"`, innerErr);
        fn = () => {};
      }
    }

    fnCache.set(trimmed, fn);
    return fn;
  }

  function evaluate(el, expression, additionalContext = {}) {
    if (!expression || typeof expression !== 'string') return undefined;
    const scope = getScope(el);
    const scopeData = scope ? scope.data : {};
    const magics = getMagicScope(el, additionalContext);
    const evaluator = buildEvaluator(expression);

    try {
      return evaluator(scopeData, magics);
    } catch (err) {
      console.warn(`[PineJS] Error evaluating: "${expression}" on element:`, el, err);
      return undefined;
    }
  }

  function evaluateSetter(el, expression, value, additionalContext = {}) {
    if (!expression || typeof expression !== 'string') return;
    const scope = getScope(el);
    const scopeData = scope ? scope.data : {};
    const magics = getMagicScope(el, additionalContext);

    try {
      const setterFn = new Function(
        '__scope__',
        '__magics__',
        '__val__',
        `with (__magics__) {
          with (__scope__) {
            ${expression} = __val__;
          }
        }`
      );
      setterFn(scopeData, magics, value);
    } catch (err) {
      console.warn(`[PineJS] Error setting "${expression}" =`, value, err);
    }
  }

  // =========================================================================
  // 4. GLOBAL REGISTRIES & STORES
  // =========================================================================
  const registeredData = new Map();
  const registeredBinds = new Map();
  const registeredStores = reactive({});
  const customDirectives = new Map();
  const customMagics = new Map();
  const plugins = new Set();
  let globalIdCounter = 0;

  // =========================================================================
  // 5. REACTIVE FETCH CLIENT ENGINE ($fetch & Pine.fetch)
  // =========================================================================
  function createFetchResource(urlInput, optionsInput = {}, el = null) {
    let abortCtrl = null;
    let currentPromise = null;

    const state = reactive({
      loading: true,
      data: null,
      error: null,
      status: null,
      ok: false,
      headers: {},
      response: null,
      abort() {
        if (abortCtrl) {
          abortCtrl.abort();
          state.loading = false;
        }
      },
      async refetch(overrideOptions = {}) {
        return execute(overrideOptions);
      },
      then(onFulfilled, onRejected) {
        return (currentPromise || execute()).then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return (currentPromise || execute()).catch(onRejected);
      },
      finally(onFinally) {
        return (currentPromise || execute()).finally(onFinally);
      }
    });

    async function execute(extraOpts = {}) {
      if (abortCtrl) {
        abortCtrl.abort();
      }
      abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;

      let targetUrl = typeof urlInput === 'function' ? urlInput() : urlInput;
      const baseOpts = typeof optionsInput === 'function' ? optionsInput() : optionsInput;
      const mergedOpts = { ...baseOpts, ...extraOpts };

      // Query param serialization from params/query object
      const params = mergedOpts.params || mergedOpts.query;
      if (params && typeof params === 'object') {
        const baseHref = typeof window !== 'undefined' && window.location && window.location.href ? window.location.href : 'http://localhost';
        const urlObj = new URL(targetUrl, baseHref);
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null) {
            urlObj.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          }
        }
        targetUrl = targetUrl.startsWith('http://') || targetUrl.startsWith('https://') || targetUrl.startsWith('//')
          ? urlObj.toString()
          : (urlObj.pathname + urlObj.search + urlObj.hash);
      }

      // Headers construction
      const headers = typeof Headers !== 'undefined' && mergedOpts.headers instanceof Headers
        ? mergedOpts.headers
        : new Headers(mergedOpts.headers || {});

      // Auto-serialize JSON body
      let body = mergedOpts.body;
      if (body && typeof body === 'object' && !(typeof FormData !== 'undefined' && body instanceof FormData) && !(typeof Blob !== 'undefined' && body instanceof Blob) && !(typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)) {
        body = JSON.stringify(body);
        if (!headers.has('Content-Type') && !headers.has('content-type')) {
          headers.set('Content-Type', 'application/json');
        }
      }

      const fetchConfig = {
        ...mergedOpts,
        headers,
        body,
        signal: abortCtrl ? abortCtrl.signal : undefined
      };
      delete fetchConfig.params;
      delete fetchConfig.query;
      delete fetchConfig.timeout;
      delete fetchConfig.responseType;
      delete fetchConfig.ignoreStatus;

      let timeoutId = null;
      if (mergedOpts.timeout && typeof mergedOpts.timeout === 'number') {
        timeoutId = setTimeout(() => {
          if (abortCtrl) abortCtrl.abort(new Error(`Fetch timed out after ${mergedOpts.timeout}ms`));
        }, mergedOpts.timeout);
      }

      state.loading = true;
      state.error = null;

      currentPromise = (async () => {
        try {
          const res = await fetch(targetUrl, fetchConfig);
          if (timeoutId) clearTimeout(timeoutId);

          state.status = res.status;
          state.ok = res.ok;
          state.response = res;

          const hdrMap = {};
          if (res.headers && typeof res.headers.forEach === 'function') {
            res.headers.forEach((val, key) => { hdrMap[key] = val; });
          }
          state.headers = hdrMap;

          if (!res.ok && !mergedOpts.ignoreStatus) {
            throw new Error(`HTTP ${res.status}: ${res.statusText || 'Fetch request failed'}`);
          }

          const contentType = res.headers ? (res.headers.get('content-type') || '') : '';
          let parsedData;
          if (mergedOpts.responseType === 'blob') {
            parsedData = await res.blob();
          } else if (mergedOpts.responseType === 'text') {
            parsedData = await res.text();
          } else if (mergedOpts.responseType === 'json' || contentType.includes('application/json')) {
            parsedData = await res.json();
          } else {
            parsedData = await res.text();
          }

          state.data = parsedData;
          return parsedData;
        } catch (err) {
          if (timeoutId) clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            state.error = 'Request aborted';
          } else {
            state.error = err.message || 'Fetch failed';
          }
          state.data = null;
          throw err;
        } finally {
          state.loading = false;
        }
      })();

      return currentPromise;
    }

    // Trigger initial request
    execute().catch(() => {});

    // Component lifecycle cleanup
    if (el) {
      const scope = getScope(el);
      if (scope) {
        scope.addCleanup(() => {
          if (abortCtrl) abortCtrl.abort();
        });
      }
    }

    return state;
  }

  function buildFetchMagic(el) {
    const fn = (url, options = {}) => createFetchResource(url, options, el);

    fn.get = (url, options = {}) => createFetchResource(url, { ...options, method: 'GET' }, el);
    fn.post = (url, body, options = {}) => createFetchResource(url, { ...options, method: 'POST', body }, el);
    fn.put = (url, body, options = {}) => createFetchResource(url, { ...options, method: 'PUT', body }, el);
    fn.patch = (url, body, options = {}) => createFetchResource(url, { ...options, method: 'PATCH', body }, el);
    fn.delete = (url, options = {}) => createFetchResource(url, { ...options, method: 'DELETE' }, el);
    fn.json = async (url, options = {}) => {
      const res = await createFetchResource(url, { ...options, responseType: 'json' }, el);
      return res.data;
    };

    return fn;
  }

  // =========================================================================
  // 6. MAGIC PROPERTIES ENGINE
  // =========================================================================
  const builtInMagics = {
    $el(el) {
      return el;
    },
    $root(el) {
      return getClosestComponent(el) || el;
    },
    $data(el) {
      const scope = getScope(el);
      return scope ? scope.data : {};
    },
    $refs(el) {
      const root = getClosestComponent(el) || document;
      const refs = {};
      root.querySelectorAll('[p-ref]').forEach((refEl) => {
        const name = refEl.getAttribute('p-ref');
        if (name) refs[name] = refEl;
      });
      if (root.hasAttribute && root.hasAttribute('p-ref')) {
        refs[root.getAttribute('p-ref')] = root;
      }
      return refs;
    },
    $nextTick() {
      return (cb) => {
        const promise = Promise.resolve();
        return cb ? promise.then(cb) : promise;
      };
    },
    $dispatch(el) {
      return (eventName, detail = {}, options = {}) => {
        const event = new CustomEvent(eventName, {
          bubbles: options.bubbles !== undefined ? options.bubbles : true,
          cancelable: options.cancelable !== undefined ? options.cancelable : true,
          composed: options.composed !== undefined ? options.composed : true,
          detail
        });
        el.dispatchEvent(event);
      };
    },
    $watch(el) {
      return (getterOrProp, callback, options = {}) => {
        const scope = getScope(el);
        let getter;
        if (typeof getterOrProp === 'function') {
          getter = getterOrProp;
        } else {
          getter = () => evaluate(el, getterOrProp);
        }

        let oldValue = undefined;
        let isFirst = true;

        const stop = effect(() => {
          const newValue = getter();
          if (isFirst) {
            oldValue = newValue;
            if (options.immediate) {
              callback(newValue, undefined);
            }
            isFirst = false;
          } else {
            callback(newValue, oldValue);
            oldValue = newValue;
          }
        });

        if (scope) scope.addCleanup(stop);
        return stop;
      };
    },
    $store() {
      return (name) => {
        if (name) return registeredStores[name];
        return registeredStores;
      };
    },
    $id(el) {
      return (name = 'id', key = null) => {
        const scope = getScope(el);
        if (scope && scope.scopedIds && scope.scopedIds[name]) {
          return key ? `${scope.scopedIds[name]}-${key}` : scope.scopedIds[name];
        }
        const generated = `${name}-${++globalIdCounter}`;
        if (scope) {
          scope.scopedIds = scope.scopedIds || {};
          scope.scopedIds[name] = generated;
        }
        return key ? `${generated}-${key}` : generated;
      };
    },
    $signal() {
      return (val) => signal(val);
    },
    $focus(el) {
      return {
        focus(target) {
          const targetEl = typeof target === 'string' ? document.querySelector(target) : target || el;
          if (targetEl && targetEl.focus) targetEl.focus();
        },
        trap(container) {
          const c = typeof container === 'string' ? document.querySelector(container) : container || el;
          if (!c) return;
          const focusables = c.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (focusables.length > 0) focusables[0].focus();
        }
      };
    },
    $fetch(el) {
      return buildFetchMagic(el);
    },
    $persist(el) {
      return (initialValue, keyName) => {
        const key = keyName || `pine_persist_${el.id || Math.random().toString(36).slice(2, 7)}`;
        let stored = localStorage.getItem(key);
        let currentVal = initialValue;

        if (stored !== null) {
          try {
            currentVal = JSON.parse(stored);
          } catch {
            currentVal = stored;
          }
        } else {
          localStorage.setItem(key, JSON.stringify(initialValue));
        }

        const sig = signal(currentVal);
        const rxVal = reactive({
          get value() {
            return sig.value;
          },
          set value(v) {
            sig.value = v;
            localStorage.setItem(key, JSON.stringify(v));
          }
        });

        return rxVal;
      };
    },
    $intersect(el) {
      return (callback, options = {}) => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (typeof callback === 'function') {
              callback(entry.isIntersecting, entry);
            }
          });
        }, options);

        observer.observe(el);
        const scope = getScope(el);
        if (scope) {
          scope.addCleanup(() => observer.disconnect());
        }
      };
    },
    $history(el) {
      return (initialValue, paramName) => {
        const key = paramName || el.getAttribute('name') || el.id || 'q';
        let currentVal = initialValue;
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          const urlVal = url.searchParams.get(key);
          if (urlVal !== null) {
            try { currentVal = JSON.parse(urlVal); } catch { currentVal = urlVal; }
          }
        }

        const sig = signal(currentVal);
        const rxVal = reactive({
          get value() {
            return sig.value;
          },
          set value(v) {
            sig.value = v;
            if (typeof window !== 'undefined') {
              const currentUrl = new URL(window.location.href);
              if (v === '' || v === null || v === undefined) {
                currentUrl.searchParams.delete(key);
              } else {
                currentUrl.searchParams.set(key, typeof v === 'object' ? JSON.stringify(v) : String(v));
              }
              window.history.replaceState({}, '', currentUrl.toString());
            }
          }
        });

        if (typeof window !== 'undefined') {
          const popHandler = () => {
            const u = new URL(window.location.href);
            const v = u.searchParams.get(key);
            sig.value = v !== null ? v : initialValue;
          };
          window.addEventListener('popstate', popHandler);
          queueMicrotask(() => {
            const scope = getScope(el);
            if (scope) scope.addCleanup(() => window.removeEventListener('popstate', popHandler));
          });
        }

        return rxVal;
      };
    }
  };

  function getMagicScope(el, additionalContext = {}) {
    const magicObj = { ...additionalContext };

    for (const [key, factory] of Object.entries(builtInMagics)) {
      if (!(key in magicObj)) {
        Object.defineProperty(magicObj, key, {
          get() {
            return factory(el);
          },
          enumerable: true,
          configurable: true
        });
      }
    }

    for (const [key, factory] of customMagics.entries()) {
      if (!(key in magicObj)) {
        Object.defineProperty(magicObj, key, {
          get() {
            return factory(el, additionalContext);
          },
          enumerable: true,
          configurable: true
        });
      }
    }

    return magicObj;
  }

  // =========================================================================
  // 6. DIRECTIVE HANDLERS
  // =========================================================================
  const directives = {
    // p-data: Root component initialization
    'p-data': (el, { expression }) => {
      let initialData = {};
      if (expression && expression.trim()) {
        if (registeredData.has(expression.trim())) {
          const factory = registeredData.get(expression.trim());
          initialData = typeof factory === 'function' ? factory() : factory;
        } else {
          const evaluated = evaluate(el, expression);
          initialData = isObject(evaluated) ? evaluated : {};
        }
      }

      const parentScope = getScope(el.parentElement);
      const scope = new Scope(initialData, parentScope, el);
      el[SCOPE_SYMBOL] = scope;
      el.__pine_scope__ = scope;
      el._pineScope = scope;

      if (el.hasAttribute('p-init')) {
        const initExpr = el.getAttribute('p-init');
        if (initExpr) {
          evaluate(el, initExpr);
        }
      }
    },

    // p-id: Scoped unique IDs
    'p-id': (el, { expression }) => {
      const scope = getScope(el);
      if (!scope) return;
      scope.scopedIds = scope.scopedIds || {};
      const ids = evaluate(el, expression);
      if (Array.isArray(ids)) {
        ids.forEach((idName) => {
          scope.scopedIds[idName] = `${idName}-${++globalIdCounter}`;
        });
      } else if (typeof ids === 'string') {
        scope.scopedIds[ids] = `${ids}-${++globalIdCounter}`;
      }
    },

    // p-bind / :attr: Attribute and class/style binding, support Pine.bind()
    'p-bind': (el, { arg, expression, modifiers }) => {
      if (!arg) {
        const stop = effect(() => {
          let bindings;
          if (registeredBinds.has(expression.trim())) {
            const bindFn = registeredBinds.get(expression.trim());
            bindings = typeof bindFn === 'function' ? bindFn() : bindFn;
          } else {
            bindings = evaluate(el, expression);
          }

          if (isObject(bindings)) {
            for (const [key, val] of Object.entries(bindings)) {
              if (key.startsWith('@') || key.startsWith('p-on:')) {
                const eventName = key.startsWith('@') ? key.slice(1) : key.slice(5);
                const [ev, ...mods] = eventName.split('.');
                directives['p-on'](el, { arg: ev, expression: val, modifiers: mods });
              } else {
                applyAttributeBinding(el, key.startsWith(':') ? key.slice(1) : key, val);
              }
            }
          }
        });
        const scope = getScope(el);
        if (scope) scope.addCleanup(stop);
        return;
      }

      const stop = effect(() => {
        const value = evaluate(el, expression);
        applyAttributeBinding(el, arg, value, modifiers);
      });

      const scope = getScope(el);
      if (scope) scope.addCleanup(stop);
    },

    // p-on / @event: Event listeners
    'p-on': (el, { arg: eventName, expression, modifiers }) => {
      if (!eventName) return;

      const isWindow = modifiers.includes('window');
      const isDocument = modifiers.includes('document');
      const isOutside = modifiers.includes('outside');
      const isOnce = modifiers.includes('once');
      const isPassive = modifiers.includes('passive');
      const isCapture = modifiers.includes('capture');
      const isSelf = modifiers.includes('self');
      const isPrevent = modifiers.includes('prevent');
      const isStop = modifiers.includes('stop');

      let debounceTime = 0;
      let throttleTime = 0;
      modifiers.forEach((mod) => {
        if (mod.startsWith('debounce')) {
          const parts = mod.split('.');
          const ms = parseInt(parts[1] || '250', 10);
          debounceTime = isNaN(ms) ? 250 : ms;
        }
        if (mod.startsWith('throttle')) {
          const parts = mod.split('.');
          const ms = parseInt(parts[1] || '250', 10);
          throttleTime = isNaN(ms) ? 250 : ms;
        }
      });

      const keyModifiers = [
        'enter', 'escape', 'tab', 'space', 'delete', 'slash',
        'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right'
      ];
      const activeKeyMods = modifiers.filter((m) => keyModifiers.includes(m));

      let timer = null;
      let inThrottle = false;

      const handler = (event) => {
        if (isSelf && event.target !== el) return;
        if (isPrevent) event.preventDefault();
        if (isStop) event.stopPropagation();

        if (isOutside) {
          if (!el.isConnected) return;
          if (el.contains(event.target)) return;
          if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0) return;
          if (el._pineJustShown && (Date.now() - el._pineJustShown < 100)) return;
          let ancestor = el.parentElement;
          let ancestorJustShown = false;
          while (ancestor) {
            if (ancestor._pineJustShown && (Date.now() - ancestor._pineJustShown < 100)) {
              ancestorJustShown = true;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          if (ancestorJustShown) return;
        }

        if (activeKeyMods.length > 0 && event instanceof KeyboardEvent) {
          const key = event.key.toLowerCase();
          const match = activeKeyMods.some((m) => {
            if (m === 'enter' && key === 'enter') return true;
            if (m === 'escape' && (key === 'escape' || key === 'esc')) return true;
            if (m === 'tab' && key === 'tab') return true;
            if (m === 'space' && (key === ' ' || key === 'spacebar')) return true;
            if (m === 'delete' && (key === 'delete' || key === 'backspace')) return true;
            if (m === 'slash' && key === '/') return true;
            if (m === 'arrow-up' && key === 'arrowup') return true;
            if (m === 'arrow-down' && key === 'arrowdown') return true;
            if (m === 'arrow-left' && key === 'arrowleft') return true;
            if (m === 'arrow-right' && key === 'arrowright') return true;
            return false;
          });
          if (!match) return;
        }

        const execute = () => {
          if (typeof expression === 'function') {
            expression(event);
          } else {
            evaluate(el, expression, { $event: event });
          }
        };

        if (debounceTime > 0) {
          clearTimeout(timer);
          timer = setTimeout(execute, debounceTime);
        } else if (throttleTime > 0) {
          if (!inThrottle) {
            execute();
            inThrottle = true;
            setTimeout(() => (inThrottle = false), throttleTime);
          }
        } else {
          execute();
        }
      };

      const target = isOutside || isDocument ? document : isWindow ? window : el;
      const opts = { capture: isCapture, passive: isPassive, once: isOnce };

      target.addEventListener(eventName, handler, opts);

      const scope = getScope(el);
      if (scope) {
        scope.addCleanup(() => {
          target.removeEventListener(eventName, handler, opts);
          if (timer) clearTimeout(timer);
        });
      }
    },

    // p-text: Atomic text node reactivity
    'p-text': (el, { expression }) => {
      const stop = effect(() => {
        const value = evaluate(el, expression);
        el.textContent = value === undefined || value === null ? '' : String(value);
      });
      const scope = getScope(el);
      if (scope) scope.addCleanup(stop);
    },

    // p-html: Reactive HTML content
    'p-html': (el, { expression }) => {
      const stop = effect(() => {
        const value = evaluate(el, expression);
        el.innerHTML = value === undefined || value === null ? '' : String(value);
      });
      const scope = getScope(el);
      if (scope) scope.addCleanup(stop);
    },

    // p-model: Two-way data binding
    'p-model': (el, { expression, modifiers }) => {
      const isNumber = modifiers.includes('number');
      const isTrim = modifiers.includes('trim');
      const isLazy = modifiers.includes('lazy');
      const isBoolean = modifiers.includes('boolean');

      const tag = el.tagName.toLowerCase();
      const type = el.type ? el.type.toLowerCase() : 'text';
      const scope = getScope(el);

      const modelableProp = el.getAttribute('p-modelable') || (scope && scope.modelableProp);
      if (modelableProp && tag !== 'input' && tag !== 'select' && tag !== 'textarea') {
        let isSyncing = false;

        // Sync parent -> child
        const stop1 = effect(() => {
          const parentVal = evaluate(el.parentElement || el, expression);
          if (isSyncing) return;
          if (scope && scope.data) {
            const childVal = untrack(() => scope.data[modelableProp]);
            if (childVal !== parentVal) {
              isSyncing = true;
              try {
                scope.data[modelableProp] = parentVal;
              } finally {
                isSyncing = false;
              }
            }
          }
        });

        // Sync child -> parent
        const stop2 = effect(() => {
          if (scope && scope.data) {
            const childVal = scope.data[modelableProp];
            if (isSyncing) return;
            const currentParentVal = untrack(() => evaluate(el.parentElement || el, expression));
            if (childVal !== currentParentVal) {
              isSyncing = true;
              try {
                evaluateSetter(el.parentElement || el, expression, childVal);
              } finally {
                isSyncing = false;
              }
            }
          }
        });

        if (scope) {
          scope.addCleanup(stop1);
          scope.addCleanup(stop2);
        }
        return;
      }

      if (type === 'checkbox') {
        const stop = effect(() => {
          const val = evaluate(el, expression);
          if (Array.isArray(val)) {
            el.checked = val.includes(el.value);
          } else {
            el.checked = Boolean(val);
          }
        });

        const handleChange = () => {
          const currentVal = evaluate(el, expression);
          if (Array.isArray(currentVal)) {
            const arr = [...currentVal];
            if (el.checked) {
              if (!arr.includes(el.value)) arr.push(el.value);
            } else {
              const idx = arr.indexOf(el.value);
              if (idx > -1) arr.splice(idx, 1);
            }
            evaluateSetter(el, expression, arr);
          } else {
            evaluateSetter(el, expression, el.checked);
          }
        };

        el.addEventListener('change', handleChange);
        const scope = getScope(el);
        if (scope) {
          scope.addCleanup(stop);
          scope.addCleanup(() => el.removeEventListener('change', handleChange));
        }
      } else if (type === 'radio') {
        const stop = effect(() => {
          const val = evaluate(el, expression);
          el.checked = String(val) === String(el.value);
        });

        const handleChange = () => {
          if (el.checked) {
            let val = el.value;
            if (isNumber) val = Number(val);
            if (isBoolean) val = val === 'true';
            evaluateSetter(el, expression, val);
          }
        };

        el.addEventListener('change', handleChange);
        const scope = getScope(el);
        if (scope) {
          scope.addCleanup(stop);
          scope.addCleanup(() => el.removeEventListener('change', handleChange));
        }
      } else if (tag === 'select') {
        const isMultiple = el.multiple;

        const stop = effect(() => {
          const val = evaluate(el, expression);
          if (isMultiple && Array.isArray(val)) {
            Array.from(el.options).forEach((opt) => {
              opt.selected = val.includes(opt.value);
            });
          } else {
            el.value = val === undefined ? '' : val;
          }
        });

        const handleChange = () => {
          if (isMultiple) {
            const selected = Array.from(el.selectedOptions).map((opt) => opt.value);
            evaluateSetter(el, expression, selected);
          } else {
            let val = el.value;
            if (isNumber) val = Number(val);
            evaluateSetter(el, expression, val);
          }
        };

        el.addEventListener('change', handleChange);
        const scope = getScope(el);
        if (scope) {
          scope.addCleanup(stop);
          scope.addCleanup(() => el.removeEventListener('change', handleChange));
        }
      } else {
        const stop = effect(() => {
          const val = evaluate(el, expression);
          const formatted = val === undefined || val === null ? '' : String(val);
          if (el.value !== formatted) {
            el.value = formatted;
          }
        });

        const eventType = isLazy ? 'change' : 'input';
        const handleInput = () => {
          let val = el.value;
          if (isTrim) val = val.trim();
          if (isNumber) {
            const parsed = parseFloat(val);
            val = isNaN(parsed) ? val : parsed;
          }
          evaluateSetter(el, expression, val);
        };

        el.addEventListener(eventType, handleInput);
        const scope = getScope(el);
        if (scope) {
          scope.addCleanup(stop);
          scope.addCleanup(() => el.removeEventListener(eventType, handleInput));
        }
      }
    },

    // p-modelable: Bind internal component state to parent p-model
    'p-modelable': (el, { expression }) => {
      const scope = getScope(el);
      if (scope) {
        scope.modelableProp = expression.trim();
      }
    },

    // p-show: Visibility toggling with transitions
    'p-show': (el, { expression, modifiers }) => {
      const originalDisplay = el.style.display === 'none' ? '' : el.style.display || '';
      let wasHidden = true;

      const stop = effect(() => {
        const isShown = Boolean(evaluate(el, expression));

        if (isShown) {
          if (wasHidden) {
            el._pineJustShown = Date.now();
            wasHidden = false;
          }
          if (el._pineTransition && el._pineTransition.enter) {
            el._pineTransition.enter();
          } else {
            el.style.display = originalDisplay;
          }
        } else {
          wasHidden = true;
          if (el._pineTransition && el._pineTransition.leave) {
            el._pineTransition.leave(() => {
              el.style.display = 'none';
            });
          } else {
            el.style.display = 'none';
          }
        }
      });

      const scope = getScope(el);
      if (scope) scope.addCleanup(stop);
    },

    // p-if: Conditional DOM rendering
    'p-if': (templateEl, { expression }) => {
      if (templateEl.tagName.toLowerCase() !== 'template') {
        console.warn('[PineJS] p-if must be used on a <template> tag.');
        return;
      }

      const marker = document.createComment('pine-if');
      templateEl.parentElement.insertBefore(marker, templateEl);

      let currentElement = null;
      let childScope = null;

      const stop = effect(() => {
        const condition = Boolean(evaluate(templateEl, expression));

        if (condition) {
          if (!currentElement) {
            const clone = templateEl.content.firstElementChild.cloneNode(true);
            const parentScope = getScope(templateEl);
            childScope = new Scope({}, parentScope, clone);
            clone[SCOPE_SYMBOL] = childScope;
            clone.__pine_scope__ = childScope;
            clone._pineScope = childScope;

            marker.parentElement.insertBefore(clone, marker);
            initTree(clone);
            currentElement = clone;
          }
        } else {
          if (currentElement) {
            if (childScope) childScope.destroy();
            currentElement.remove();
            currentElement = null;
            childScope = null;
          }
        }
      });

      const scope = getScope(templateEl);
      if (scope) {
        scope.addCleanup(stop);
        scope.addCleanup(() => {
          if (currentElement) currentElement.remove();
          if (marker.isConnected) marker.remove();
        });
      }
    },

    // p-for: Fine-grained keyed list rendering
    'p-for': (templateEl, { expression }) => {
      if (templateEl.tagName.toLowerCase() !== 'template') {
        console.warn('[PineJS] p-for must be used on a <template> tag.');
        return;
      }

      const match = expression.match(/^\s*(?:\(?\s*([$\w]+)(?:\s*,\s*([$\w]+))?\s*\)?)\s+(?:in|of)\s+(.+)$/);
      if (!match) {
        console.error(`[PineJS] Invalid p-for expression: "${expression}".`);
        return;
      }

      const itemVar = match[1];
      const indexVar = match[2] || null;
      const itemsExpr = match[3];

      const marker = document.createComment(`pine-for: ${expression}`);
      templateEl.parentElement.insertBefore(marker, templateEl);

      let renderedNodes = [];

      const stop = effect(() => {
        const items = evaluate(templateEl, itemsExpr);
        let itemsArray = [];
        if (Array.isArray(items)) {
          const len = items.length;
          for (let i = 0; i < len; i++) {
            itemsArray.push(items[i]);
          }
        } else if (typeof items === 'number') {
          itemsArray = Array.from({ length: items }, (_, i) => i + 1);
        } else if (isObject(items)) {
          itemsArray = Object.entries(items).map(([k, v]) => ({ key: k, value: v }));
        }

        const newRenderedNodes = [];
        const parent = marker.parentElement;

        itemsArray.forEach((item, index) => {
          const key = item && item.id !== undefined ? item.id : index;
          const existingIdx = renderedNodes.findIndex((n) => n.key === key);

          if (existingIdx > -1) {
            const existing = renderedNodes.splice(existingIdx, 1)[0];
            existing.scope.data[itemVar] = item;
            if (indexVar) existing.scope.data[indexVar] = index;
            parent.insertBefore(existing.node, marker);
            newRenderedNodes.push(existing);
          } else {
            const clone = templateEl.content.firstElementChild.cloneNode(true);
            const parentScope = getScope(templateEl);
            const loopData = { [itemVar]: item };
            if (indexVar) loopData[indexVar] = index;

            const childScope = new Scope(loopData, parentScope, clone);
            clone[SCOPE_SYMBOL] = childScope;
            clone.__pine_scope__ = childScope;
            clone._pineScope = childScope;

            parent.insertBefore(clone, marker);
            initTree(clone);
            newRenderedNodes.push({ node: clone, scope: childScope, key });
          }
        });

        renderedNodes.forEach(({ node, scope }) => {
          if (scope) scope.destroy();
          node.remove();
        });

        renderedNodes = newRenderedNodes;
      });

      const scope = getScope(templateEl);
      if (scope) {
        scope.addCleanup(stop);
        scope.addCleanup(() => {
          renderedNodes.forEach(({ node, scope: s }) => {
            if (s) s.destroy();
            node.remove();
          });
          if (marker.isConnected) marker.remove();
        });
      }
    },

    // p-transition: CSS transition engine with auto presets
    'p-transition': (el, { arg, expression, modifiers }) => {
      setupTransition(el, { arg, expression, modifiers });
    },

    // p-collapse: Smooth accordion height animation
    'p-collapse': (el) => {
      el.style.overflow = 'hidden';
      el.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
      el._pineTransition = {
        enter() {
          el.style.display = '';
          el.style.height = '0px';
          el.style.opacity = '0';
          requestAnimationFrame(() => {
            el.style.height = `${el.scrollHeight}px`;
            el.style.opacity = '1';
            setTimeout(() => {
              el.style.height = '';
            }, 300);
          });
        },
        leave(done) {
          el.style.height = `${el.scrollHeight}px`;
          requestAnimationFrame(() => {
            el.style.height = '0px';
            el.style.opacity = '0';
            setTimeout(done, 300);
          });
        }
      };
    },

    // p-mask: Input masking helper
    'p-mask': (el, { expression }) => {
      const maskFormat = expression.replace(/['"]/g, '');
      const handleMask = () => {
        let val = el.value.replace(/\D/g, '');
        let formatted = '';
        let valIdx = 0;
        for (let i = 0; i < maskFormat.length && valIdx < val.length; i++) {
          if (maskFormat[i] === '9') {
            formatted += val[valIdx++];
          } else {
            formatted += maskFormat[i];
          }
        }
        el.value = formatted;
        el.dispatchEvent(new Event('input'));
      };
      el.addEventListener('input', handleMask);
      const scope = getScope(el);
      if (scope) scope.addCleanup(() => el.removeEventListener('input', handleMask));
    },

    // p-effect: Reactive inline side-effect
    'p-effect': (el, { expression }) => {
      const stop = effect(() => {
        evaluate(el, expression);
      });
      const scope = getScope(el);
      if (scope) scope.addCleanup(stop);
    },

    // p-ref: Register element reference
    'p-ref': (el, { expression }) => {
      const name = expression || el.getAttribute('p-ref');
      const scope = getScope(el);
      if (scope && name) {
        scope.refs[name] = el;
      }
    },

    // p-teleport: Mount element into another DOM container (e.g. body)
    'p-teleport': (templateEl, { expression }) => {
      if (templateEl.tagName.toLowerCase() !== 'template') return;
      const targetSelector = expression || 'body';
      const targetContainer = document.querySelector(targetSelector);
      if (!targetContainer) return;

      const clone = templateEl.content.firstElementChild.cloneNode(true);
      const parentScope = getScope(templateEl);
      const childScope = new Scope({}, parentScope, clone);
      clone[SCOPE_SYMBOL] = childScope;
      clone.__pine_scope__ = childScope;
      clone._pineScope = childScope;

      targetContainer.appendChild(clone);
      initTree(clone);

      const scope = getScope(templateEl);
      if (scope) {
        scope.addCleanup(() => {
          childScope.destroy();
          clone.remove();
        });
      }
    },

    // p-init: Component initialization callback
    'p-init': (el, { expression }) => {
      if (!el.hasAttribute('p-data')) {
        evaluate(el, expression);
      }
    },

    // p-hydrate: Server-Side Rendering (SSR) hydration marker
    'p-hydrate': (el) => {
      el.removeAttribute('p-hydrate');
    },

    // p-animate: High-performance spring physics and keyframe animations
    'p-animate': (el, { expression, modifiers }) => {
      const presets = {
        spring: [
          { transform: 'scale(1)', offset: 0 },
          { transform: 'scale(1.18)', offset: 0.35 },
          { transform: 'scale(0.95)', offset: 0.65 },
          { transform: 'scale(1)', offset: 1 }
        ],
        bounce: [
          { transform: 'translateY(0)', offset: 0 },
          { transform: 'translateY(-14px)', offset: 0.3 },
          { transform: 'translateY(0)', offset: 0.6 },
          { transform: 'translateY(-6px)', offset: 0.8 },
          { transform: 'translateY(0)', offset: 1 }
        ],
        shake: [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(-8px)', offset: 0.2 },
          { transform: 'translateX(8px)', offset: 0.4 },
          { transform: 'translateX(-6px)', offset: 0.6 },
          { transform: 'translateX(6px)', offset: 0.8 },
          { transform: 'translateX(0)', offset: 1 }
        ],
        pulse: [
          { transform: 'scale(1)', opacity: 1, offset: 0 },
          { transform: 'scale(1.08)', opacity: 0.85, offset: 0.5 },
          { transform: 'scale(1)', opacity: 1, offset: 1 }
        ]
      };

      const matchedPreset = modifiers.find((m) => m in presets);
      const isLoop = modifiers.includes('loop') || modifiers.includes('infinite');

      const triggerAnimation = () => {
        if (typeof el.animate !== 'function') return;
        let keyframes = matchedPreset ? presets[matchedPreset] : null;
        let options = { duration: 400, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', iterations: isLoop ? Infinity : 1 };

        if (!keyframes && expression) {
          const evalRes = evaluate(el, expression);
          if (Array.isArray(evalRes)) keyframes = evalRes;
          else if (isObject(evalRes)) keyframes = [evalRes];
        }

        if (keyframes) {
          el.animate(keyframes, options);
        }
      };

      if (!expression || expression.trim() === '') {
        triggerAnimation();
      } else {
        const stop = effect(() => {
          const val = evaluate(el, expression);
          if (val) triggerAnimation();
        });
        const scope = getScope(el);
        if (scope) scope.addCleanup(stop);
      }
    }
  };

  // =========================================================================
  // 7. ATTRIBUTE BINDING & TRANSITIONS HELPER
  // =========================================================================
  function applyAttributeBinding(el, attr, value, modifiers = []) {
    if (attr === 'class' || attr === ':class') {
      if (typeof value === 'string') {
        el.className = value;
      } else if (Array.isArray(value)) {
        el.className = value.filter(Boolean).join(' ');
      } else if (isObject(value)) {
        for (const [cls, condition] of Object.entries(value)) {
          if (cls) {
            cls.split(/\s+/).forEach((c) => {
              if (condition) el.classList.add(c);
              else el.classList.remove(c);
            });
          }
        }
      }
    } else if (attr === 'style' || attr === ':style') {
      if (typeof value === 'string') {
        el.style.cssText = value;
      } else if (isObject(value)) {
        for (const [prop, styleVal] of Object.entries(value)) {
          el.style[prop] = styleVal === null || styleVal === undefined ? '' : styleVal;
        }
      }
    } else if (typeof value === 'boolean') {
      if (value) {
        el.setAttribute(attr, '');
      } else {
        el.removeAttribute(attr);
      }
    } else if (value === null || value === undefined || value === false) {
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, String(value));
    }
  }

  function setupTransition(el, { arg, expression, modifiers }) {
    if (!el._pineTransition) {
      el._pineTransition = {
        preset: null,
        enter() {
          if (this.preset === 'fade') {
            el.style.transition = 'opacity 0.2s ease';
            el.style.opacity = '0';
            requestAnimationFrame(() => {
              el.style.opacity = '1';
            });
          } else if (this.preset === 'scale') {
            el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.95)';
            requestAnimationFrame(() => {
              el.style.opacity = '1';
              el.style.transform = 'scale(1)';
            });
          } else if (this.preset === 'slide') {
            el.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            requestAnimationFrame(() => {
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            });
          }
        },
        leave(done) {
          if (this.preset === 'fade') {
            el.style.transition = 'opacity 0.15s ease';
            el.style.opacity = '0';
            setTimeout(done, 150);
          } else if (this.preset === 'scale') {
            el.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.95)';
            setTimeout(done, 150);
          } else if (this.preset === 'slide') {
            el.style.transition = 'transform 0.2s ease, opacity 0.15s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            setTimeout(done, 200);
          } else {
            done();
          }
        }
      };
    }

    if (modifiers.includes('fade')) el._pineTransition.preset = 'fade';
    if (modifiers.includes('scale')) el._pineTransition.preset = 'scale';
    if (modifiers.includes('slide')) el._pineTransition.preset = 'slide';
  }

  // =========================================================================
  // 8. DOM MORPHING ALGORITHM (Pine.morph)
  // =========================================================================
  function morph(fromEl, toEl) {
    if (typeof toEl === 'string') {
      const temp = document.createElement('div');
      temp.innerHTML = toEl.trim();
      toEl = temp.firstElementChild;
    }

    if (!fromEl || !toEl) return;

    if (fromEl.nodeType !== toEl.nodeType || fromEl.nodeName !== toEl.nodeName) {
      fromEl.replaceWith(toEl.cloneNode(true));
      return;
    }

    if (fromEl.nodeType === Node.TEXT_NODE) {
      if (fromEl.textContent !== toEl.textContent) {
        fromEl.textContent = toEl.textContent;
      }
      return;
    }

    // Sync attributes
    const fromAttrs = Array.from(fromEl.attributes || []);
    const toAttrs = Array.from(toEl.attributes || []);

    toAttrs.forEach((attr) => {
      if (fromEl.getAttribute(attr.name) !== attr.value) {
        fromEl.setAttribute(attr.name, attr.value);
      }
    });

    fromAttrs.forEach((attr) => {
      if (!toEl.hasAttribute(attr.name)) {
        fromEl.removeAttribute(attr.name);
      }
    });

    // Sync children
    const fromChildren = Array.from(fromEl.childNodes);
    const toChildren = Array.from(toEl.childNodes);

    const max = Math.max(fromChildren.length, toChildren.length);
    for (let i = 0; i < max; i++) {
      if (!fromChildren[i] && toChildren[i]) {
        fromEl.appendChild(toChildren[i].cloneNode(true));
      } else if (fromChildren[i] && !toChildren[i]) {
        fromChildren[i].remove();
      } else if (fromChildren[i] && toChildren[i]) {
        morph(fromChildren[i], toChildren[i]);
      }
    }
  }

  // =========================================================================
  // 9. DIRECTIVE PARSER
  // =========================================================================
  function parseDirective(attrName) {
    if (attrName.startsWith('p-')) {
      const parts = attrName.split('.');
      const mainPart = parts[0];
      const modifiers = parts.slice(1);

      let directive = mainPart;
      let arg = null;

      if (mainPart.includes(':')) {
        const colonIdx = mainPart.indexOf(':');
        directive = mainPart.slice(0, colonIdx);
        arg = mainPart.slice(colonIdx + 1);
      }

      return { directive, arg, modifiers };
    }

    if (attrName.startsWith(':')) {
      const parts = attrName.slice(1).split('.');
      return {
        directive: 'p-bind',
        arg: parts[0],
        modifiers: parts.slice(1)
      };
    }

    if (attrName.startsWith('@')) {
      const parts = attrName.slice(1).split('.');
      return {
        directive: 'p-on',
        arg: parts[0],
        modifiers: parts.slice(1)
      };
    }

    return null;
  }

  // =========================================================================
  // 9. DOM COMPILER & TREE WALKER
  // =========================================================================
  function initElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (el.hasAttribute && el.hasAttribute('p-ignore')) return;

    const attrs = Array.from(el.attributes || []);
    const parsedDirectives = [];

    attrs.forEach((attr) => {
      const parsed = parseDirective(attr.name);
      if (parsed) {
        parsedDirectives.push({
          name: attr.name,
          directive: parsed.directive,
          arg: parsed.arg,
          modifiers: parsed.modifiers,
          expression: attr.value
        });
      }
    });

    const dataDir = parsedDirectives.find((d) => d.directive === 'p-data');
    if (dataDir) {
      directives['p-data'](el, dataDir);
    }

    const idDir = parsedDirectives.find((d) => d.directive === 'p-id');
    if (idDir) {
      directives['p-id'](el, idDir);
    }

    const directiveOrder = [
      'p-bind', 'p-modelable', 'p-model', 'p-text', 'p-html',
      'p-show', 'p-collapse', 'p-mask', 'p-animate', 'p-transition', 'p-effect',
      'p-ref', 'p-on', 'p-init'
    ];

    parsedDirectives
      .filter((d) => d.directive !== 'p-data' && d.directive !== 'p-id' && d.directive !== 'p-if' && d.directive !== 'p-for')
      .sort((a, b) => {
        const idxA = directiveOrder.indexOf(a.directive);
        const idxB = directiveOrder.indexOf(b.directive);
        return (idxA > -1 ? idxA : 99) - (idxB > -1 ? idxB : 99);
      })
      .forEach((d) => {
        if (directives[d.directive]) {
          directives[d.directive](el, d);
        } else if (customDirectives.has(d.directive)) {
          customDirectives.get(d.directive)(el, d);
        }
      });
  }

  function initTree(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.hasAttribute && root.hasAttribute('p-ignore')) return;

    if (root.tagName && root.tagName.toLowerCase() === 'template') {
      const attrs = Array.from(root.attributes || []);
      const ifAttr = attrs.find((a) => a.name === 'p-if');
      const forAttr = attrs.find((a) => a.name === 'p-for');
      const teleportAttr = attrs.find((a) => a.name === 'p-teleport');

      if (ifAttr) {
        directives['p-if'](root, { expression: ifAttr.value });
        return;
      }
      if (forAttr) {
        directives['p-for'](root, { expression: forAttr.value });
        return;
      }
      if (teleportAttr) {
        directives['p-teleport'](root, { expression: teleportAttr.value });
        return;
      }
    }

    initElement(root);

    let child = root.firstElementChild;
    while (child) {
      const next = child.nextElementSibling;
      initTree(child);
      child = next;
    }
  }

  // =========================================================================
  // 10. PUBLIC PINE API
  // =========================================================================
  const Pine = {
    version: '1.3.0',
    versionName: 'Cedar',

    // Signals Engine
    signal,
    computed,
    effect,
    batch,
    untrack,
    reactive,
    raw,
    fetch: createFetchResource,

    // DevTools & Diagnostic Runtime Bridge
    devtools: {
      getRoots() {
        return typeof document !== 'undefined' ? Array.from(document.querySelectorAll('[p-data]')) : [];
      },
      getScope(element) {
        return getScope(element);
      },
      getSignalMap() {
        return signalMap;
      },
      inspect(element) {
        const scope = getScope(element);
        return {
          element,
          data: scope ? scope.data : null,
          parent: scope && scope.parent ? scope.parent.el : null,
          cleanupsCount: scope ? scope.cleanups.length : 0
        };
      }
    },

    // Component Registration & Binding
    data(name, factory) {
      if (typeof name === 'string' && factory) {
        registeredData.set(name, factory);
      }
    },

    bind(name, callback) {
      if (typeof name === 'string' && callback) {
        registeredBinds.set(name, callback);
      }
    },

    // Global Stores
    store(name, data) {
      if (data !== undefined) {
        registeredStores[name] = reactive(data);
      }
      return registeredStores[name];
    },

    // Custom Directives
    directive(name, callback) {
      const key = name.startsWith('p-') ? name : `p-${name}`;
      customDirectives.set(key, callback);
    },

    // Custom Magic Properties
    magic(name, callback) {
      const key = name.startsWith('$') ? name : `$${name}`;
      customMagics.set(key, callback);
    },

    // Plugins
    plugin(pluginFn) {
      if (typeof pluginFn === 'function' && !plugins.has(pluginFn)) {
        plugins.add(pluginFn);
        pluginFn(Pine);
      }
    },

    // DOM Morphing
    morph(fromEl, toEl) {
      morph(fromEl, toEl);
    },

    // Initialization & Lifecycle
    start() {
      const roots = document.querySelectorAll('[p-data]');
      if (roots.length > 0) {
        roots.forEach((root) => initTree(root));
      } else {
        initTree(document.body);
      }

      document.querySelectorAll('[p-cloak]').forEach((el) => {
        el.removeAttribute('p-cloak');
      });
    },

    initTree(element) {
      initTree(element);
    },

    $data(element) {
      const scope = getScope(element);
      return scope ? scope.data : null;
    }
  };

  return Pine;
});

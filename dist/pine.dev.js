/**
 * PineJS v1.7.0 "Douglas" [DEVELOPMENT BUILD]
 * Full source with runtime diagnostics, DevTools bridge, and descriptive warnings.
 * For production deployments, use dist/pine.min.js or dist/pine.prod.js
 * (c) 2026 PineJS Core Team | MIT License | https://pinejs.dev
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
      if (document.head && !document.getElementById('pine-cloak-styles')) {
        const style = document.createElement('style');
        style.id = 'pine-cloak-styles';
        style.textContent = '[p-cloak], [pine-cloak], [cloak] { display: none !important; }';
        document.head.appendChild(style);
      }
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

  let activeTransaction = null;
  let activeScopeInstance = null;

  // Centralized Scheduler
  const scheduler = {
    queue: {
      microtask: new Set(),
      raf: new Set(),
      idle: new Set()
    },
    scheduled: {
      microtask: false,
      raf: false,
      idle: false
    },
    sync(job) {
      return job();
    },
    microtask(job) {
      this.schedule(job, 'microtask');
    },
    raf(job) {
      this.schedule(job, 'raf');
    },
    idle(job) {
      this.schedule(job, 'idle');
    },
    schedule(job, mode = 'microtask') {
      if (mode === 'sync') {
        return job();
      }
      if (mode === 'raf') {
        this.queue.raf.add(job);
        if (!this.scheduled.raf) {
          this.scheduled.raf = true;
          const flushRaf = () => {
            this.scheduled.raf = false;
            const jobs = Array.from(this.queue.raf);
            this.queue.raf.clear();
            jobs.forEach((j) => {
              try { j(); } catch (e) { console.error('[PineJS Scheduler] RAF error:', e); }
            });
          };
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(flushRaf);
          } else {
            setTimeout(flushRaf, 16);
          }
        }
        return;
      }
      if (mode === 'idle') {
        this.queue.idle.add(job);
        if (!this.scheduled.idle) {
          this.scheduled.idle = true;
          const flushIdle = () => {
            this.scheduled.idle = false;
            const jobs = Array.from(this.queue.idle);
            this.queue.idle.clear();
            jobs.forEach((j) => {
              try { j(); } catch (e) { console.error('[PineJS Scheduler] Idle error:', e); }
            });
          };
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(flushIdle);
          } else {
            setTimeout(flushIdle, 50);
          }
        }
        return;
      }

      // Default: microtask
      this.queue.microtask.add(job);
      if (!this.scheduled.microtask) {
        this.scheduled.microtask = true;
        const flushMicrotask = () => {
          this.scheduled.microtask = false;
          const jobs = Array.from(this.queue.microtask);
          this.queue.microtask.clear();
          jobs.forEach((j) => {
            try { j(); } catch (e) { console.error('[PineJS Scheduler] Microtask error:', e); }
          });
        };
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(flushMicrotask);
        } else {
          Promise.resolve().then(flushMicrotask);
        }
      }
    },
    flush() {
      ['microtask', 'raf', 'idle'].forEach((mode) => {
        const jobs = Array.from(this.queue[mode]);
        this.queue[mode].clear();
        this.scheduled[mode] = false;
        jobs.forEach((j) => {
          try { j(); } catch (e) { console.error('[PineJS Scheduler] Flush error:', e); }
        });
      });
    }
  };

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
        if (activeTransaction) {
          activeTransaction.mutations.push({
            type: 'signal',
            target: this,
            prevValue: this._value
          });
        }
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
          if (typeof subscriber.trigger === 'function') {
            subscriber.trigger();
          } else {
            subscriber.run();
          }
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
          if (typeof subscriber.trigger === 'function') {
            subscriber.trigger();
          } else {
            subscriber.run();
          }
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
      this.running = false;
      this.runCount = 0;
    }

    trigger() {
      if (!this.active) return;
      if (this.scheduler) {
        if (typeof this.scheduler === 'function') {
          this.scheduler(() => this.run());
        } else if (typeof this.scheduler === 'string' && scheduler[this.scheduler]) {
          scheduler.schedule(() => this.run(), this.scheduler);
        } else {
          scheduler.schedule(() => this.run(), 'microtask');
        }
      } else {
        this.run();
      }
    }

    run() {
      if (!this.active) return;
      if (this.running) {
        console.warn('[PineJS] Circular reactive dependency detected.');
        return;
      }
      this.runCount++;
      if (this.runCount > 100) {
        console.warn('[PineJS] Circular reactive dependency detected (recursion threshold exceeded).');
        return;
      }
      this.running = true;
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
        this.running = false;
        this.runCount = 0;
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

  function flushPendingEffects() {
    const effectsToRun = Array.from(pendingEffects);
    pendingEffects.clear();
    for (const eff of effectsToRun) {
      if (typeof eff.trigger === 'function') {
        eff.trigger();
      } else {
        eff.run();
      }
    }
  }

  function batch(fn) {
    batchDepth++;
    try {
      return fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0) {
        flushPendingEffects();
      }
    }
  }

  async function batchAsync(fn) {
    batchDepth++;
    try {
      return await fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0) {
        flushPendingEffects();
      }
    }
  }

  function transaction(fn, options = {}) {
    const rollbackOnError = options.rollbackOnError ?? true;
    const prevTx = activeTransaction;
    const currentTx = {
      parent: prevTx,
      mutations: []
    };
    activeTransaction = currentTx;
    batchDepth++;
    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        return res.then(
          (val) => {
            activeTransaction = prevTx;
            batchDepth--;
            if (batchDepth === 0) {
              flushPendingEffects();
            }
            return val;
          },
          (err) => {
            if (rollbackOnError) {
              rollbackTransaction(currentTx);
            }
            activeTransaction = prevTx;
            batchDepth--;
            if (batchDepth === 0) {
              pendingEffects.clear();
            }
            throw err;
          }
        );
      }
      activeTransaction = prevTx;
      return res;
    } catch (err) {
      if (rollbackOnError) {
        rollbackTransaction(currentTx);
      }
      activeTransaction = prevTx;
      throw err;
    } finally {
      batchDepth--;
      if (batchDepth === 0) {
        flushPendingEffects();
      }
    }
  }

  function rollbackTransaction(tx) {
    for (let i = tx.mutations.length - 1; i >= 0; i--) {
      const m = tx.mutations[i];
      if (m.type === 'signal') {
        m.target._value = m.prevValue;
      } else if (m.type === 'proxy') {
        if (m.hadProp) {
          m.target[m.prop] = m.prevValue;
        } else {
          delete m.target[m.prop];
        }
        const sig = getSignalForProp(m.target, m.prop);
        sig._value = m.prevValue;
      }
    }
  }

  class ScopeInstance {
    constructor(parent = null) {
      this.parent = parent;
      this.children = new Set();
      this.cleanups = [];
      this.active = true;
      if (parent && parent instanceof ScopeInstance) {
        parent.children.add(this);
      }
    }

    run(fn) {
      if (!this.active) return;
      const prevScope = activeScopeInstance;
      activeScopeInstance = this;
      try {
        return fn();
      } finally {
        activeScopeInstance = prevScope;
      }
    }

    effect(fn, options) {
      if (!this.active) return () => {};
      const stop = effect(fn, options);
      this.cleanups.push(stop);
      return stop;
    }

    listen(target, event, handler, options) {
      if (!this.active || !target || typeof target.addEventListener !== 'function') return () => {};
      target.addEventListener(event, handler, options);
      const remove = () => {
        target.removeEventListener(event, handler, options);
      };
      this.cleanups.push(remove);
      return remove;
    }

    timeout(fn, delay) {
      if (!this.active) return null;
      const id = setTimeout(fn, delay);
      this.cleanups.push(() => clearTimeout(id));
      return id;
    }

    interval(fn, delay) {
      if (!this.active) return null;
      const id = setInterval(fn, delay);
      this.cleanups.push(() => clearInterval(id));
      return id;
    }

    cleanup(fn) {
      if (typeof fn === 'function' && this.active) {
        this.cleanups.push(fn);
      }
    }

    child() {
      return new ScopeInstance(this);
    }

    dispose() {
      if (!this.active) return;
      this.active = false;
      for (const child of Array.from(this.children)) {
        child.dispose();
      }
      this.children.clear();
      for (let i = this.cleanups.length - 1; i >= 0; i--) {
        try {
          this.cleanups[i]();
        } catch (e) {
          console.error('[PineJS Scope] Cleanup error:', e);
        }
      }
      this.cleanups = [];
      if (this.parent && this.parent.children) {
        this.parent.children.delete(this);
      }
    }
  }

  function createScope(fn) {
    const sc = new ScopeInstance(activeScopeInstance);
    if (typeof fn === 'function') {
      sc.run(fn);
    }
    return sc;
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

  function deepClone(val) {
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(deepClone);
    const copy = {};
    for (const k of Object.keys(val)) {
      copy[k] = deepClone(val[k]);
    }
    return copy;
  }

  function deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k])) return false;
    }
    return true;
  }

  function reactive(target) {
    if (!isObject(target)) return target;
    if (typeof Promise !== 'undefined' && (target instanceof Promise || typeof target.then === 'function')) return target;
    if (target instanceof Date || target instanceof RegExp || (typeof Map !== 'undefined' && target instanceof Map) || (typeof Set !== 'undefined' && target instanceof Set)) return target;
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
          if (activeTransaction) {
            activeTransaction.mutations.push({
              type: 'proxy',
              target: obj,
              prop,
              prevValue: oldValue,
              hadProp: Object.prototype.hasOwnProperty.call(obj, prop)
            });
          }
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

      if (typeof emitDevTools === 'function') {
        emitDevTools('scope:create', { el: this.el, data: this.data });
      }

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
      if (typeof emitDevTools === 'function') {
        emitDevTools('scope:destroy', { el: this.el });
      }
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

  function destroyTree(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

    let child = root.firstElementChild;
    while (child) {
      const next = child.nextElementSibling;
      destroyTree(child);
      child = next;
    }

    const ownScope = root[SCOPE_SYMBOL] || root.__pine_scope__ || root._pineScope;
    if (ownScope && typeof ownScope.destroy === 'function') {
      ownScope.destroy();
      delete root[SCOPE_SYMBOL];
      delete root.__pine_scope__;
      delete root._pineScope;
    }
    delete root._pineInitialized;
  }

  function ensureCloakStyle() {
    if (typeof document !== 'undefined' && document.head) {
      if (!document.getElementById('pine-cloak-styles')) {
        const style = document.createElement('style');
        style.id = 'pine-cloak-styles';
        style.textContent = '[p-cloak], [pine-cloak], [cloak] { display: none !important; }';
        document.head.appendChild(style);
      }
    }
  }

  let mutationObserver = null;

  function handleMutations(mutations) {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.hasAttribute && (node.hasAttribute('p-ignore') || node.hasAttribute('pine-ignore') || node.hasAttribute('ignore'))) return;
          initTree(node);
        }
      });

      mutation.removedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          destroyTree(node);
        }
      });
    }
  }

  function startObserver() {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || mutationObserver) return;
    const target = document.body || document.documentElement;
    if (!target) return;
    mutationObserver = new MutationObserver(handleMutations);
    mutationObserver.observe(target, {
      childList: true,
      subtree: true
    });
  }

  function stopObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  // =========================================================================
  // 3. EXPRESSION EVALUATOR & SAFE RUNNER (WITH CSP-SAFE FALLBACK)
  // =========================================================================
  let cspMode = false;

  class LRUCache {
    constructor(max = 1000) {
      this.max = max;
      this.cache = new Map();
      this.hits = 0;
      this.misses = 0;
    }
    get(key) {
      const item = this.cache.get(key);
      if (item !== undefined) {
        this.hits++;
        this.cache.delete(key);
        this.cache.set(key, item);
        return item;
      }
      this.misses++;
      return undefined;
    }
    set(key, value) {
      if (this.cache.has(key)) {
        this.cache.delete(key);
      } else if (this.cache.size >= this.max) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(key, value);
    }
    has(key) {
      return this.cache.has(key);
    }
    clear() {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
    }
    get size() {
      return this.cache.size;
    }
  }

  const fnCache = new LRUCache(1000);
  const cacheApi = {
    get size() {
      return fnCache.size;
    },
    clear() {
      fnCache.clear();
    },
    get stats() {
      return {
        hits: fnCache.hits,
        misses: fnCache.misses,
        size: fnCache.size
      };
    }
  };
  const globalErrorHandlers = new Set();

  function handleError(err, el, expression) {
    let handled = false;
    for (const handler of globalErrorHandlers) {
      try {
        handler(err, el, expression);
        handled = true;
      } catch (handlerErr) {
        console.error('[PineJS] Error in global onError handler:', handlerErr);
      }
    }

    // Check for component error boundary (p-error / pine-error)
    let curr = el;
    while (curr) {
      if (curr._pineErrorHandler) {
        try {
          evaluate(curr, curr._pineErrorHandler, { $error: err });
          handled = true;
          break;
        } catch (boundaryErr) {
          console.error('[PineJS] Error in p-error handler:', boundaryErr);
        }
      }
      curr = curr.parentElement;
    }

    if (!handled) {
      console.warn(`[PineJS] Error evaluating: "${expression}" on element:`, el, err);
    }
  }

  function createTokenizer(input) {
    let pos = 0;
    const len = input.length;
    const tokens = [];

    function skipWhitespace() {
      while (pos < len && /\s/.test(input[pos])) pos++;
    }

    while (pos < len) {
      skipWhitespace();
      if (pos >= len) break;

      const ch = input[pos];

      // Numbers
      if (/\d/.test(ch) || (ch === '.' && pos + 1 < len && /\d/.test(input[pos + 1]))) {
        let numStr = '';
        while (pos < len && /[\d.]/.test(input[pos])) {
          numStr += input[pos++];
        }
        tokens.push({ type: 'number', value: Number(numStr) });
        continue;
      }

      // Strings ('...' or "...")
      if (ch === '"' || ch === "'") {
        const quote = ch;
        pos++;
        let str = '';
        while (pos < len && input[pos] !== quote) {
          if (input[pos] === '\\' && pos + 1 < len) {
            pos++;
            str += input[pos++];
          } else {
            str += input[pos++];
          }
        }
        if (pos < len && input[pos] === quote) pos++;
        tokens.push({ type: 'string', value: str });
        continue;
      }

      // Identifiers & literals
      if (/[a-zA-Z_$]/.test(ch)) {
        let ident = '';
        while (pos < len && /[a-zA-Z0-9_$]/.test(input[pos])) {
          ident += input[pos++];
        }
        if (ident === 'true') tokens.push({ type: 'boolean', value: true });
        else if (ident === 'false') tokens.push({ type: 'boolean', value: false });
        else if (ident === 'null') tokens.push({ type: 'null', value: null });
        else if (ident === 'undefined') tokens.push({ type: 'undefined', value: undefined });
        else tokens.push({ type: 'ident', value: ident });
        continue;
      }

      // Multi-char operators
      const two = input.slice(pos, pos + 2);
      const three = input.slice(pos, pos + 3);

      if (three === '===' || three === '!==') {
        tokens.push({ type: 'op', value: three });
        pos += 3;
        continue;
      }

      if (['==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '+=', '-=', '=>', '?.'].includes(two)) {
        tokens.push({ type: 'op', value: two });
        pos += 2;
        continue;
      }

      // Single-char operators and punctuation
      if ('+-*/%!<>=?:.,;()[]{}'.includes(ch)) {
        tokens.push({ type: 'punct', value: ch });
        pos++;
        continue;
      }

      pos++;
    }

    return tokens;
  }

  function safeEvaluate(code, scope = {}, magics = {}) {
    if (!code || typeof code !== 'string') return undefined;
    const statements = code.split(';').map((s) => s.trim()).filter(Boolean);
    if (statements.length === 0) return undefined;

    let result = undefined;

    function unwrap(val) {
      return val && val.__pineRef ? val.__pineRef.target[val.__pineRef.key] : val;
    }

    function getTargetForVar(id) {
      if (magics && id in magics) return magics;
      if (scope && id in scope) return scope;
      if (typeof globalThis !== 'undefined' && id in globalThis) return globalThis;
      return scope;
    }

    function resolveVar(id) {
      const tgt = getTargetForVar(id);
      return tgt ? tgt[id] : undefined;
    }

    for (const stmt of statements) {
      const tokens = createTokenizer(stmt);
      if (tokens.length === 0) continue;
      let cursor = 0;

      function peek() {
        return tokens[cursor] || { type: 'eof', value: '' };
      }

      function consume(expectedVal = null) {
        const tok = peek();
        if (expectedVal && tok.value !== expectedVal) {
          throw new Error(`Expected "${expectedVal}", got "${tok.value}"`);
        }
        cursor++;
        return tok;
      }

      function parseExpression() {
        return parseAssignment();
      }

      function parseAssignment() {
        const left = parseTernary();
        const nextTok = peek();
        if (nextTok && (nextTok.value === '=' || nextTok.value === '+=' || nextTok.value === '-=')) {
          const op = consume().value;
          const right = unwrap(parseAssignment());
          if (left && left.__pineRef) {
            const tgt = left.__pineRef.target;
            const k = left.__pineRef.key;
            let nextVal = right;
            if (op === '+=') nextVal = tgt[k] + right;
            if (op === '-=') nextVal = tgt[k] - right;
            tgt[k] = nextVal;
            return nextVal;
          }
        }
        return left;
      }

      function parseTernary() {
        let cond = parseLogicalOr();
        if (peek().value === '?') {
          consume('?');
          const consequent = parseExpression();
          consume(':');
          const alternate = parseExpression();
          return unwrap(cond) ? unwrap(consequent) : unwrap(alternate);
        }
        return cond;
      }

      function parseLogicalOr() {
        let left = parseLogicalAnd();
        while (peek().value === '||' || peek().value === '??') {
          const op = consume().value;
          const right = parseLogicalAnd();
          const l = unwrap(left);
          const r = unwrap(right);
          left = op === '||' ? (l || r) : (l ?? r);
        }
        return left;
      }

      function parseLogicalAnd() {
        let left = parseEquality();
        while (peek().value === '&&') {
          consume('&&');
          const right = parseEquality();
          left = unwrap(left) && unwrap(right);
        }
        return left;
      }

      function parseEquality() {
        let left = parseRelational();
        while (['===', '!==', '==', '!='].includes(peek().value)) {
          const op = consume().value;
          const right = parseRelational();
          const l = unwrap(left);
          const r = unwrap(right);
          if (op === '===') left = l === r;
          else if (op === '!==') left = l !== r;
          else if (op === '==') left = l == r;
          else if (op === '!=') left = l != r;
        }
        return left;
      }

      function parseRelational() {
        let left = parseAdditive();
        while (['<', '<=', '>', '>='].includes(peek().value)) {
          const op = consume().value;
          const right = parseAdditive();
          const l = unwrap(left);
          const r = unwrap(right);
          if (op === '<') left = l < r;
          else if (op === '<=') left = l <= r;
          else if (op === '>') left = l > r;
          else if (op === '>=') left = l >= r;
        }
        return left;
      }

      function parseAdditive() {
        let left = parseMultiplicative();
        while (peek().value === '+' || peek().value === '-') {
          const op = consume().value;
          const right = parseMultiplicative();
          const l = unwrap(left);
          const r = unwrap(right);
          if (op === '+') left = l + r;
          else left = l - r;
        }
        return left;
      }

      function parseMultiplicative() {
        let left = parseUnary();
        while (peek().value === '*' || peek().value === '/' || peek().value === '%') {
          const op = consume().value;
          const right = parseUnary();
          const l = unwrap(left);
          const r = unwrap(right);
          if (op === '*') left = l * r;
          else if (op === '/') left = l / r;
          else if (op === '%') left = l % r;
        }
        return left;
      }

      function parseUnary() {
        const tok = peek();
        if (tok.value === '!') {
          consume('!');
          const val = parseUnary();
          return !unwrap(val);
        }
        if (tok.value === '+') {
          consume('+');
          const val = parseUnary();
          return +unwrap(val);
        }
        if (tok.value === '-') {
          consume('-');
          const val = parseUnary();
          return -unwrap(val);
        }
        if (tok.value === '++') {
          consume('++');
          const val = parseMember();
          if (val && val.__pineRef) {
            return ++val.__pineRef.target[val.__pineRef.key];
          }
          return val;
        }
        if (tok.value === '--') {
          consume('--');
          const val = parseMember();
          if (val && val.__pineRef) {
            return --val.__pineRef.target[val.__pineRef.key];
          }
          return val;
        }
        return parsePostfix();
      }

      function parsePostfix() {
        const expr = parseMember();
        const nextTok = peek();
        if (nextTok.value === '++' || nextTok.value === '--') {
          const op = consume().value;
          if (expr && expr.__pineRef) {
            const oldVal = expr.__pineRef.target[expr.__pineRef.key];
            expr.__pineRef.target[expr.__pineRef.key] = op === '++' ? oldVal + 1 : oldVal - 1;
            return oldVal;
          }
        }
        return expr;
      }

      function parseMember() {
        let base = parsePrimary();

        while (true) {
          const tok = peek();
          if (tok.value === '.' || tok.value === '?.') {
            const isOptional = tok.value === '?.';
            consume();
            const propTok = consume();
            const propName = propTok.value;
            const rawBase = unwrap(base);
            if (isOptional && (rawBase === null || rawBase === undefined)) {
              base = undefined;
              continue;
            }
            base = { __pineRef: { target: rawBase, key: propName } };
          } else if (tok.value === '[') {
            consume('[');
            const indexExpr = unwrap(parseExpression());
            consume(']');
            const rawBase = unwrap(base);
            base = { __pineRef: { target: rawBase, key: indexExpr } };
          } else if (tok.value === '(') {
            consume('(');
            const args = [];
            while (peek().value !== ')' && peek().type !== 'eof') {
              args.push(unwrap(parseExpression()));
              if (peek().value === ',') consume(',');
            }
            consume(')');
            const fn = unwrap(base);
            const contextObj = base && base.__pineRef ? base.__pineRef.target : scope;
            if (typeof fn === 'function') {
              base = fn.apply(contextObj, args);
            } else {
              base = undefined;
            }
          } else {
            break;
          }
        }

        return base;
      }

      function parsePrimary() {
        const tok = peek();
        if (tok.type === 'number' || tok.type === 'string' || tok.type === 'boolean' || tok.type === 'null' || tok.type === 'undefined') {
          consume();
          return tok.value;
        }

        if (tok.type === 'ident') {
          const id = consume().value;
          // Arrow function: ident => expr
          if (peek().value === '=>') {
            consume('=>');
            const bodyTokens = [];
            let depth = 0;
            while (peek().type !== 'eof') {
              const v = peek().value;
              if ((v === ',' || v === ')') && depth === 0) break;
              if (v === '(' || v === '[' || v === '{') depth++;
              if (v === ')' || v === ']' || v === '}') depth--;
              bodyTokens.push(consume());
            }
            return (arg) => {
              const subScope = Object.assign(Object.create(scope), { [id]: arg });
              return safeEvaluate(bodyTokens.map((t) => (t.type === 'string' ? `'${t.value}'` : t.value)).join(' '), subScope, magics);
            };
          }
          return { __pineRef: { target: getTargetForVar(id), key: id } };
        }

        if (tok.value === '(') {
          consume('(');
          // Lookahead for arrow function: (a, b) => expr
          let i = cursor;
          let parenDepth = 1;
          while (i < tokens.length) {
            if (tokens[i].value === '(') parenDepth++;
            else if (tokens[i].value === ')') {
              parenDepth--;
              if (parenDepth === 0) break;
            }
            i++;
          }
          if (i + 1 < tokens.length && tokens[i + 1].value === '=>') {
            const paramNames = [];
            while (peek().value !== ')') {
              if (peek().type === 'ident') paramNames.push(consume().value);
              else consume();
            }
            consume(')');
            consume('=>');
            const bodyTokens = [];
            let depth = 0;
            while (peek().type !== 'eof') {
              const v = peek().value;
              if ((v === ',' || v === ')') && depth === 0) break;
              if (v === '(' || v === '[' || v === '{') depth++;
              if (v === ')' || v === ']' || v === '}') depth--;
              bodyTokens.push(consume());
            }
            return (...args) => {
              const subScope = Object.create(scope);
              paramNames.forEach((name, idx) => {
                subScope[name] = args[idx];
              });
              return safeEvaluate(bodyTokens.map((t) => (t.type === 'string' ? `'${t.value}'` : t.value)).join(' '), subScope, magics);
            };
          }

          const expr = parseExpression();
          consume(')');
          return expr;
        }

        if (tok.value === '[') {
          consume('[');
          const arr = [];
          while (peek().value !== ']' && peek().type !== 'eof') {
            arr.push(unwrap(parseExpression()));
            if (peek().value === ',') consume(',');
          }
          consume(']');
          return arr;
        }

        if (tok.value === '{') {
          consume('{');
          const obj = {};
          while (peek().value !== '}' && peek().type !== 'eof') {
            let key;
            const kTok = consume();
            if (kTok.type === 'string' || kTok.type === 'ident' || kTok.type === 'number') {
              key = kTok.value;
            }
            if (peek().value === ':') {
              consume(':');
              obj[key] = unwrap(parseExpression());
            } else {
              obj[key] = resolveVar(key);
            }
            if (peek().value === ',') consume(',');
          }
          consume('}');
          return obj;
        }

        throw new Error(`Unexpected token "${tok.value}"`);
      }

      result = unwrap(parseExpression());
    }

    return result;
  }

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
        fn = (scope, magics) => safeEvaluate(trimmed, scope, magics);
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

    if (cspMode) {
      try {
        return safeEvaluate(expression, scopeData, magics);
      } catch (err) {
        handleError(err, el, expression);
        return undefined;
      }
    }

    try {
      const evaluator = buildEvaluator(expression);
      return evaluator(scopeData, magics);
    } catch (err) {
      // If CSP blocks eval, or error occurred, fallback to safe evaluator
      if (err.name === 'EvalError' || /unsafe-eval|CSP|Function/i.test(err.message)) {
        try {
          return safeEvaluate(expression, scopeData, magics);
        } catch (innerErr) {
          handleError(innerErr, el, expression);
          return undefined;
        }
      }
      handleError(err, el, expression);
      return undefined;
    }
  }

  function evaluateSetter(el, expression, value, additionalContext = {}) {
    if (!expression || typeof expression !== 'string') return;
    const scope = getScope(el);
    const scopeData = scope ? scope.data : {};
    const magics = getMagicScope(el, additionalContext);

    if (cspMode) {
      try {
        safeEvaluate(`${expression} = __val__`, scopeData, { ...magics, __val__: value });
      } catch (err) {
        handleError(err, el, expression);
      }
      return;
    }

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
      if (err.name === 'EvalError' || /unsafe-eval|CSP|Function/i.test(err.message)) {
        try {
          safeEvaluate(`${expression} = __val__`, scopeData, { ...magics, __val__: value });
          return;
        } catch (innerErr) {
          handleError(innerErr, el, expression);
          return;
        }
      }
      handleError(err, el, expression);
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
  // 5.5. REALTIME STREAMING ENGINES ($sse & $websocket)
  // =========================================================================
  function createSSEResource(urlInput, options = {}, el = null) {
    const url = typeof urlInput === 'function' ? urlInput() : urlInput;
    let eventSource = null;

    const state = reactive({
      status: 'connecting',
      data: null,
      text: '',
      event: 'message',
      lastEventId: '',
      history: [],
      close() {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        state.status = 'closed';
      }
    });

    if (typeof EventSource !== 'undefined' && url) {
      try {
        eventSource = new EventSource(url, options);

        eventSource.onopen = () => {
          state.status = 'open';
        };

        eventSource.onerror = () => {
          if (eventSource && eventSource.readyState === EventSource.CLOSED) {
            state.status = 'closed';
          } else {
            state.status = 'error';
          }
        };

        const handleMsg = (e) => {
          state.text = e.data || '';
          state.event = e.type || 'message';
          state.lastEventId = e.lastEventId || '';
          let parsed = e.data;
          try {
            parsed = JSON.parse(e.data);
          } catch {}
          state.data = parsed;
          state.history.push(parsed);
          const maxHistory = options.maxHistory || 50;
          if (state.history.length > maxHistory) {
            state.history.shift();
          }
        };

        eventSource.onmessage = handleMsg;

        if (Array.isArray(options.events)) {
          options.events.forEach((evtName) => {
            eventSource.addEventListener(evtName, handleMsg);
          });
        }
      } catch (err) {
        state.status = 'error';
      }
    }

    if (el) {
      const scope = getScope(el);
      if (scope) {
        scope.addCleanup(() => state.close());
      }
    }

    return state;
  }

  function createWebSocketResource(urlInput, options = {}, el = null) {
    const url = typeof urlInput === 'function' ? urlInput() : urlInput;
    let ws = null;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let manuallyClosed = false;

    const autoReconnect = options.autoReconnect !== undefined ? Boolean(options.autoReconnect) : true;
    const maxRetries = options.maxRetries !== undefined ? Number(options.maxRetries) : 10;
    const protocols = options.protocols || undefined;

    const state = reactive({
      status: 'connecting',
      data: null,
      text: '',
      history: [],
      send(payload) {
        if (!ws || ws.readyState !== (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1)) {
          console.warn('[PineJS] Cannot send: WebSocket is not open.');
          return false;
        }
        const toSend = typeof payload === 'object' && !(typeof Blob !== 'undefined' && payload instanceof Blob) && !(typeof ArrayBuffer !== 'undefined' && payload instanceof ArrayBuffer)
          ? JSON.stringify(payload)
          : payload;
        ws.send(toSend);
        return true;
      },
      close() {
        manuallyClosed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (ws) {
          ws.close();
          ws = null;
        }
        state.status = 'closed';
      }
    });

    function connect() {
      if (typeof WebSocket === 'undefined' || !url || manuallyClosed) return;

      try {
        state.status = 'connecting';
        ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);

        ws.onopen = () => {
          reconnectAttempts = 0;
          state.status = 'open';
        };

        ws.onmessage = (e) => {
          state.text = typeof e.data === 'string' ? e.data : '';
          let parsed = e.data;
          if (typeof e.data === 'string') {
            try {
              parsed = JSON.parse(e.data);
            } catch {}
          }
          state.data = parsed;
          state.history.push(parsed);
          const maxHistory = options.maxHistory || 50;
          if (state.history.length > maxHistory) {
            state.history.shift();
          }
        };

        ws.onerror = () => {
          state.status = 'error';
        };

        ws.onclose = () => {
          if (!manuallyClosed) {
            state.status = 'closed';
            if (autoReconnect && reconnectAttempts < maxRetries) {
              reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
              reconnectTimer = setTimeout(() => {
                if (!manuallyClosed) connect();
              }, delay);
            }
          } else {
            state.status = 'closed';
          }
        };
      } catch (err) {
        state.status = 'error';
      }
    }

    connect();

    if (el) {
      const scope = getScope(el);
      if (scope) {
        scope.addCleanup(() => state.close());
      }
    }

    return state;
  }

  // =========================================================================
  // 4.5. DEVTOOLS EXTENSION GLOBAL HOOK (window.__PINE_DEVTOOLS_GLOBAL_HOOK__)
  // =========================================================================
  let devtoolsHook = null;
  if (typeof window !== 'undefined') {
    if (!window.__PINE_DEVTOOLS_GLOBAL_HOOK__) {
      const listeners = new Map();
      window.__PINE_DEVTOOLS_GLOBAL_HOOK__ = {
        version: '1.7.0',
        on(event, fn) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event).add(fn);
          return () => listeners.get(event)?.delete(fn);
        },
        emit(event, payload) {
          if (listeners.has(event)) {
            listeners.get(event).forEach((fn) => {
              try { fn(payload); } catch (e) { console.error('[Pine DevTools Error]', e); }
            });
          }
        },
        getRoots() {
          return findRoots();
        },
        getScope(element) {
          return getScope(element);
        },
        getComponentTree() {
          const roots = findRoots();
          function serialize(node) {
            if (!node || node.nodeType !== 1) return null;
            const scope = getScope(node);
            const children = [];
            for (let i = 0; i < node.children.length; i++) {
              const s = serialize(node.children[i]);
              if (s) children.push(s);
            }
            return {
              tag: node.tagName.toLowerCase(),
              id: node.id || null,
              classes: Array.from(node.classList || []),
              hasScope: Boolean(scope),
              data: scope ? { ...scope.data } : null,
              children
            };
          }
          return roots.map(serialize);
        }
      };
    }
    devtoolsHook = window.__PINE_DEVTOOLS_GLOBAL_HOOK__;
  }

  function emitDevTools(event, payload) {
    if (devtoolsHook) {
      devtoolsHook.emit(event, payload);
    }
  }

  // =========================================================================
  // 5.6. CLIENT-SIDE MICRO-ROUTER ENGINE
  // =========================================================================
  const routerPathSignal = signal(
    typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  );
  const routerQuerySignal = signal(
    typeof window !== 'undefined' ? window.location.search || '' : ''
  );
  const routerParamsSignal = signal({});
  const routerHashSignal = signal(
    typeof window !== 'undefined' ? window.location.hash || '' : ''
  );

  const routeGuards = [];

  function matchRoutePattern(pattern, currentPath) {
    if (!pattern || pattern === '*' || pattern === '.*') {
      return { matches: true, params: {} };
    }
    if (pattern === currentPath) {
      return { matches: true, params: {} };
    }

    const paramNames = [];
    const regexPattern = '^' + pattern
      .replace(/[-\/\\^$*+?.()|[\]{}]/g, (match) => (match === '*' ? '.*' : '\\' + match))
      .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      }) + '$';

    try {
      const rx = new RegExp(regexPattern);
      const match = currentPath.match(rx);
      if (match) {
        const params = {};
        paramNames.forEach((name, idx) => {
          params[name] = decodeURIComponent(match[idx + 1] || '');
        });
        return { matches: true, params };
      }
    } catch {}

    return { matches: false, params: {} };
  }

  const router = {
    get path() {
      return routerPathSignal.value;
    },
    get query() {
      return routerQuerySignal.value;
    },
    get params() {
      return routerParamsSignal.value;
    },
    get hash() {
      return routerHashSignal.value;
    },
    navigate(toPath, options = {}) {
      if (typeof window === 'undefined') return false;
      for (const guard of routeGuards) {
        if (guard(toPath, routerPathSignal.value) === false) {
          return false;
        }
      }

      const updateHistoryAndState = () => {
        if (options.replace) {
          window.history.replaceState({}, '', toPath);
        } else {
          window.history.pushState({}, '', toPath);
        }
        routerPathSignal.value = window.location.pathname;
        routerQuerySignal.value = window.location.search;
        routerHashSignal.value = window.location.hash;
        window.dispatchEvent(new CustomEvent('pine:route', { detail: { path: window.location.pathname } }));
        emitDevTools('route:change', { path: window.location.pathname });
      };

      if (options.transition !== false && typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
        try {
          document.startViewTransition(updateHistoryAndState);
          return true;
        } catch {
          updateHistoryAndState();
          return true;
        }
      }

      updateHistoryAndState();
      return true;
    },
    beforeEach(guardFn) {
      if (typeof guardFn === 'function') {
        routeGuards.push(guardFn);
        return () => {
          const idx = routeGuards.indexOf(guardFn);
          if (idx > -1) routeGuards.splice(idx, 1);
        };
      }
      return () => {};
    },
    match(pattern, path = routerPathSignal.value) {
      return matchRoutePattern(pattern, path);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      routerPathSignal.value = window.location.pathname;
      routerQuerySignal.value = window.location.search;
      routerHashSignal.value = window.location.hash;
      emitDevTools('route:change', { path: window.location.pathname });
    });
  }

  // =========================================================================
  // 5.7. UNIFIED REACTIVE FORM ENGINE ($form & Pine.form)
  // =========================================================================
  function createForm(initialValues = {}, options = {}) {
    const initialSnapshot = deepClone(initialValues);
    const values = reactive(deepClone(initialValues));
    const errors = reactive({});
    const touched = reactive({});
    const submitting = signal(false);
    const submitted = signal(false);
    const submitCount = signal(0);

    const formObj = {
      values,
      initial: initialSnapshot,
      errors,
      touched,
      get dirty() {
        return !deepEqual(values, initialSnapshot);
      },
      get pristine() {
        return !this.dirty;
      },
      get valid() {
        return Object.values(errors).filter(Boolean).length === 0;
      },
      get invalid() {
        return !this.valid;
      },
      get submitting() {
        return submitting.value;
      },
      get submitted() {
        return submitted.value;
      },
      get submitCount() {
        return submitCount.value;
      },
      isDirty(field) {
        return !deepEqual(values[field], initialSnapshot[field]);
      },
      isTouched(field) {
        return Boolean(touched[field]);
      },
      touch(field) {
        touched[field] = true;
      },
      setError(field, msg) {
        errors[field] = msg;
      },
      setErrors(errs) {
        if (isObject(errs)) {
          for (const [k, v] of Object.entries(errs)) {
            errors[k] = v;
          }
        }
      },
      clearErrors() {
        for (const k of Object.keys(errors)) {
          delete errors[k];
        }
      },
      reset() {
        for (const k of Object.keys(values)) {
          if (!(k in initialSnapshot)) {
            delete values[k];
          }
        }
        for (const [k, v] of Object.entries(initialSnapshot)) {
          values[k] = deepClone(v);
        }
        this.clearErrors();
        for (const k of Object.keys(touched)) {
          delete touched[k];
        }
        submitting.value = false;
      },
      formData() {
        const fd = new FormData();
        for (const [k, v] of Object.entries(values)) {
          if (v instanceof Blob || v instanceof File) {
            fd.append(k, v);
          } else if (isObject(v)) {
            fd.append(k, JSON.stringify(v));
          } else if (v !== undefined && v !== null) {
            fd.append(k, String(v));
          }
        }
        return fd;
      },
      json() {
        return JSON.parse(JSON.stringify(values));
      },
      async submit(endpointOrHandler, submitOptions = {}) {
        submitting.value = true;
        submitted.value = true;
        submitCount.value++;
        emitDevTools('form:submit', { values });

        try {
          if (typeof endpointOrHandler === 'function') {
            const res = await endpointOrHandler(values, formObj);
            return res;
          } else if (typeof endpointOrHandler === 'string') {
            const method = submitOptions.method || 'POST';
            const headers = {
              'Content-Type': 'application/json',
              ...(submitOptions.headers || {})
            };
            const response = await fetch(endpointOrHandler, {
              method,
              headers,
              body: JSON.stringify(values)
            });
            if (!response.ok) {
              try {
                const data = await response.json();
                if (data.errors) formObj.setErrors(data.errors);
              } catch {}
              throw new Error(`HTTP ${response.status}: Form submission failed`);
            }
            return await response.json();
          }
        } catch (err) {
          throw err;
        } finally {
          submitting.value = false;
        }
      }
    };

    return formObj;
  }

  // =========================================================================
  // 5.8. ASYNC SUSPENSE & SKELETON ENGINE
  // =========================================================================
  const suspenseRegistry = new WeakMap();

  function registerSuspensePromise(el, promise) {
    let current = el;
    while (current) {
      if (suspenseRegistry.has(current)) {
        const controller = suspenseRegistry.get(current);
        controller.track(promise);
        return;
      }
      current = current.parentElement;
    }
  }

  // =========================================================================
  // 5.9. REMOTE COMPONENT LOADER ENGINE (p-component & Pine.loadComponent)
  // =========================================================================
  const componentCache = new Map();

  async function loadRemoteComponent(url, options = {}) {
    if (componentCache.has(url) && !options.forceReload) {
      return componentCache.get(url);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load component from ${url}: HTTP ${res.status}`);
    const htmlText = await res.text();
    componentCache.set(url, htmlText);
    return htmlText;
  }

  // =========================================================================
  // 5.10. INDEXEDDB OFFLINE STORAGE ENGINE ($idb & Pine.idb)
  // =========================================================================
  function createIdbResource(initialValue, key, dbName = 'pine_db', storeName = 'store', el = null) {
    const sig = signal(initialValue);
    let db = null;
    let saveTimeout = null;

    if (typeof indexedDB !== 'undefined') {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      };
      req.onsuccess = (e) => {
        db = e.target.result;
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          if (getReq.result !== undefined) {
            sig.value = getReq.result;
          } else {
            const putTx = db.transaction(storeName, 'readwrite');
            putTx.objectStore(storeName).put(initialValue, key);
          }
        };
      };
    }

    const rx = reactive({
      get value() {
        return sig.value;
      },
      set value(nextVal) {
        sig.value = nextVal;
        if (db) {
          if (saveTimeout) clearTimeout(saveTimeout);
          saveTimeout = setTimeout(() => {
            try {
              const tx = db.transaction(storeName, 'readwrite');
              tx.objectStore(storeName).put(nextVal, key);
            } catch (err) {
              console.warn('[PineJS] $idb save error:', err);
            }
          }, 60);
        }
      },
      toString() {
        return String(sig.value);
      },
      valueOf() {
        return sig.value;
      }
    });

    const scope = getScope(el);
    if (scope && el) {
      scope.addCleanup(() => {
        if (saveTimeout) clearTimeout(saveTimeout);
        if (db) db.close();
      });
    }

    return rx;
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
        let stored = null;
        try {
          stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        } catch {}

        let currentVal = initialValue;
        if (stored !== null) {
          try {
            currentVal = JSON.parse(stored);
          } catch {
            currentVal = stored;
          }
        } else if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(key, JSON.stringify(initialValue));
          } catch {}
        }

        let saveScheduled = false;
        function scheduleSave(valToSave) {
          if (saveScheduled) return;
          saveScheduled = true;
          const saveAction = () => {
            saveScheduled = false;
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, JSON.stringify(valToSave));
              }
            } catch (e) {
              console.warn('[PineJS] $persist write failed:', e);
            }
          };
          if (typeof queueMicrotask === 'function') {
            queueMicrotask(saveAction);
          } else {
            setTimeout(saveAction, 0);
          }
        }

        function createDeepPersistProxy(target) {
          if (!isObject(target)) return target;
          const rx = reactive(target);
          return new Proxy(rx, {
            get(t, prop, receiver) {
              if (prop === 'value') return t;
              if (prop === RAW_SYMBOL) return currentVal;
              const res = Reflect.get(t, prop, receiver);
              return isObject(res) ? createDeepPersistProxy(res) : res;
            },
            set(t, prop, val, receiver) {
              if (prop === 'value' && isObject(val)) {
                currentVal = val;
                scheduleSave(currentVal);
                return true;
              }
              const res = Reflect.set(t, prop, val, receiver);
              scheduleSave(currentVal);
              return res;
            },
            deleteProperty(t, prop) {
              const res = Reflect.deleteProperty(t, prop);
              scheduleSave(currentVal);
              return res;
            }
          });
        }

        if (isObject(currentVal)) {
          return createDeepPersistProxy(currentVal);
        }

        const sig = signal(currentVal);
        return reactive({
          get value() {
            return sig.value;
          },
          set value(v) {
            sig.value = v;
            scheduleSave(v);
          }
        });
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
          const scope = getScope(el);
          if (scope) scope.addCleanup(() => window.removeEventListener('popstate', popHandler));
        }

        return rxVal;
      };
    },
    $broadcast(el) {
      return (initialValue, channelName) => {
        const name = channelName || el.getAttribute('name') || el.id || 'pine_broadcast';
        let channel = null;
        let isBroadcasting = false;

        const sig = signal(initialValue);

        if (typeof BroadcastChannel !== 'undefined') {
          try {
            channel = new BroadcastChannel(name);
            channel.onmessage = (event) => {
              if (!isBroadcasting && event.data !== undefined) {
                isBroadcasting = true;
                sig.value = event.data;
                isBroadcasting = false;
              }
            };
          } catch {}
        }

        const rxVal = reactive({
          get value() {
            return sig.value;
          },
          set value(v) {
            sig.value = v;
            if (channel && !isBroadcasting) {
              isBroadcasting = true;
              try {
                channel.postMessage(v);
              } catch (e) {
                console.warn('[PineJS] $broadcast postMessage error:', e);
              }
              isBroadcasting = false;
            }
          },
          toString() {
            return String(sig.value);
          },
          valueOf() {
            return sig.value;
          }
        });

        const scope = getScope(el);
        if (scope && channel) {
          scope.addCleanup(() => channel.close());
        }

        return rxVal;
      };
    },
    $viewTransition() {
      return (callback) => {
        let executed = false;
        const runCallback = () => {
          if (!executed && typeof callback === 'function') {
            executed = true;
            return callback();
          }
        };

        if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
          try {
            const vt = document.startViewTransition(runCallback);
            setTimeout(runCallback, 20);
            return vt;
          } catch (_) {
            return Promise.resolve(runCallback());
          }
        }
        return Promise.resolve(runCallback());
      };
    },
    $sse(el) {
      return (url, options = {}) => createSSEResource(url, options, el);
    },
    $websocket(el) {
      return (url, options = {}) => createWebSocketResource(url, options, el);
    },
    $ws(el) {
      return (url, options = {}) => createWebSocketResource(url, options, el);
    },
    $route() {
      return {
        get path() {
          return router.path;
        },
        get query() {
          return router.query;
        },
        get params() {
          return router.params;
        },
        get hash() {
          return router.hash;
        },
        push: (to, opt) => router.navigate(to, opt),
        replace: (to, opt) => router.navigate(to, { ...(opt || {}), replace: true }),
        go: (n) => (typeof window !== 'undefined' ? window.history.go(n) : null),
        active: (pattern) => router.match(pattern).matches
      };
    },
    $form(el) {
      return (initialValues, options) => createForm(initialValues, options);
    },
    $idb(el) {
      return (initialValue, key, dbName, storeName) => createIdbResource(initialValue, key, dbName, storeName, el);
    },
    $suspense(el) {
      return (promise) => registerSuspensePromise(el, promise);
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
    // p-data: Root component initialization (supports inline objects, Pine.data, script variables & functions)
    'p-data': (el, { expression }) => {
      let initialData = {};
      if (expression && expression.trim()) {
        const trimmed = expression.trim();
        if (registeredData.has(trimmed)) {
          const factory = registeredData.get(trimmed);
          initialData = typeof factory === 'function' ? factory.call(el, el) : factory;
        } else {
          // Provide registeredData in evaluation context for parameterized calls like dropdown(true)
          const dataContext = {};
          for (const [name, factory] of registeredData.entries()) {
            dataContext[name] = factory;
          }
          let evaluated = evaluate(el, expression, dataContext);

          // If evaluated is undefined and matches a global variable on window/globalThis
          if (evaluated === undefined && typeof globalThis !== 'undefined' && trimmed in globalThis) {
            evaluated = globalThis[trimmed];
          }

          if (typeof evaluated === 'function') {
            initialData = evaluated.call(el, el);
          } else if (isObject(evaluated)) {
            initialData = evaluated;
          } else {
            initialData = {};
          }
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

    // p-scope: Isolated child scope creation
    'p-scope': (el, { expression }) => {
      let initialData = {};
      if (expression && expression.trim()) {
        const evaluated = evaluate(el, expression);
        if (isObject(evaluated)) initialData = evaluated;
      }
      const parentScope = getScope(el.parentElement);
      const scope = new Scope(initialData, parentScope, el);
      el[SCOPE_SYMBOL] = scope;
      el.__pine_scope__ = scope;
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

      let timer = null;
      let inThrottle = false;
      let wasHiddenAtStart = false;

      const captureHandler = isOutside && typeof document !== 'undefined' ? () => {
        wasHiddenAtStart = (
          el.style.display === 'none' ||
          (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0)
        );
      } : null;

      if (captureHandler) {
        document.addEventListener(eventName, captureHandler, { capture: true, passive: true });
      }

      const handler = (event) => {
        if (isSelf && event.target !== el) return;
        if (isPrevent) event.preventDefault();
        if (isStop) event.stopPropagation();

        // Keyboard modifier keys (.ctrl, .meta, .cmd, .shift, .alt)
        if (modifiers.includes('ctrl') && !event.ctrlKey) return;
        if ((modifiers.includes('meta') || modifiers.includes('cmd')) && !event.metaKey) return;
        if (modifiers.includes('shift') && !event.shiftKey) return;
        if (modifiers.includes('alt') && !event.altKey) return;

        // Mouse button modifiers (.left, .middle, .right)
        if (modifiers.includes('left') && event.button !== 0) return;
        if (modifiers.includes('middle') && event.button !== 1) return;
        if (modifiers.includes('right') && event.button !== 2) return;

        if (isOutside) {
          if (!el.isConnected) return;
          if (wasHiddenAtStart) return;
          if (el.contains(event.target)) return;
          if (el.style.display === 'none' || (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0)) return;
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

        if (event instanceof KeyboardEvent) {
          const nonKeyMods = new Set([
            'window', 'document', 'outside', 'once', 'passive', 'capture',
            'self', 'prevent', 'stop', 'ctrl', 'meta', 'cmd', 'shift', 'alt',
            'left', 'middle', 'right'
          ]);
          const candidateKeys = modifiers.filter((m) => !nonKeyMods.has(m) && !m.startsWith('debounce') && !m.startsWith('throttle'));
          if (candidateKeys.length > 0) {
            const key = event.key ? event.key.toLowerCase() : '';
            const match = candidateKeys.some((m) => {
              if (m === 'enter') return key === 'enter';
              if (m === 'escape' || m === 'esc') return key === 'escape' || key === 'esc';
              if (m === 'tab') return key === 'tab';
              if (m === 'space') return key === ' ' || key === 'spacebar';
              if (m === 'delete') return key === 'delete' || key === 'backspace';
              if (m === 'slash') return key === '/';
              if (m === 'arrow-up') return key === 'arrowup';
              if (m === 'arrow-down') return key === 'arrowdown';
              if (m === 'arrow-left') return key === 'arrowleft';
              if (m === 'arrow-right') return key === 'arrowright';
              return key === m.toLowerCase();
            });
            if (!match) return;
          }
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
          if (captureHandler) {
            document.removeEventListener(eventName, captureHandler, { capture: true });
          }
          if (timer) clearTimeout(timer);
        });
      }
    },

    // p-text: Atomic text node reactivity
    'p-text': (el, { expression }) => {
      const stop = effect(() => {
        let value = evaluate(el, expression);
        if (value && typeof value === 'object' && 'value' in value && !Array.isArray(value)) {
          value = value.value;
        }
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

    // p-show: Visibility toggling with transitions & accessible a11y auto-sync
    'p-show': (el, { expression, modifiers }) => {
      const originalDisplay = el.style.display === 'none' ? '' : el.style.display || '';
      let wasHidden = true;

      function updateA11y(isShown) {
        el.setAttribute('aria-hidden', isShown ? 'false' : 'true');
        if (el.hasAttribute('aria-expanded')) {
          el.setAttribute('aria-expanded', isShown ? 'true' : 'false');
        }
        if (el.id) {
          try {
            const triggers = document.querySelectorAll(`[aria-controls="${el.id}"]`);
            triggers.forEach((t) => t.setAttribute('aria-expanded', isShown ? 'true' : 'false'));
          } catch {}
        }
      }

      const stop = effect(() => {
        const isShown = Boolean(evaluate(el, expression));
        updateA11y(isShown);

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

    // p-if: Conditional DOM rendering with p-else-if, p-else, and multi-child support
    'p-if': (templateEl, { expression }) => {
      if (templateEl.tagName.toLowerCase() !== 'template') {
        console.warn('[PineJS] p-if must be used on a <template> tag.');
        return;
      }

      const branches = [{ template: templateEl, expression, type: 'if' }];

      // Scan contiguous sibling <template> tags for p-else-if or p-else
      let nextEl = templateEl.nextElementSibling;
      while (nextEl && nextEl.tagName && nextEl.tagName.toLowerCase() === 'template') {
        let isBranch = false;
        const attrs = Array.from(nextEl.attributes || []);
        for (const attr of attrs) {
          const parsed = parseDirective(attr.name);
          if (parsed) {
            if (parsed.directive === 'p-else-if') {
              nextEl._pineHandled = true;
              branches.push({ template: nextEl, expression: attr.value, type: 'else-if' });
              isBranch = true;
              break;
            } else if (parsed.directive === 'p-else') {
              nextEl._pineHandled = true;
              branches.push({ template: nextEl, expression: 'true', type: 'else' });
              isBranch = true;
              break;
            }
          }
        }
        if (!isBranch) break;
        nextEl = nextEl.nextElementSibling;
      }

      const marker = document.createComment('pine-if');
      templateEl.parentElement.insertBefore(marker, templateEl);

      let currentBranchIndex = -1;
      let currentNodes = [];
      let currentScope = null;

      const stop = effect(() => {
        let matchingIndex = -1;
        for (let i = 0; i < branches.length; i++) {
          const branch = branches[i];
          if (branch.type === 'else') {
            matchingIndex = i;
            break;
          }
          if (Boolean(evaluate(branch.template, branch.expression))) {
            matchingIndex = i;
            break;
          }
        }

        if (matchingIndex === currentBranchIndex) return;

        // Cleanup previously mounted elements
        if (currentNodes.length > 0) {
          if (currentScope) currentScope.destroy();
          currentNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) destroyTree(node);
            if (node.isConnected) node.remove();
          });
          currentNodes = [];
          currentScope = null;
        }

        currentBranchIndex = matchingIndex;

        if (matchingIndex > -1) {
          const activeBranch = branches[matchingIndex];
          const fragment = activeBranch.template.content.cloneNode(true);
          const parentScope = getScope(activeBranch.template);
          const childScope = new Scope({}, parentScope, null);
          currentScope = childScope;

          const nodesToInsert = Array.from(fragment.childNodes);
          const parent = marker.parentElement;

          nodesToInsert.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node[SCOPE_SYMBOL] = childScope;
              node.__pine_scope__ = childScope;
              node._pineScope = childScope;
            }
            parent.insertBefore(node, marker);
            if (node.nodeType === Node.ELEMENT_NODE) {
              initTree(node);
            }
          });

          currentNodes = nodesToInsert;
        }
      });

      const scope = getScope(templateEl);
      if (scope) {
        scope.addCleanup(stop);
        scope.addCleanup(() => {
          if (currentNodes.length > 0) {
            if (currentScope) currentScope.destroy();
            currentNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) destroyTree(node);
              if (node.isConnected) node.remove();
            });
            currentNodes = [];
          }
          if (marker.isConnected) marker.remove();
        });
      }
    },

    // p-for: Fine-grained keyed list rendering with multi-child and custom :key support
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

      const keyAttr = templateEl.getAttribute(':key') ||
                      templateEl.getAttribute('p-bind:key') ||
                      templateEl.getAttribute('pine-bind:key') ||
                      templateEl.getAttribute('key');

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
          let key;
          if (keyAttr) {
            key = evaluate(templateEl, keyAttr, { [itemVar]: item, ...(indexVar ? { [indexVar]: index } : {}) });
          } else {
            key = item && item.id !== undefined ? item.id : (item && item._id !== undefined ? item._id : index);
          }

          const existingIdx = renderedNodes.findIndex((n) => n.key === key);

          if (existingIdx > -1) {
            const existing = renderedNodes.splice(existingIdx, 1)[0];
            existing.scope.data[itemVar] = item;
            if (indexVar) existing.scope.data[indexVar] = index;
            existing.nodes.forEach((n) => parent.insertBefore(n, marker));
            newRenderedNodes.push(existing);
          } else {
            const fragment = templateEl.content.cloneNode(true);
            const parentScope = getScope(templateEl);
            const loopData = { [itemVar]: item };
            if (indexVar) loopData[indexVar] = index;

            const childScope = new Scope(loopData, parentScope, null);
            const clonedNodes = Array.from(fragment.childNodes);

            clonedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                node[SCOPE_SYMBOL] = childScope;
                node.__pine_scope__ = childScope;
                node._pineScope = childScope;
              }
              parent.insertBefore(node, marker);
              if (node.nodeType === Node.ELEMENT_NODE) {
                initTree(node);
              }
            });

            newRenderedNodes.push({ nodes: clonedNodes, scope: childScope, key });
          }
        });

        renderedNodes.forEach(({ nodes, scope }) => {
          if (scope) scope.destroy();
          nodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) destroyTree(node);
            if (node.isConnected) node.remove();
          });
        });

        renderedNodes = newRenderedNodes;
      });

      const scope = getScope(templateEl);
      if (scope) {
        scope.addCleanup(stop);
        scope.addCleanup(() => {
          renderedNodes.forEach(({ nodes, scope: s }) => {
            if (s) s.destroy();
            nodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) destroyTree(node);
              if (node.isConnected) node.remove();
            });
          });
          if (marker.isConnected) marker.remove();
        });
      }
    },

    // p-transition: CSS transition engine with auto presets
    'p-transition': (el, { arg, expression, modifiers }) => {
      setupTransition(el, { arg, expression, modifiers });
    },

    // p-collapse: Smooth accordion height animation with accessible a11y auto-sync
    'p-collapse': (el) => {
      el.style.overflow = 'hidden';
      el.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';

      function updateCollapseA11y(isShown) {
        el.setAttribute('aria-hidden', isShown ? 'false' : 'true');
        if (el.hasAttribute('aria-expanded')) {
          el.setAttribute('aria-expanded', isShown ? 'true' : 'false');
        }
        if (el.id) {
          try {
            const triggers = document.querySelectorAll(`[aria-controls="${el.id}"]`);
            triggers.forEach((t) => t.setAttribute('aria-expanded', isShown ? 'true' : 'false'));
          } catch {}
        }
      }

      el._pineTransition = {
        enter() {
          updateCollapseA11y(true);
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
          updateCollapseA11y(false);
          el.style.height = `${el.scrollHeight}px`;
          requestAnimationFrame(() => {
            el.style.height = '0px';
            el.style.opacity = '0';
            setTimeout(done, 300);
          });
        }
      };
    },

    // p-trap: Declarative accessible focus trap
    'p-trap': (el, { expression }) => {
      let isTrapped = false;
      let previousActive = null;

      const getFocusables = () => {
        return Array.from(el.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((node) => node.offsetWidth > 0 || node.offsetHeight > 0 || node.getClientRects().length > 0);
      };

      const handleKeydown = (e) => {
        if (!isTrapped || e.key !== 'Tab') return;
        const focusables = getFocusables();
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !el.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !el.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      const activateTrap = () => {
        if (isTrapped) return;
        isTrapped = true;
        previousActive = document.activeElement;
        document.addEventListener('keydown', handleKeydown);
        const focusables = getFocusables();
        if (focusables.length > 0) {
          focusables[0].focus();
        } else if (el.focus) {
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
          el.focus();
        }
      };

      const deactivateTrap = () => {
        if (!isTrapped) return;
        isTrapped = false;
        document.removeEventListener('keydown', handleKeydown);
        if (previousActive && previousActive.focus) {
          try { previousActive.focus(); } catch {}
        }
      };

      if (!expression) {
        activateTrap();
      } else {
        const stop = effect(() => {
          const shouldTrap = Boolean(evaluate(el, expression));
          if (shouldTrap) {
            activateTrap();
          } else {
            deactivateTrap();
          }
        });
        const scope = getScope(el);
        if (scope) scope.addCleanup(stop);
      }

      const scope = getScope(el);
      if (scope) scope.addCleanup(deactivateTrap);
    },

    // p-mask: Input masking helper supporting digits (9), letters (a), and alphanumeric (*)
    'p-mask': (el, { expression }) => {
      const maskFormat = expression.replace(/['"]/g, '');
      const handleMask = () => {
        let val = el.value;
        let formatted = '';
        let valIdx = 0;
        for (let i = 0; i < maskFormat.length && valIdx < val.length; i++) {
          const m = maskFormat[i];
          if (m === '9') {
            while (valIdx < val.length && !/\d/.test(val[valIdx])) {
              valIdx++;
            }
            if (valIdx < val.length) {
              formatted += val[valIdx++];
            }
          } else if (m === 'a' || m === 'A') {
            while (valIdx < val.length && !/[a-zA-Z]/.test(val[valIdx])) {
              valIdx++;
            }
            if (valIdx < val.length) {
              formatted += val[valIdx++];
            }
          } else if (m === '*') {
            while (valIdx < val.length && !/[a-zA-Z0-9]/.test(val[valIdx])) {
              valIdx++;
            }
            if (valIdx < val.length) {
              formatted += val[valIdx++];
            }
          } else {
            formatted += m;
            if (val[valIdx] === m) {
              valIdx++;
            }
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

    // p-teleport: Mount elements into another DOM container (with multi-child & dynamic target support)
    'p-teleport': (templateEl, { expression }) => {
      if (templateEl.tagName.toLowerCase() !== 'template') return;
      const targetSelector = expression || 'body';

      function mountTeleport(targetContainer) {
        if (!targetContainer) return;
        const fragment = templateEl.content.cloneNode(true);
        const childNodes = Array.from(fragment.childNodes);
        const parentScope = getScope(templateEl);
        const childScope = new Scope({}, parentScope, templateEl);
        const mountedNodes = [];

        childNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            node[SCOPE_SYMBOL] = childScope;
            node.__pine_scope__ = childScope;
            node._pineScope = childScope;
          }
          targetContainer.appendChild(node);
          mountedNodes.push(node);
          if (node.nodeType === Node.ELEMENT_NODE) {
            initTree(node);
          }
        });

        if (parentScope) {
          parentScope.addCleanup(() => {
            childScope.destroy();
            mountedNodes.forEach((node) => {
              if (node.parentNode) node.parentNode.removeChild(node);
            });
          });
        }
      }

      const existingTarget = document.querySelector(targetSelector);
      if (existingTarget) {
        mountTeleport(existingTarget);
      } else {
        let isMounted = false;
        let observer = null;
        const root = document.body || document.documentElement;
        if (root && typeof MutationObserver !== 'undefined') {
          observer = new MutationObserver(() => {
            if (isMounted) return;
            const target = document.querySelector(targetSelector);
            if (target) {
              isMounted = true;
              observer.disconnect();
              mountTeleport(target);
            }
          });
          observer.observe(root, { childList: true, subtree: true });
        }
        const scope = getScope(templateEl);
        if (scope && observer) {
          scope.addCleanup(() => observer.disconnect());
        }
      }
    },

    // p-error: Declarative component error boundary
    'p-error': (el, { expression }) => {
      el._pineErrorHandler = expression;
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
    },

    // p-validate: Declarative field & form constraint validation
    'p-validate': (el, { expression, modifiers }) => {
      const fieldName = el.getAttribute('name') || el.id || el.getAttribute('p-model') || el.getAttribute('model') || el.getAttribute('~') || 'field';
      const scope = getScope(el);
      if (!scope) return;

      if (!scope.data.$errors) scope.data.$errors = reactive({});
      if (!scope.data.$valid) scope.data.$valid = reactive({});
      if (!scope.data.$touched) scope.data.$touched = reactive({});
      if (!scope.data.$dirty) scope.data.$dirty = reactive({});

      scope.data.$valid[fieldName] = true;
      scope.data.$errors[fieldName] = null;
      scope.data.$touched[fieldName] = false;
      scope.data.$dirty[fieldName] = false;

      const validateField = (val) => {
        const v = val !== undefined ? val : (el.value !== undefined ? el.value : '');
        let error = null;

        if (modifiers.includes('required') && (!v || String(v).trim() === '')) {
          error = 'This field is required';
        } else if (modifiers.includes('email') && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
          error = 'Invalid email address';
        } else {
          const minMod = modifiers.find((m) => m.startsWith('min'));
          if (minMod) {
            const minVal = Number(minMod.replace('min', '') || 0);
            if (typeof v === 'number' ? v < minVal : String(v).length < minVal) {
              error = `Minimum length is ${minVal}`;
            }
          }
          const maxMod = modifiers.find((m) => m.startsWith('max'));
          if (maxMod) {
            const maxVal = Number(maxMod.replace('max', '') || 0);
            if (typeof v === 'number' ? v > maxVal : String(v).length > maxVal) {
              error = `Maximum length is ${maxVal}`;
            }
          }
        }

        if (!error && expression) {
          try {
            const custom = evaluate(el, expression);
            if (typeof custom === 'function') {
              const res = custom(v, el);
              if (res === false) error = 'Validation failed';
              else if (typeof res === 'string' && res) error = res;
            } else if (typeof custom === 'string' && custom) {
              error = custom;
            } else if (custom === false) {
              error = 'Validation failed';
            }
          } catch {}
        }

        scope.data.$errors[fieldName] = error;
        scope.data.$valid[fieldName] = !error;
        if (error) {
          el.setAttribute('aria-invalid', 'true');
        } else {
          el.removeAttribute('aria-invalid');
        }
        return !error;
      };

      const onInput = (e) => {
        scope.data.$dirty[fieldName] = true;
        validateField(e.target.value);
      };
      const onBlur = () => {
        scope.data.$touched[fieldName] = true;
        validateField(el.value);
      };

      el.addEventListener('input', onInput);
      el.addEventListener('blur', onBlur);
      scope.addCleanup(() => {
        el.removeEventListener('input', onInput);
        el.removeEventListener('blur', onBlur);
      });
    },

    // p-route: Client-side route matching & rendering
    'p-route': (el, { expression, modifiers }) => {
      const pattern = expression.trim();
      let mountedNodes = [];
      let isMounted = false;

      const isTemplate = el.tagName === 'TEMPLATE';
      const commentAnchor = isTemplate ? document.createComment(`p-route: ${pattern}`) : null;
      if (isTemplate && el.parentNode) {
        el.parentNode.insertBefore(commentAnchor, el);
      }

      const stop = effect(() => {
        const currentPath = router.path;
        const res = matchRoutePattern(pattern, currentPath);

        if (res.matches) {
          routerParamsSignal.value = res.params;
          if (isTemplate) {
            if (!isMounted) {
              const clone = el.content.cloneNode(true);
              mountedNodes = Array.from(clone.childNodes);
              if (commentAnchor && commentAnchor.parentNode) {
                commentAnchor.parentNode.insertBefore(clone, commentAnchor);
              }
              mountedNodes.forEach((n) => {
                if (n.nodeType === 1) initTree(n);
              });
              isMounted = true;
            }
          } else {
            el.style.display = '';
            el.removeAttribute('hidden');
          }
        } else {
          if (isTemplate) {
            if (isMounted) {
              mountedNodes.forEach((n) => {
                if (n.nodeType === 1) destroyTree(n);
                n.remove();
              });
              mountedNodes = [];
              isMounted = false;
            }
          } else {
            el.style.display = 'none';
            el.setAttribute('hidden', '');
          }
        }
      });

      const scope = getScope(el);
      if (scope) {
        scope.addCleanup(() => {
          stop();
          if (commentAnchor && commentAnchor.parentNode) commentAnchor.remove();
          mountedNodes.forEach((n) => n.remove());
        });
      }
    },

    // p-link: Declarative SPA navigation and active class state
    'p-link': (el, { expression, modifiers }) => {
      const activeClass = modifiers.length > 0 ? modifiers.join(' ') : 'active';
      const href = el.getAttribute('href') || expression;

      const onClick = (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        const target = el.getAttribute('target');
        if (target && target !== '_self') return;
        const toUrl = el.getAttribute('href') || href;
        if (!toUrl || toUrl.startsWith('#') || toUrl.startsWith('mailto:') || toUrl.startsWith('tel:')) return;
        if (toUrl.includes('://') && !toUrl.startsWith(window.location.origin)) return;

        e.preventDefault();
        router.navigate(toUrl, { replace: el.hasAttribute('replace') });
      };

      el.addEventListener('click', onClick);

      const stop = effect(() => {
        const currentPath = router.path;
        const targetHref = el.getAttribute('href') || href;
        if (targetHref) {
          const isCurrent = targetHref === currentPath || (targetHref !== '/' && currentPath.startsWith(targetHref));
          if (isCurrent) {
            activeClass.split(' ').forEach((c) => c && el.classList.add(c));
            el.setAttribute('aria-current', 'page');
          } else {
            activeClass.split(' ').forEach((c) => c && el.classList.remove(c));
            el.removeAttribute('aria-current');
          }
        }
      });

      const scope = getScope(el);
      if (scope) {
        scope.addCleanup(() => {
          el.removeEventListener('click', onClick);
          stop();
        });
      }
    },

    // p-suspense: Async promise/resource coordinator
    'p-suspense': (el) => {
      const fallbackTemplate = el.querySelector('template[p-fallback], template[fallback], template[p-loading], template[loading]');
      let fallbackNodes = [];
      const pendingSet = new Set();
      const isPendingSignal = signal(false);

      const controller = {
        track(promise) {
          if (!promise || typeof promise.then !== 'function') return;
          pendingSet.add(promise);
          isPendingSignal.value = true;
          promise.finally(() => {
            pendingSet.delete(promise);
            if (pendingSet.size === 0) {
              isPendingSignal.value = false;
            }
          });
        }
      };

      suspenseRegistry.set(el, controller);

      if (fallbackTemplate && fallbackTemplate.parentNode) {
        const anchor = document.createComment('p-suspense-anchor');
        fallbackTemplate.parentNode.insertBefore(anchor, fallbackTemplate);

        const stop = effect(() => {
          if (isPendingSignal.value) {
            if (fallbackNodes.length === 0) {
              const clone = fallbackTemplate.content.cloneNode(true);
              fallbackNodes = Array.from(clone.childNodes);
              anchor.parentNode.insertBefore(clone, anchor);
              fallbackNodes.forEach((n) => {
                if (n.nodeType === 1) initTree(n);
              });
            }
          } else {
            fallbackNodes.forEach((n) => {
              if (n.nodeType === 1) destroyTree(n);
              n.remove();
            });
            fallbackNodes = [];
          }
        });

        const scope = getScope(el);
        if (scope) {
          scope.addCleanup(() => {
            stop();
            if (anchor && anchor.parentNode) anchor.remove();
            fallbackNodes.forEach((n) => n.remove());
          });
        }
      }
    },

    // p-component: On-demand remote HTML component loader & morpher
    'p-component': (el, { expression }) => {
      const url = expression ? expression.replace(/^['"]|['"]$/g, '').trim() : '';
      if (!url) return;
      const loadingTemplate = el.querySelector('template[p-loading], template[loading]');
      let loadingNodes = [];
      if (loadingTemplate && loadingTemplate.parentNode) {
        const clone = loadingTemplate.content.cloneNode(true);
        loadingNodes = Array.from(clone.childNodes);
        loadingTemplate.parentNode.insertBefore(clone, loadingTemplate);
      }

      loadRemoteComponent(url)
        .then((htmlText) => {
          loadingNodes.forEach((n) => n.remove());
          loadingNodes = [];
          if (typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const content = doc.body.firstElementChild || doc.body;
            if (content) {
              destroyTree(el);
              morph(el, content);
              destroyTree(el);
              initTree(el);
              emitDevTools('component:loaded', { url, el });
            }
          }
        })
        .catch((err) => {
          loadingNodes.forEach((n) => n.remove());
          console.error(`[PineJS] Failed to load component: ${url}`, err);
        });
    },

    // p-shadow: Shadow DOM encapsulation for scoped CSS and components
    'p-shadow': (el, { expression }) => {
      const mode = expression && expression.includes('closed') ? 'closed' : 'open';
      if (!el.shadowRoot && typeof el.attachShadow === 'function') {
        const shadow = el.attachShadow({ mode });
        while (el.childNodes.length > 0) {
          shadow.appendChild(el.childNodes[0]);
        }
        initTree(shadow);
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
      if (fromEl.nodeType === Node.ELEMENT_NODE) {
        destroyTree(fromEl);
      }
      const clone = toEl.cloneNode(true);
      fromEl.replaceWith(clone);
      if (clone.nodeType === Node.ELEMENT_NODE) {
        initTree(clone);
      }
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

    // Sync form values and interactive state (preserve user interactive values unless HTML attribute changed)
    if (fromEl.tagName === 'INPUT') {
      if (fromEl.type === 'checkbox' || fromEl.type === 'radio') {
        const fromHasChk = fromEl.hasAttribute('checked');
        const toHasChk = toEl.hasAttribute('checked');
        if (fromHasChk !== toHasChk) {
          fromEl.checked = toEl.checked;
        }
      } else {
        const fromValAttr = fromEl.getAttribute('value') || '';
        const toValAttr = toEl.getAttribute('value') || '';
        if (fromValAttr !== toValAttr) {
          fromEl.value = toEl.value;
        }
      }
    } else if (fromEl.tagName === 'TEXTAREA') {
      if (fromEl.defaultValue !== toEl.defaultValue) {
        fromEl.value = toEl.value;
      }
    } else if (fromEl.tagName === 'SELECT') {
      if (fromEl.value !== toEl.value && toEl.value) {
        fromEl.value = toEl.value;
      }
    }

    // Sync children
    const fromChildren = Array.from(fromEl.childNodes);
    const toChildren = Array.from(toEl.childNodes);

    const max = Math.max(fromChildren.length, toChildren.length);
    for (let i = 0; i < max; i++) {
      if (!fromChildren[i] && toChildren[i]) {
        const newChild = toChildren[i].cloneNode(true);
        fromEl.appendChild(newChild);
        if (newChild.nodeType === Node.ELEMENT_NODE) {
          initTree(newChild);
        }
      } else if (fromChildren[i] && !toChildren[i]) {
        if (fromChildren[i].nodeType === Node.ELEMENT_NODE) {
          destroyTree(fromChildren[i]);
        }
        fromChildren[i].remove();
      } else if (fromChildren[i] && toChildren[i]) {
        morph(fromChildren[i], toChildren[i]);
      }
    }
  }

  // =========================================================================
  // 9. MULTI-PREFIX & DIRECTIVE PARSER
  // =========================================================================
  let configuredPrefixes = ['p-', 'pine-'];

  const semanticKeywords = {
    'state': 'p-data',
    'scope': 'p-data',
    'data': 'p-data',
    'text': 'p-text',
    'html': 'p-html',
    'show': 'p-show',
    'model': 'p-model',
    'modelable': 'p-modelable',
    'loop': 'p-for',
    'when': 'p-if',
    'if': 'p-if',
    'else-if': 'p-else-if',
    'elseif': 'p-else-if',
    'else': 'p-else',
    'teleport': 'p-teleport',
    'error': 'p-error',
    'effect': 'p-effect',
    'ref': 'p-ref',
    'mask': 'p-mask',
    'collapse': 'p-collapse',
    'trap': 'p-trap',
    'animate': 'p-animate',
    'hydrate': 'p-hydrate',
    'bind': 'p-bind',
    'on': 'p-on',
    'init': 'p-init',
    'transition': 'p-transition',
    'validate': 'p-validate',
    'valid': 'p-validate',
    'route': 'p-route',
    'link': 'p-link',
    'form': 'p-form',
    'suspense': 'p-suspense',
    'fallback': 'p-fallback',
    'component': 'p-component',
    'shadow': 'p-shadow'
  };

  function setPrefix(pfx) {
    if (Array.isArray(pfx)) {
      configuredPrefixes = pfx.map((p) => {
        if (!p) return '';
        return p.endsWith('-') || p.endsWith(':') ? p : `${p}-`;
      });
    } else if (typeof pfx === 'string') {
      if (!pfx) {
        configuredPrefixes = [''];
      } else {
        configuredPrefixes = [pfx.endsWith('-') || pfx.endsWith(':') ? pfx : `${pfx}-`];
      }
    }
  }

  function parseDirective(attrName) {
    // 1. Shorthands: :bind and @event
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

    // 3. Dollar prefix ($data, $text, $show, $animate, etc.)
    if (attrName.startsWith('$')) {
      const parts = attrName.slice(1).split('.');
      const mainPart = parts[0];
      const modifiers = parts.slice(1);
      let directive = `p-${mainPart}`;
      let arg = null;
      if (mainPart.includes(':')) {
        const colonIdx = mainPart.indexOf(':');
        directive = `p-${mainPart.slice(0, colonIdx)}`;
        arg = mainPart.slice(colonIdx + 1);
      }
      return { directive, arg, modifiers };
    }

    // 4. Configured prefixes (p-, x-, pine-, etc.)
    for (const pfx of configuredPrefixes) {
      if (pfx && attrName.startsWith(pfx)) {
        const rest = attrName.slice(pfx.length);
        const parts = rest.split('.');
        const mainPart = parts[0];
        const modifiers = parts.slice(1);

        let directive = `p-${mainPart}`;
        let arg = null;

        if (mainPart.includes(':')) {
          const colonIdx = mainPart.indexOf(':');
          directive = `p-${mainPart.slice(0, colonIdx)}`;
          arg = mainPart.slice(colonIdx + 1);
        }

        return { directive, arg, modifiers };
      }
    }

    // 5. Semantic prefix-free keywords (state, text, show, model, loop, etc.)
    const dotIdx = attrName.indexOf('.');
    const baseName = dotIdx > -1 ? attrName.slice(0, dotIdx) : attrName;
    const modifiers = dotIdx > -1 ? attrName.slice(dotIdx + 1).split('.') : [];

    let keyword = baseName;
    let arg = null;
    if (baseName.includes(':')) {
      const colonIdx = baseName.indexOf(':');
      keyword = baseName.slice(0, colonIdx);
      arg = baseName.slice(colonIdx + 1);
    }

    if (semanticKeywords[keyword]) {
      return {
        directive: semanticKeywords[keyword],
        arg,
        modifiers
      };
    }

    return null;
  }

  // =========================================================================
  // 10. DOM COMPILER & TREE WALKER
  // =========================================================================
  function initElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (el._pineInitialized) return;
    if (el.hasAttribute && (el.hasAttribute('p-ignore') || el.hasAttribute('pine-ignore') || el.hasAttribute('ignore'))) return;
    el._pineInitialized = true;

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
      'p-show', 'p-collapse', 'p-mask', 'p-trap', 'p-animate', 'p-transition', 'p-effect',
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
    if (!root) return;
    if (root.nodeType === 11 || (typeof Node !== 'undefined' && root.nodeType === Node.DOCUMENT_FRAGMENT_NODE)) {
      let child = root.firstElementChild;
      while (child) {
        const next = child.nextElementSibling;
        initTree(child);
        child = next;
      }
      return;
    }
    if (root.nodeType !== (typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1)) return;
    if (root._pineHandled) return;
    if (root.hasAttribute && (root.hasAttribute('p-ignore') || root.hasAttribute('pine-ignore') || root.hasAttribute('ignore'))) return;

    if (root.tagName && root.tagName.toLowerCase() === 'template') {
      const attrs = Array.from(root.attributes || []);
      for (const attr of attrs) {
        const parsed = parseDirective(attr.name);
        if (parsed) {
          if (parsed.directive === 'p-if') {
            directives['p-if'](root, { expression: attr.value, modifiers: parsed.modifiers });
            return;
          }
          if (parsed.directive === 'p-for') {
            directives['p-for'](root, { expression: attr.value, modifiers: parsed.modifiers });
            return;
          }
          if (parsed.directive === 'p-teleport') {
            directives['p-teleport'](root, { expression: attr.value, modifiers: parsed.modifiers });
            return;
          }
          if (parsed.directive === 'p-route') {
            directives['p-route'](root, { expression: attr.value, modifiers: parsed.modifiers });
            return;
          }
        }
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

  function findRoots() {
    if (typeof document === 'undefined') return [];
    const roots = new Set();
    const all = document.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.attributes) {
        for (let j = 0; j < el.attributes.length; j++) {
          const parsed = parseDirective(el.attributes[j].name);
          if (parsed && parsed.directive === 'p-data') {
            roots.add(el);
            break;
          }
        }
      }
    }
    return Array.from(roots);
  }

  // =========================================================================
  // 11. TIMELINE ANIMATION ORCHESTRATOR
  // =========================================================================
  function timeline(steps = [], globalOptions = {}) {
    const stepList = Array.isArray(steps) ? [...steps] : [];
    const animations = [];
    let totalDuration = 0;

    const instance = {
      animations,
      duration: 0,
      add(el, keyframes, options = {}, offset) {
        stepList.push({ el, keyframes, options, offset });
        return instance;
      },
      play() {
        if (animations.length === 0) this._build();
        animations.forEach((a) => a.play());
        return instance;
      },
      pause() { animations.forEach((a) => a.pause()); return instance; },
      reverse() { animations.forEach((a) => a.reverse()); return instance; },
      finish() { animations.forEach((a) => a.finish()); return instance; },
      cancel() { animations.forEach((a) => a.cancel()); return instance; },
      then(resolve, reject) {
        if (animations.length === 0) this._build();
        const maxWait = Math.max(50, totalDuration || 0) + 50;
        const promises = animations.map((a) => {
          if (!a) return Promise.resolve();
          const p = a.finished ? a.finished : Promise.resolve();
          return Promise.race([
            p,
            new Promise((r) => setTimeout(r, maxWait))
          ]);
        });
        return Promise.all(promises).then(resolve, reject);
      },
      catch(reject) {
        return this.then(undefined, reject);
      },
      finally(callback) {
        return this.then(
          (value) => Promise.resolve(callback()).then(() => value),
          (err) => Promise.resolve(callback()).then(() => { throw err; })
        );
      },
      _build() {
        animations.length = 0;
        let currentTime = 0;
        for (const step of stepList) {
          const el = typeof step.el === 'string' && typeof document !== 'undefined'
            ? document.querySelector(step.el)
            : step.el;
          if (!el || typeof el.animate !== 'function') continue;

          let delay = (step.delay !== undefined ? step.delay : 0);
          if (step.offset && typeof step.offset === 'string') {
            const num = parseFloat(step.offset.replace(/[^0-9.-]/g, '')) || 0;
            if (step.offset.startsWith('-=')) delay = Math.max(0, currentTime - num);
            else if (step.offset.startsWith('+=')) delay = currentTime + num;
            else delay = currentTime;
          } else {
            delay += (step.at !== undefined ? step.at : currentTime);
          }

          const duration = step.duration || (step.options && step.options.duration) || 350;
          const easing = step.easing || (step.options && step.options.easing) || 'cubic-bezier(0.34, 1.56, 0.64, 1)';
          const keyframes = step.keyframes || step.frames || [];

          const anim = el.animate(keyframes, {
            ...globalOptions,
            ...step.options,
            duration,
            delay,
            easing,
            fill: 'forwards'
          });

          animations.push(anim);
          currentTime = delay + duration;
        }
        totalDuration = currentTime;
        this.duration = totalDuration;
      }
    };

    if (Array.isArray(steps) && steps.length > 0) {
      instance._build();
    }

    return instance;
  }

  // =========================================================================
  // 12. TAGGED TEMPLATE LITERALS (Pine.html / Pine.tpl)
  // =========================================================================
  function html(strings, ...values) {
    if (typeof document === 'undefined') return null;
    let result = '';
    const domNodes = [];

    strings.forEach((str, i) => {
      result += str;
      if (i < values.length) {
        const val = values[i];
        if (val instanceof Node || (typeof NodeList !== 'undefined' && val instanceof NodeList) || (Array.isArray(val) && val[0] instanceof Node)) {
          const markerId = `__pine_node_${Math.random().toString(36).slice(2, 9)}__`;
          domNodes.push({ markerId, node: val });
          result += `<span id="${markerId}"></span>`;
        } else if (Array.isArray(val)) {
          result += val.join('');
        } else if (val !== null && val !== undefined) {
          result += String(val);
        }
      }
    });

    const template = document.createElement('template');
    template.innerHTML = result.trim();
    const fragment = template.content;

    domNodes.forEach(({ markerId, node }) => {
      const placeholder = fragment.querySelector(`#${markerId}`);
      if (placeholder) {
        if (Array.isArray(node)) {
          node.forEach((n) => placeholder.parentNode.insertBefore(n, placeholder));
        } else if (typeof NodeList !== 'undefined' && node instanceof NodeList) {
          Array.from(node).forEach((n) => placeholder.parentNode.insertBefore(n, placeholder));
        } else {
          placeholder.parentNode.insertBefore(node, placeholder);
        }
        placeholder.remove();
      }
    });

    const element = fragment.childNodes.length === 1 ? fragment.firstElementChild : fragment;
    return element;
  }

  // =========================================================================
  // 13. OFF-THREAD WEB WORKER SIGNAL BRIDGE (Pine.worker)
  // =========================================================================
  function createWorkerSignal(fnOrCode) {
    let workerCode = '';
    if (typeof fnOrCode === 'function') {
      workerCode = `
        self.onmessage = async (e) => {
          try {
            const computeFn = (${fnOrCode.toString()});
            const result = await computeFn(e.data);
            self.postMessage({ ok: true, result });
          } catch (err) {
            self.postMessage({ ok: false, error: err.message || String(err) });
          }
        };
      `;
    } else if (typeof fnOrCode === 'string') {
      workerCode = fnOrCode;
    }

    let worker = null;
    let workerUrl = null;

    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        workerUrl = URL.createObjectURL(blob);
        worker = new Worker(workerUrl);
      } catch {}
    }

    const dataSig = signal(null);
    const loadingSig = signal(false);
    const errorSig = signal(null);

    const instance = {
      get data() { return dataSig.value; },
      get loading() { return loadingSig.value; },
      get error() { return errorSig.value; },
      compute(payload) {
        if (!worker) {
          if (typeof fnOrCode === 'function') {
            loadingSig.value = true;
            return Promise.resolve()
              .then(() => fnOrCode(payload))
              .then((res) => {
                dataSig.value = res;
                loadingSig.value = false;
                return res;
              })
              .catch((err) => {
                errorSig.value = err.message || String(err);
                loadingSig.value = false;
                throw err;
              });
          }
          return Promise.reject(new Error('Web Workers not supported in this environment'));
        }

        loadingSig.value = true;
        errorSig.value = null;

        return new Promise((resolve, reject) => {
          const handler = (e) => {
            worker.removeEventListener('message', handler);
            loadingSig.value = false;
            if (e.data.ok) {
              dataSig.value = e.data.result;
              resolve(e.data.result);
            } else {
              errorSig.value = e.data.error;
              reject(new Error(e.data.error));
            }
          };
          worker.addEventListener('message', handler);
          worker.postMessage(payload);
        });
      },
      terminate() {
        if (worker) {
          worker.terminate();
          worker = null;
          if (workerUrl) URL.revokeObjectURL(workerUrl);
        }
      }
    };

    return instance;
  }

  // =========================================================================
  // 13.5. ZERO-DOM SERVER-SIDE HTML STRING COMPILER (Pine.renderToString)
  // =========================================================================
  function renderToString(templateHtml, initialData = {}, options = {}) {
    if (typeof templateHtml !== 'string') return '';
    let htmlStr = templateHtml;

    const context = { ...initialData, ...(options.data || {}) };

    // 1. Process p-data="{ ... }"
    const dataMatch = htmlStr.match(/p-data=(["'])(.*?)\1/);
    if (dataMatch && dataMatch[2]) {
      try {
        const parsed = (new Function(`return (${dataMatch[2]})`))();
        if (isObject(parsed)) Object.assign(context, parsed);
      } catch {}
    }

    // 2. Process conditional branches: <template p-if="cond">...</template>
    htmlStr = htmlStr.replace(/<template[^>]*\bp-if=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/template>/gi, (_, q, expr, inner) => {
      try {
        const fn = new Function(...Object.keys(context), `return Boolean(${expr})`);
        const isTrue = fn(...Object.values(context));
        return isTrue ? inner : '';
      } catch {
        return '';
      }
    });

    // 3. Process loops: <template p-for="(item, i) in list">...</template>
    htmlStr = htmlStr.replace(/<template[^>]*\bp-for=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/template>/gi, (_, q, expr, inner) => {
      try {
        const forMatch = expr.match(/^\s*(?:\(?\s*([a-zA-Z0-9_$]+)(?:\s*,\s*([a-zA-Z0-9_$]+))?\s*\)?)\s+(?:in|of)\s+(.+)$/);
        if (forMatch) {
          const itemVar = forMatch[1];
          const idxVar = forMatch[2] || 'index';
          const listExpr = forMatch[3];
          const fn = new Function(...Object.keys(context), `return (${listExpr})`);
          const list = fn(...Object.values(context));
          if (Array.isArray(list)) {
            return list.map((item, idx) => {
              const itemContext = { ...context, [itemVar]: item, [idxVar]: idx };
              let renderedItem = inner;
              renderedItem = renderedItem.replace(/<([a-zA-Z0-9-]+)([^>]*)p-text=(["'])(.*?)\3([^>]*)>(.*?)<\/\1>/gi, (m, tag, pre, q2, textExpr, post) => {
                try {
                  const tFn = new Function(...Object.keys(itemContext), `return (${textExpr})`);
                  return `<${tag}${pre}p-text=${q2}${textExpr}${q2}${post}>${tFn(...Object.values(itemContext))}</${tag}>`;
                } catch { return m; }
              });
              return renderedItem;
            }).join('');
          }
        }
      } catch {}
      return '';
    });

    // 4. Process p-text="expr"
    htmlStr = htmlStr.replace(/<([a-zA-Z0-9-]+)([^>]*)p-text=(["'])(.*?)\3([^>]*)>(.*?)<\/\1>/gi, (match, tag, preAttrs, q, expr, postAttrs) => {
      try {
        const fn = new Function(...Object.keys(context), `return (${expr})`);
        const val = fn(...Object.values(context));
        const escaped = String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<${tag}${preAttrs}p-text=${q}${expr}${q}${postAttrs}>${escaped}</${tag}>`;
      } catch {
        return match;
      }
    });

    // 5. Process p-html="expr"
    htmlStr = htmlStr.replace(/<([a-zA-Z0-9-]+)([^>]*)p-html=(["'])(.*?)\3([^>]*)>(.*?)<\/\1>/gi, (match, tag, preAttrs, q, expr, postAttrs) => {
      try {
        const fn = new Function(...Object.keys(context), `return (${expr})`);
        const val = fn(...Object.values(context));
        return `<${tag}${preAttrs}p-html=${q}${expr}${q}${postAttrs}>${val ?? ''}</${tag}>`;
      } catch {
        return match;
      }
    });

    // 6. Process dynamic attributes :attr="expr" or p-bind:attr="expr"
    htmlStr = htmlStr.replace(/<([a-zA-Z0-9-]+)([^>]*?)>/gi, (match, tag, attrs) => {
      if (tag.toLowerCase() === 'template') return match;
      let newAttrs = attrs;
      newAttrs = newAttrs.replace(/(?::|p-bind:)([a-zA-Z0-9_-]+)=(["'])(.*?)\2/gi, (m, attrName, q, expr) => {
        try {
          const fn = new Function(...Object.keys(context), `return (${expr})`);
          const val = fn(...Object.values(context));
          if (attrName === 'class' && isObject(val)) {
            const classes = Object.entries(val).filter(([_, active]) => Boolean(active)).map(([c]) => c).join(' ');
            return `class="${classes}" ${m}`;
          }
          if (val === true) return `${attrName} ${m}`;
          if (val === false || val === null || val === undefined) return m;
          return `${attrName}="${String(val).replace(/"/g, '&quot;')}" ${m}`;
        } catch {
          return m;
        }
      });
      return `<${tag}${newAttrs}>`;
    });

    // 7. Inject p-hydrate attribute into the root element
    if (!htmlStr.includes('p-hydrate')) {
      htmlStr = htmlStr.replace(/<([a-zA-Z0-9-]+)(\s|>)/, '<$1 p-hydrate$2');
    }

    return htmlStr;
  }

  // =========================================================================
  // 13.6. ERROR BOUNDARY ENGINE
  // =========================================================================
  function errorBoundary(fn, options = {}) {
    const onError = options.onError || ((err) => console.error('[PineJS ErrorBoundary]', err));
    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        return res.catch((err) => {
          onError(err);
        });
      }
      return res;
    } catch (err) {
      onError(err);
    }
  }

  // =========================================================================
  // 13.7. ASYNC RESOURCE ENGINE 2.0 (Pine.resource)
  // =========================================================================
  const resourceCache = new Map();

  function resource(source, options = {}) {
    const initialValue = options.initialValue !== undefined ? options.initialValue : null;
    const ttl = options.ttl || 30000;
    const useCache = Boolean(options.cache);

    const _data = signal(initialValue);
    const _loading = signal(false);
    const _error = signal(null);
    const _status = signal('idle'); // idle | loading | refreshing | success | error

    let abortController = null;
    let currentRequestId = 0;
    let activeEffectStop = null;
    let isDisposed = false;

    const execute = async (isRefresh = false) => {
      if (isDisposed) return;
      const reqId = ++currentRequestId;

      if (abortController) {
        abortController.abort();
      }
      abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const abortSignal = abortController ? abortController.signal : null;

      if (isRefresh && _status.value === 'success') {
        _status.value = 'refreshing';
      } else {
        _status.value = 'loading';
      }
      _loading.value = true;
      _error.value = null;

      try {
        let resolvedSource = typeof source === 'function' ? source(abortSignal) : source;

        let result;
        if (typeof resolvedSource === 'string') {
          const cacheKey = resolvedSource;
          if (useCache && !isRefresh && resourceCache.has(cacheKey)) {
            const entry = resourceCache.get(cacheKey);
            if (Date.now() - entry.time < ttl) {
              _data.value = entry.data;
              _status.value = 'success';
              _loading.value = false;
              return entry.data;
            }
          }
          const resp = await fetch(resolvedSource, { signal: abortSignal });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          const contentType = resp.headers ? resp.headers.get('content-type') || '' : '';
          result = contentType.includes('application/json') ? await resp.json() : await resp.text();
          if (useCache) {
            resourceCache.set(cacheKey, { data: result, time: Date.now() });
          }
        } else if (resolvedSource && typeof resolvedSource.then === 'function') {
          result = await resolvedSource;
        } else {
          result = resolvedSource;
        }

        if (reqId === currentRequestId && !isDisposed) {
          _data.value = result;
          _status.value = 'success';
          _loading.value = false;
          _error.value = null;
        }
        return result;
      } catch (err) {
        if (abortSignal && abortSignal.aborted) {
          return;
        }
        if (reqId === currentRequestId && !isDisposed) {
          _error.value = err;
          _status.value = 'error';
          _loading.value = false;
        }
        if (options.onError) {
          options.onError(err);
        }
      }
    };

    if (typeof source === 'function') {
      activeEffectStop = effect(() => {
        execute(false);
      });
    } else {
      execute(false);
    }

    return {
      get data() { return _data.value; },
      set data(v) { _data.value = v; },
      get loading() { return _loading.value; },
      get error() { return _error.value; },
      get status() { return _status.value; },
      refresh() { return execute(true); },
      cancel() {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
        _loading.value = false;
        if (_status.value === 'loading' || _status.value === 'refreshing') {
          _status.value = 'idle';
        }
      },
      reset() {
        this.cancel();
        _data.value = initialValue;
        _error.value = null;
        _status.value = 'idle';
      },
      dispose() {
        isDisposed = true;
        this.cancel();
        if (activeEffectStop) {
          activeEffectStop();
          activeEffectStop = null;
        }
      }
    };
  }

  // =========================================================================
  // 13.8. COMPONENT FOUNDATION & LIFECYCLES
  // =========================================================================
  let currentComponentInstance = null;

  function onBeforeMount(fn) {
    if (currentComponentInstance) currentComponentInstance.beforeMountHooks.push(fn);
  }
  function onMount(fn) {
    if (currentComponentInstance) currentComponentInstance.mountHooks.push(fn);
  }
  function onBeforeUpdate(fn) {
    if (currentComponentInstance) currentComponentInstance.beforeUpdateHooks.push(fn);
  }
  function onUpdated(fn) {
    if (currentComponentInstance) currentComponentInstance.updatedHooks.push(fn);
  }
  function onUnmount(fn) {
    if (currentComponentInstance) currentComponentInstance.unmountHooks.push(fn);
  }

  function createComponent(definition) {
    return function componentFactory(initialProps = {}, slots = {}) {
      const propsDef = definition.props || {};
      const validatedProps = {};

      for (const [propName, config] of Object.entries(propsDef)) {
        const type = typeof config === 'function' ? config : (config && config.type ? config.type : null);
        const defaultVal = config && typeof config === 'object' && config.default !== undefined ? config.default : undefined;
        const required = config && typeof config === 'object' ? Boolean(config.required) : false;

        let val = initialProps[propName];
        if (val === undefined) {
          val = typeof defaultVal === 'function' ? defaultVal() : defaultVal;
        }

        if (required && val === undefined) {
          console.warn(`[PineJS Component] Missing required prop: "${propName}"`);
        }

        if (val !== undefined && type) {
          const actualType = typeof val;
          let valid = false;
          if (type === String && actualType === 'string') valid = true;
          else if (type === Number && actualType === 'number') valid = true;
          else if (type === Boolean && actualType === 'boolean') valid = true;
          else if (type === Array && Array.isArray(val)) valid = true;
          else if (type === Object && actualType === 'object' && val !== null) valid = true;
          else if (type === Function && actualType === 'function') valid = true;
          else if (val instanceof type) valid = true;

          if (!valid) {
            console.warn(`[PineJS Component] Invalid prop "${propName}": expected ${type.name || type}, got ${actualType}`);
          }
        }

        validatedProps[propName] = val;
      }

      for (const [k, v] of Object.entries(initialProps)) {
        if (!(k in validatedProps)) {
          validatedProps[k] = v;
        }
      }

      const reactiveProps = reactive(validatedProps);

      const instance = {
        props: reactiveProps,
        slots,
        beforeMountHooks: [],
        mountHooks: [],
        beforeUpdateHooks: [],
        updatedHooks: [],
        unmountHooks: [],
        scope: null,
        el: null,
        emit(event, detail) {
          if (instance.el) {
            instance.el.dispatchEvent(new CustomEvent(event, { detail, bubbles: true }));
          }
        }
      };

      const prevInstance = currentComponentInstance;
      currentComponentInstance = instance;

      let templateResult;
      try {
        if (typeof definition.setup === 'function') {
          const setupResult = definition.setup(reactiveProps, { slots, emit: instance.emit.bind(instance) });
          if (setupResult && typeof setupResult === 'function') {
            templateResult = setupResult(reactiveProps);
          } else if (isObject(setupResult)) {
            Object.assign(reactiveProps, setupResult);
          }
        }
        if (!templateResult && typeof definition.template === 'function') {
          templateResult = definition.template(reactiveProps, { slots, emit: instance.emit.bind(instance) });
        } else if (!templateResult && typeof definition.template === 'string') {
          templateResult = definition.template;
        }
      } finally {
        currentComponentInstance = prevInstance;
      }

      return {
        instance,
        template: templateResult,
        render(container) {
          instance.beforeMountHooks.forEach((h) => {
            try { h(); } catch (e) { console.error('[PineJS Component] beforeMount hook error:', e); }
          });

          if (typeof templateResult === 'string') {
            container.innerHTML = templateResult;
          } else if (templateResult instanceof Node) {
            container.appendChild(templateResult);
          }
          instance.el = container;

          // Inject reactive props as a scope on the container so child p-data elements inherit them
          const propsData = {};
          const rawProps = raw(reactiveProps);
          for (const k of Object.keys(rawProps)) {
            propsData[k] = rawProps[k];
          }
          const parentScope = getScope(container.parentElement);
          const compScope = new Scope(propsData, parentScope, container);
          container[SCOPE_SYMBOL] = compScope;
          container.__pine_scope__ = compScope;

          initTree(container);

          instance.mountHooks.forEach((h) => {
            try { h(); } catch (e) { console.error('[PineJS Component] onMount hook error:', e); }
          });
          return container;
        },
        destroy() {
          instance.unmountHooks.forEach((h) => {
            try { h(); } catch (e) { console.error('[PineJS Component] onUnmount hook error:', e); }
          });
          if (instance.el) {
            destroyTree(instance.el);
          }
        }
      };
    };
  }

  // =========================================================================
  // 13.9. WEB COMPONENTS CUSTOM ELEMENTS INTEROPERABILITY (Pine.define)
  // =========================================================================
  function defineCustomElement(tagName, componentDef) {
    if (typeof customElements === 'undefined') return;
    if (customElements.get(tagName)) return;

    const observedProps = Object.keys(componentDef.props || {});

    class PineCustomElement extends HTMLElement {
      static get observedAttributes() {
        return observedProps.map((p) => p.toLowerCase());
      }

      constructor() {
        super();
        this._props = {};
        this._compInstance = null;
      }

      connectedCallback() {
        const props = { ...this._props };
        for (const attr of this.attributes) {
          const camelCase = attr.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          props[camelCase] = attr.value;
        }

        const slots = {
          default: this.innerHTML
        };

        const compFactory = typeof componentDef === 'function' ? componentDef : createComponent(componentDef);
        const rendered = compFactory(props, slots);
        this._compInstance = rendered;

        if (componentDef.shadow) {
          const shadow = this.attachShadow({ mode: 'open' });
          rendered.render(shadow);
        } else {
          rendered.render(this);
        }
      }

      disconnectedCallback() {
        if (this._compInstance) {
          this._compInstance.destroy();
          destroyTree(this);
          this._compInstance = null;
        }
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
          const camelCase = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          this._props[camelCase] = newValue;
          if (this._compInstance && this._compInstance.instance && this._compInstance.instance.props) {
            this._compInstance.instance.props[camelCase] = newValue;
          }
        }
      }
    }

    customElements.define(tagName, PineCustomElement);
  }

  // =========================================================================
  // 13.10. TESTING HARNESS (Pine.mount)
  // =========================================================================
  function mount(templateHtml, initialData = {}) {
    const container = document.createElement('div');
    container.innerHTML = templateHtml.trim();
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(container);
    }

    const rootEl = container.firstElementChild || container;
    if (initialData && Object.keys(initialData).length > 0) {
      rootEl[SCOPE_SYMBOL] = new Scope(initialData, null, rootEl);
    }

    initTree(rootEl);

    const wrapper = {
      el: rootEl,
      container,
      find(selector) {
        return rootEl.matches && rootEl.matches(selector) ? rootEl : rootEl.querySelector(selector);
      },
      findAll(selector) {
        return Array.from(rootEl.querySelectorAll(selector));
      },
      text(selector) {
        const el = selector ? this.find(selector) : rootEl;
        return el ? el.textContent.trim() : '';
      },
      html(selector) {
        const el = selector ? this.find(selector) : rootEl;
        return el ? el.innerHTML.trim() : '';
      },
      attribute(selector, name) {
        const el = selector ? this.find(selector) : rootEl;
        return el ? el.getAttribute(name) : null;
      },
      async click(selector) {
        const el = typeof selector === 'string' ? this.find(selector) : selector;
        if (!el) throw new Error(`Element not found for click: ${selector}`);
        el.click();
        await this.flush();
      },
      async input(selector, value) {
        const el = typeof selector === 'string' ? this.find(selector) : selector;
        if (!el) throw new Error(`Element not found for input: ${selector}`);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await this.flush();
      },
      async type(selector, text) {
        const el = typeof selector === 'string' ? this.find(selector) : selector;
        if (!el) throw new Error(`Element not found for type: ${selector}`);
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await this.flush();
      },
      dispatch(selector, eventName, detail) {
        const el = typeof selector === 'string' ? this.find(selector) : selector;
        if (el) {
          el.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
        }
      },
      async flush() {
        scheduler.flush();
        await new Promise((r) => setTimeout(r, 0));
      },
      async waitFor(predicate, timeout = 1000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          await this.flush();
          if (predicate()) return true;
          await new Promise((r) => setTimeout(r, 10));
        }
        throw new Error('[PineJS Mount] waitFor timed out');
      },
      unmount() {
        destroyTree(rootEl);
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
    };

    return wrapper;
  }

  // =========================================================================
  // 14. PUBLIC PINE API
  // =========================================================================
  const Pine = {
    version: '1.7.0',
    versionName: 'Douglas',

    // Router Engine
    router,

    // Form Engine
    form: createForm,

    // IDB Engine
    idb: createIdbResource,

    // Dynamic Remote Component Loader
    loadComponent: loadRemoteComponent,
    componentCache,

    // Server-Side Rendering
    renderToString,

    // Prefix Configuration
    prefix(newPrefix) {
      if (newPrefix !== undefined) {
        setPrefix(newPrefix);
      }
      return configuredPrefixes;
    },

    // Reactive Scope Engine
    scope: createScope,

    // Scheduler & Async Batching
    scheduler,
    batchAsync,

    // Transaction Engine
    transaction,

    // Error Boundaries
    errorBoundary,

    // Async Resource 2.0
    resource,

    // Component Foundation & Lifecycles
    component: createComponent,
    onBeforeMount,
    onMount,
    onBeforeUpdate,
    onUpdated,
    onUnmount,

    // Web Components Custom Elements
    define: defineCustomElement,

    // Testing Harness
    mount,

    // Expression Cache
    cache: cacheApi,

    // Signals Engine
    signal,
    computed,
    effect,
    batch,
    untrack,
    reactive,
    raw,
    fetch: createFetchResource,
    sse: createSSEResource,
    websocket: createWebSocketResource,
    ws: createWebSocketResource,
    timeline,
    html,
    tpl: html,
    worker: createWorkerSignal,

    // DevTools & Diagnostic Runtime Bridge
    devtools: {
      timeline: {
        marks: [],
        mark(type, details = {}) {
          const entry = {
            timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
            time: new Date().toISOString().substring(11, 23),
            type,
            ...details
          };
          this.marks.push(entry);
          if (this.marks.length > 1000) this.marks.shift();
          return entry;
        },
        getEvents() {
          return [...this.marks];
        },
        clear() {
          this.marks = [];
        }
      },
      memory: {
        inspect() {
          const roots = findRoots();
          return {
            activeRoots: roots.length,
            cacheEntries: fnCache.size,
            timestamp: Date.now()
          };
        }
      },
      getRoots() {
        return findRoots();
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
          hasScope: Boolean(scope),
          scope: scope ? scope.data : null,
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
      ensureCloakStyle();
      const roots = findRoots();
      if (roots.length > 0) {
        roots.forEach((root) => initTree(root));
      } else if (typeof document !== 'undefined' && document.body) {
        initTree(document.body);
      }

      if (typeof document !== 'undefined') {
        document.querySelectorAll('[p-cloak], [pine-cloak], [cloak]').forEach((el) => {
          el.removeAttribute('p-cloak');
          el.removeAttribute('pine-cloak');
          el.removeAttribute('cloak');
        });
      }

      startObserver();
    },

    destroyTree(element) {
      destroyTree(element);
    },

    startObserver() {
      startObserver();
    },

    stopObserver() {
      stopObserver();
    },

    initTree(element) {
      initTree(element);
    },

    // CSP Mode Configuration
    csp(enable = true) {
      cspMode = Boolean(enable);
      return cspMode;
    },

    // Global Error Boundary Hook
    onError(callback) {
      if (typeof callback === 'function') {
        globalErrorHandlers.add(callback);
        return () => globalErrorHandlers.delete(callback);
      }
      return () => {};
    },

    $data(element) {
      const scope = getScope(element);
      return scope ? scope.data : null;
    }
  };

  return Pine;
});

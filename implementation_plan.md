# 🌲 PineJS Engine Hardening Specification: Implementation Plan

This plan implements the complete specification for **Runtime Depth, Production Hardening, Performance & Developer Experience**.

---

## 🎯 Architecture & Modules To Implement

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          PineJS Engine Hardening Architecture                          │
├──────────────────────────┬───────────────────────┬─────────────────────────────────────┤
│ Module                   │ Interface             │ Core Capability                     │
├──────────────────────────┼───────────────────────┼─────────────────────────────────────┤
│ 1. Explicit Scopes       │ Pine.scope()          │ Scoped effects, listeners, cleanup  │
│ 2. Centralized Scheduler │ Pine.scheduler        │ sync, microtask, raf, idle modes    │
│ 3. Batch Async           │ Pine.batchAsync()     │ Async transaction batching          │
│ 4. State Transactions    │ Pine.transaction()    │ Rollback mutations on error         │
│ 5. Error Boundaries      │ Pine.errorBoundary()  │ Isolated runtime error isolation    │
│ 6. Async Resource Engine │ Pine.resource()       │ State machine, abort, cache (ttl)   │
│ 7. Component Foundation  │ Pine.component()      │ Props validation, slots, lifecycles │
│ 8. Lifecycle Hooks       │ Pine.onMount, etc.    │ onMount, onUnmount, onUpdate        │
│ 9. Expression Cache      │ LRU Compiled Cache    │ 10x faster expression re-evaluation │
│ 10. DevTools Profiler    │ Pine.devtools.timeline│ Profiler timeline & memory metrics  │
│ 11. Testing Harness      │ Pine.mount()          │ Test runner harness (click, text)   │
│ 12. Web Components       │ Pine.define()         │ Native Custom Elements interop      │
│ 13. Circular Detection   │ Graph cycle detector  │ Warns & prevents frozen loops       │
└──────────────────────────┴───────────────────────┴─────────────────────────────────────┘
```

---

## Proposed Changes

### 1. Core Runtime: `dist/pine.js`

#### A. Explicit Reactive Scope System (`Pine.scope`)
- `Pine.scope()` returns an isolated scope instance:
  - `scope.effect(fn)`
  - `scope.listen(el, event, handler, options)`
  - `scope.cleanup(fn)`
  - `scope.run(fn)`
  - `scope.dispose()`: immediately tears down all registered effects, DOM listeners, timers, and child scopes.

#### B. Centralized Scheduler & Async Batching (`Pine.scheduler`, `Pine.batchAsync`)
- Centralized queue managing execution ticks:
  - Modes: `'sync'`, `'microtask'`, `'raf'`, `'idle'`.
  - `Pine.effect(fn, { scheduler: 'microtask' | 'raf' | 'idle' | 'sync' })`.
  - `Pine.batchAsync(async () => { ... })`: batches all mutations across asynchronous awaits, flushing subscribers once at completion.

#### C. Transactional State Updates (`Pine.transaction`)
- `Pine.transaction(fn, { rollbackOnError: true })`:
  - Deep-snapshots active reactive states before execution.
  - If `fn` throws, automatically rolls back reactive values to previous snapshot and restores integrity.

#### D. Error Boundary System (`Pine.errorBoundary`)
- `Pine.errorBoundary(fn, { onError(err) })`:
  - Catches synchronous or promise errors without crashing sibling component scopes or freezing UI.

#### E. Async Reactivity Primitive (`Pine.resource`)
- `Pine.resource(urlOrFetcher, options = {})`:
  - Reactive properties:
    - `.data`: current resolved payload
    - `.loading`: boolean signal
    - `.error`: error message or null
    - `.status`: `'idle' | 'loading' | 'success' | 'error' | 'refreshing'`
  - Methods:
    - `.refresh()`: refreshes data in background while preserving existing `.data`
    - `.cancel()`: aborts in-flight request via `AbortController`
    - `.reset()`: resets to initial state
  - Automatically aborts previous request when reactive dependencies change.
  - Optional TTL caching: `cache: true`, `ttl: 30000`.

#### F. First-Class Component Foundation & Lifecycles (`Pine.component`)
- `Pine.component({ props, setup, template })`:
  - Validates props (types, defaults, required).
  - Lifecycle hooks: `Pine.onMount`, `Pine.onBeforeMount`, `Pine.onUnmount`, `Pine.onUpdated`.
  - Integrates seamlessly with `Pine.html` tagged template literals.

#### G. Expression Compilation Cache
- LRU compilation cache for evaluated expressions to eliminate repeated `new Function` generation and speed up large lists (`p-for`) and repeated DOM updates.

#### H. Web Components Custom Elements Interoperability (`Pine.define`)
- `Pine.define('tag-name', componentDef)`:
  - Registers native `customElements.define(tagName, class extends HTMLElement)`.
  - Observes attributes, passes them as reactive props to component.

#### I. Testing Harness (`Pine.mount`)
- `Pine.mount(templateHtml, initialData)`:
  - Returns test wrapper:
    - `.find(selector)`
    - `.text(selector)`
    - `.click(selector)`
    - `.input(selector, value)`
    - `.unmount()`

#### J. DevTools Timeline Profiler & Memory Stats
- `Pine.devtools.timeline`: records timeline marks for signals, computed, effects, DOM updates.
- `Pine.devtools.memory`: reports active scopes count, active effects, cleanups.

---

### 2. TypeScript Typings: `dist/pine.d.ts`
- Declare all new interfaces:
  - `ScopeInstance`
  - `ResourceInstance<T>`
  - `ComponentOptions<Props>`
  - `SchedulerMode`
  - `mount(html: string)`
  - `define(tagName: string, options: any)`

---

### 3. Automated Test Suites: `tests/test-suite.html`
- Add dedicated test suites for:
  1. `Pine.scope()` disposal of effects, event listeners, and timers.
  2. `Pine.scheduler` execution modes (`microtask`, `raf`).
  3. `Pine.batchAsync()` multi-await batching.
  4. `Pine.transaction()` with automatic rollback on error.
  5. `Pine.errorBoundary()` isolation.
  6. `Pine.resource()` state machine, cancellation, and refresh.
  7. `Pine.component()` with props and `Pine.onMount` / `Pine.onUnmount`.
  8. `Pine.define()` Web Components Custom Elements.
  9. `Pine.mount()` testing harness.
  10. Expression compilation cache.

---

## 🔍 Verification Plan

### Automated Headless Tests
Run:
```bash
npm.cmd test
```
Verify 100% passing across all test suites (target: 65+ suites).

### Production Multi-Target Bundles
Run:
```bash
node build.js
```
Verify `dist/pine.prod.js`, `dist/pine.dev.js`, `dist/pine.esm.prod.js` compile cleanly with zero errors.

---

## 💬 User Review Required

> [!IMPORTANT]
> All upgrades are additive and 100% backward-compatible. Existing directives (`p-*`, `pine-*`), signals, stores, and magics remain fully functional.

Please review the plan and approve to proceed with implementation!

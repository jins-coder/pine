# 🌲 PineJS Changelog & Version History

All notable changes, architectural improvements, new directives, magics, and bug fixes for each release of PineJS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## 📦 Releases

- [v1.3.0 — "Cedar" (2026-09-15)](#v130--cedar-2026-09-15) — **Latest Stable**
- [v1.2.0 — "Redwood" (2026-09-14)](#v120--redwood-2026-09-14)
- [v1.1.0 — "Sequoia" (2026-09-14)](#v110--sequoia-2026-09-14)
- [v1.0.0 — "Evergreen" (2026-09-10)](#v100--evergreen-2026-09-10) — Initial Release
- [Roadmap & Upcoming Versions](#-future-roadmap)

---

## [v1.3.0] — "Cedar" (2026-09-15)

> **Codename**: Cedar  
> **Status**: Latest Stable  
> **Bundle Size**: ~36.1 KB minified (~9.68 KB gzipped)  
> **CDN Link**: `https://unpkg.com/pinejs-core@1.3.0/dist/pine.min.js`

### 🚀 Major Enhancements

#### 1. `p-animate` Spring Physics & Keyframe Animations
- **High-Performance Animations**: Declarative CSS / Web Animations API (WAAPI) keyframe animations with built-in physics presets: `.spring`, `.bounce`, `.shake`, `.pulse`, `.loop`.
- **Reactive Triggering**: Re-triggers physics animations whenever bound signal expressions change.

#### 2. PineJS DevTools & Diagnostics Runtime Bridge (`Pine.devtools`)
- **Inspection Tools**: Inspect component roots, reactive scope trees, active signals graph, and cleanup counts programmatically or via DevTools (`Pine.devtools.inspect(el)`).

#### 3. Computed Receiver Proxy Binding for Nested Getters
- **Deep Computed Subscriptions**: Computed getters (like `.total` in shopping cart models) now bind `this` to the reactive proxy receiver, establishing automatic fine-grained subscriptions to nested arrays and sub-properties.

---

## [v1.2.0] — "Redwood" (2026-09-14)

> **Codename**: Redwood  
> **Status**: Previous Stable  
> **Bundle Size**: 35.87 KB minified (9.60 KB gzipped)  
> **CDN Link**: `https://unpkg.com/pinejs-core@1.2.0/dist/pine.min.js`

### 🚀 Major Enhancements

#### 1. Official TypeScript Typings (`dist/pine.d.ts`)
- **Full Ambient Declarations**: First-class TypeScript definitions for all signals primitives (`Signal`, `Computed`, `EffectFn`, `batch`, `untrack`, `reactive`, `raw`), `PineAPI`, directives, and `$magics`.
- **Package Manifest Integration**: Bound directly to `"types": "dist/pine.d.ts"` in `package.json` for seamless autocomplete and type-checking in VS Code and IDEs.

#### 2. Built-in Server-Side Rendering (SSR) Hydration (`p-hydrate`)
- **Flicker-Free SSR Hydration**: Added the `p-hydrate` directive which seamlessly activates server-rendered DOM elements without DOM tearing or flash of uninitialized state, automatically stripping the hydration marker once client-side tree activation finishes.

#### 3. `$history` Magic Property (URL Query & History Sync)
- **Bidirectional Query Parameter Sync**: Bind reactive state directly to browser URL search parameters with `window.history.replaceState`.
- **`popstate` Listener**: Automatically synchronizes signal state on browser Back/Forward navigation with automatic cleanup on scope destruction.

---

## [v1.1.0] — "Sequoia" (2026-09-14)

> **Codename**: Sequoia  
> **Status**: Previous Stable  
> **Bundle Size**: 34.66 KB minified (9.30 KB gzipped)  
> **CDN Link**: `https://unpkg.com/pinejs-core@1.1.0/dist/pine.min.js`

### 🚀 Major Enhancements

#### 1. Hierarchical Scope Proxy Inheritance
- **Nested Component State Access**: Child components and nested `<template p-for>` / `<template p-if>` sub-trees now inherit state from ancestor components transparently via a hierarchical `Scope` Proxy.
- **Upward Mutation**: Programmatic and declarative assignments to ancestor state variables automatically resolve and notify parent subscribers without requiring explicit `$root` or `$data` navigation.

#### 2. Reentrancy Mutex for `p-modelable` & `p-model`
- **Bidirectional State Sync**: Resolved reentrant loop feedback between parent `p-model` and child `p-modelable` components with an `isSyncing` reentrancy mutex.
- **Unidirectional Dispatch**: Prevents cascading circular updates while ensuring instant synchronization when either parent or child state changes.

#### 3. Reactive Array Mutation Interceptors
- **Auto-Syncing Mutators**: `.push()`, `.pop()`, `.shift()`, `.unshift()`, `.splice()`, `.sort()`, and `.reverse()` now automatically synchronize internal `lengthSig.value = obj.length` signals.
- **Accurate Getter Resolution**: Direct element lookups in `p-for` and computed getters always return underlying target array indices and length atoms.

#### 4. Debounced Floating Element Dismissal (`@click.outside`)
- **Appearance Timestamp Protection**: Elements toggling from hidden to visible (`p-show`, dropdowns, modal dialogs) record an appearance timestamp (`el._pineJustShown`).
- **Bubbling Event Suppression**: Prevents the opening trigger click from bubbling up to `document` and immediately dismissing the newly opened menu in the exact same event cycle.

#### 5. Developer Ergonomics & Diagnostics
- **`Pine.$data(element)`**: Public helper method to inspect or programmatically mutate any DOM element's reactive scope.
- **`element.__pine_scope__` & `element._pineScope`**: Directly attached to component root nodes for easy browser console inspection and testing.

#### 6. Automated Build & Minification Pipeline
- **`npm run build`**: Automated build script (`build.js`) that strips comments, compresses whitespace, preserves strings/regexes, and calculates gzipped metrics.
- **Test Suite Verification**: 16/16 automated test suites passing with 100% assertions.

---

## [v1.0.0] — "Evergreen" (2026-09-10)

> **Codename**: Evergreen  
> **Status**: Stable Initial Release  
> **Bundle Size**: 33.98 KB minified (9.17 KB gzipped)  
> **CDN Link**: `https://unpkg.com/pinejs-core@1.0.0/dist/pine.min.js`

### 🌲 Core Architecture

#### 1. Fine-Grained Signals Engine
- **`Signal(initialValue)`**: Primitive reactive atoms with getter-based subscription tracking and setter notifications.
- **`Computed(getter)`**: Memoized derived signals with dirty-checking and automatic dependency graph recalculation.
- **`Effect(fn)`**: Reactive side-effect executor with automatic cleanup callbacks (`onCleanup`).
- **`batch(fn)`**: Synchronous transaction batching that groups multiple signal mutations into a single DOM update pass.
- **`untrack(fn)`**: Executes code blocks without registering active signal subscriptions.
- **`reactive(object)`**: Deep reactive Proxy bridge connecting JavaScript objects and arrays to atomic signal atoms.

#### 2. Declarative Directives (Full Alpine.js Parity)
- **`p-data`**: Declares a new component root element and initializes its fine-grained reactive state object.
- **`p-init`**: Executes initialization logic when a component mounts.
- **`p-bind` / `:attr`**: Binds attributes, CSS classes (`:class`), and inline styles (`:style`) reactively.
- **`p-on` / `@event`**: Event listener directive supporting modifiers:
  - `.prevent`, `.stop`, `.self`, `.capture`, `.once`, `.passive`, `.window`, `.document`, `.outside`, `.debounce.300ms`, `.throttle.100ms`, `.enter`, `.escape`, `.tab`, `.space`, `.delete`, `.slash`, `.arrow-up`, `.arrow-down`, `.arrow-left`, `.arrow-right`.
- **`p-text`**: Fine-grained atomic text node binding.
- **`p-html`**: Reactive inner HTML string binding.
- **`p-model`**: Two-way data binding for text inputs, numbers, textareas, select dropdowns, checkboxes, and radio buttons with `.number`, `.trim`, `.lazy`, `.boolean`.
- **`p-modelable`**: Exposes internal component state properties for parent `p-model` binding.
- **`p-show`**: Toggles visibility with transition presets or `display: none`.
- **`p-if`**: Conditional DOM mounting/unmounting on `<template>` tags.
- **`p-for`**: Keyed list rendering over arrays, objects, and numbers on `<template>` tags.
- **`p-transition`**: CSS transitions with built-in presets (`fade`, `slide`, `scale`).
- **`p-collapse`**: Smooth height expansion and collapse animation for accordions and drawers.
- **`p-mask`**: Input formatting mask (e.g. `(999) 999-9999`).
- **`p-effect`**: Reactive inline side-effect execution.
- **`p-ref`**: DOM element reference registration.
- **`p-cloak`**: Anti-FOUC (Flash of Unstyled Content) attribute auto-removed on startup.
- **`p-teleport`**: Portals `<template>` DOM into target containers (e.g. `body`).
- **`p-id`**: Scoped unique ID generator for accessible form controls.

#### 3. Magic Properties (`$` Magics)
- **`$el`**: References the current DOM element.
- **`$root`**: References the closest component root element.
- **`$data`**: Accesses the current component's reactive state proxy.
- **`$refs`**: Accesses registered `p-ref` DOM element references.
- **`$store(name)`**: Accesses global reactive stores registered with `Pine.store()`.
- **`$watch(getter, callback, options)`**: Observes reactive property or expression mutations.
- **`$dispatch(name, detail, options)`**: Dispatches custom bubbling DOM events.
- **`$nextTick(callback)`**: Resolves a Promise or executes a callback after DOM reconciliation.
- **`$id(name, key)`**: Generates deterministic scoped element IDs.
- **`$signal(value)`**: Instantiates raw Signal primitives within templates.
- **`$persist(initialValue, key)`**: Realtime bidirectional `localStorage` persistence.
- **`$fetch(url, options)`**: Reactive REST API fetcher with automatic `loading`, `data`, `error`, and `status` properties.
- **`$intersect(callback, options)`**: IntersectionObserver viewport visibility tracker.
- **`$focus`**: Accessible focus manager with `.focus(el)` and `.trap(container)`.

#### 4. Global APIs & Built-in Plugins
- **`Pine.start()`**: Scans and initializes all `p-data` components on the page.
- **`Pine.data(name, factory)`**: Reusable component state definitions.
- **`Pine.store(name, data)`**: Global shared reactive stores.
- **`Pine.bind(name, callback)`**: Reusable directive/event binding objects.
- **`Pine.directive(name, handler)`**: Custom directive registration.
- **`Pine.magic(name, factory)`**: Custom magic property registration.
- **`Pine.plugin(pluginFn)`**: Modular plugin architecture.
- **`Pine.morph(fromEl, toEl)`**: Built-in DOM morphing algorithm for server-driven UI updates (HTMX / Hotwire compatible).

#### 5. Documentation & Tooling
- **Alpine.js-Style Documentation Site**: Comprehensive documentation covering all 60+ topics with dedicated interactive live `.demo-card` widgets.
- **Interactive Playground**: Dual-pane browser sandbox (`docs/playground.html`).
- **Realtime Benchmarks**: Reactivity and DOM performance stress tests (`docs/benchmarks.html`).
- **Automated Test Suite**: Browser test suite with automated assertions (`tests/test-suite.html`).

---

## 🔮 Future Roadmap

### `v1.4.0` — "Spruce" (Next Planned Release)
- [ ] **Configurable Multi-Prefix Engine (`Pine.prefix`)**:
  - Customize the directive prefix globally: `Pine.prefix('pine')` or `Pine.prefix('app')`.
  - Multi-prefix array support (`Pine.prefix(['p-', 'pine-', 'x-', ''])`) for progressive adoption.
- [ ] **Prefix-Free Semantic HTML Syntax (Industry First)**:
  - Clean HTML5 attribute bindings with zero framework prefixes:
    - `<div state="{ count: 0 }">` (Component root)
    - `<span text="count"></span>` (Reactive text)
    - `<input model="query" />` (Two-way model binding)
    - `<div show="isOpen"></div>` (Conditional display)
    - `<template loop="item in items">` (Keyed list iteration)
- [ ] **Expressive Symbol & Emoji Directives**:
  - Ultra-compact syntax for minimalists:
    - `🌲="{ ... }"` (Component state root)
    - `⚡="count"` (Atomic fine-grained signal text)
    - `~="query"` (Two-way model binding)
    - `?="isOpen"` (Conditional display)
    - `*="item in items"` (Loop iteration)
- [ ] **Universal "Chameleon" Drop-in Mode**:
  - Native runtime interception of Alpine `x-` attributes, upgrading legacy code to Signals with zero migration effort.
- [ ] **Unified `$`-Attribute Shorthands**:
  - Unify JS magics with HTML attributes: `<div $data="...">`, `<span $text="...">`, `<div $show="...">`.
- [ ] **Web Animations API Timeline Orchestrator (`Pine.timeline`)**:
  - Choreograph multi-element sequenced spring animations.

### `v2.0.0` — "Apex" (Major Evolution)
- [ ] Compiler-less JSX / Tagged template literals optional runtime.
- [ ] Web Worker off-thread signal computation bridge.
- [ ] Micro-frontend component isolation boundaries.

---

## 📝 Version Comparison Summary

| Feature | PineJS `v1.0.0` | PineJS `v1.1.0` | PineJS `v1.2.0` | PineJS `v1.3.0` | Alpine.js `v3.x` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Reactivity Primitive** | Fine-Grained Signals | Fine-Grained Signals | Fine-Grained Signals | **Fine-Grained Signals** | Coarse Proxy Observer |
| **Scope Inheritance** | Single-level | **Hierarchical Scope Proxy** | **Hierarchical Scope Proxy** | **Hierarchical Scope Proxy** | Prototype Chain |
| **Two-Way Synchronization** | Basic | **Mutex Reentrancy Guard** | **Mutex Reentrancy Guard** | **Mutex Reentrancy Guard** | Microtask Loop Guard |
| **Array Mutations** | Explicit length reads | **Auto-syncing Length Signals** | **Auto-syncing Length Signals** | **Auto-syncing Length Signals** | Proxy Interceptors |
| **Spring Physics & WAAPI** | None | None | None | **Built-in `p-animate`** | None |
| **DevTools Bridge** | None | None | None | **Built-in `Pine.devtools`** | Requires Extension |
| **TypeScript Typings** | Partial | Partial | **Full Ambient (`dist/pine.d.ts`)** | **Full Ambient (`dist/pine.d.ts`)** | Community / Defs |
| **URL Query Sync** | Custom code | Custom code | **Built-in `$history` Magic** | **Built-in `$history` Magic** | None |
| **SSR Hydration** | Manual | Manual | **Built-in `p-hydrate`** | **Built-in `p-hydrate`** | None |
| **Built-in Morphing** | Yes (`Pine.morph`) | Yes (`Pine.morph`) | **Yes (`Pine.morph`)** | **Yes (`Pine.morph`)** | Requires Separate Plugin |
| **Built-in Storage Persistence** | Yes (`$persist`) | Yes (`$persist`) | **Yes (`$persist`)** | **Yes (`$persist`)** | Requires Separate Plugin |
| **Built-in Async HTTP Fetch** | Yes (`$fetch`) | Yes (`$fetch`) | **Yes (`$fetch`)** | **Yes (`$fetch`)** | None |
| **Bundle Size (Minified)** | 33.98 KB | 34.66 KB | 35.87 KB | **~36.1 KB** | ~43 KB |
| **Bundle Size (Gzipped)** | 9.17 KB | 9.30 KB | 9.60 KB | **~9.68 KB** | ~15 KB |

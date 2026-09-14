<p align="center">
  <img src="docs/logo.svg" width="90" height="90" alt="PineJS Logo" />
</p>

# 🌲 PineJS (`pine.js`)

> **Next-Generation Fine-Grained Reactive Declarative Micro-Framework for Modern Web Apps**  
> *As simple and ergonomic as Alpine.js, fast as Solid signals, ultra-lightweight (&lt; 8 KB minified).*

[![Version](https://img.shields.io/badge/version-1.3.0%20%22Cedar%22-10b981.svg)](https://github.com)
[![Reactivity](https://img.shields.io/badge/reactivity-fine--grained%20signals-06b6d4.svg)](https://github.com)
[![Size](https://img.shields.io/badge/bundle%20size-%3C%2010%20KB%20min-8b5cf6.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-emerald.svg)](LICENSE)

---

## 🚀 Quick Overview

**PineJS** allows you to declare interactive frontend behavior right in your HTML without a build step or virtual DOM diffing overhead. 

Unlike Alpine.js (which uses proxy-based polling and coarse microtask tree evaluations), **PineJS is powered by true Fine-Grained Signals**. Every reactive binding (`p-text`, `:class`, `p-model`, `p-show`) directly subscribes to atomic signal changes, updating DOM nodes with near-zero latency.

```html
<!-- Include via CDN -->
<script src="https://unpkg.com/pinejs-core@1.3.0/dist/pine.min.js" defer></script>

<!-- Declare fine-grained reactive components -->
<div p-data="{ count: 0 }">
  <button @click="count++">Increment</button>
  <span p-text="count"></span>
</div>
```

---

## ⚡ Key Improvements Over Alpine.js

| Feature | Alpine.js (v3) | PineJS (v1.0) |
| :--- | :--- | :--- |
| **Reactivity Architecture** | Coarse Proxy tree effects | **True Fine-Grained Signals (`Signal`, `Computed`, `Effect`, `Batch`)** |
| **DOM Update Granularity** | Re-evaluates entire directive expressions | **Direct atomic text node & attribute subscriptions** |
| **Bundle Size** | ~14 KB minified | **&lt; 8 KB minified**, zero dependencies |
| **Built-in Magics** | `$el`, `$refs`, `$watch`, `$dispatch`, `$nextTick`, `$root`, `$data`, `$id`, `$store` | All Alpine magics PLUS **`$signal`**, **`$persist`** (auto localStorage sync), **`$fetch`** (reactive HTTP), **`$intersect`** |
| **List & Conditionals** | `<template x-if>` / `<template x-for>` | Fine-grained **`p-if`** & **`p-for`** with keyed recycling & signal disposal |
| **Transitions** | Class-based CSS strings | Class-based + **Preset animations (`fade`, `slide`, `scale`)** |
| **Transaction Batching** | Microtask queue | **Synchronous `Pine.batch()` + Microtask batching** |

---

## 📦 Directives Reference

- **`p-data`**: Initialize component scope: `<div p-data="{ count: 0 }">`
- **`p-bind` / `:attr`**: Bind attributes dynamically: `<button :disabled="isLoading" :class="{ active: isOpen }">`
- **`p-on` / `@event`**: Listen for events with modifiers: `<button @click.prevent="submit()" @click.outside="close()">`
  - Modifiers: `.prevent`, `.stop`, `.debounce.300ms`, `.throttle.100ms`, `.outside`, `.window`, `.document`, `.once`, `.passive`, `.enter`, `.escape`
- **`p-text`**: Update atomic `textContent`: `<span p-text="username"></span>`
- **`p-html`**: Update inner `innerHTML`: `<div p-html="rawArticle"></div>`
- **`p-model`**: Two-way data binding for inputs, textareas, selects, checkboxes, radios with `.number`, `.trim`, `.lazy`
- **`p-modelable`**: Expose internal component state to parent `p-model`: `<div p-modelable="selected">`
- **`p-show`**: Toggle element visibility (`display: none` / transitions): `<div p-show="isOpen"></div>`
- **`p-if`**: Conditionally mount/unmount DOM templates: `<template p-if="isLoggedIn">...</template>`
- **`p-for`**: Loop over arrays, objects, or numbers: `<template p-for="(item, i) in items">...</template>`
- **`p-transition`**: Smooth CSS enter/leave animations: `<div p-show="open" p-transition.fade>`
- **`p-animate`**: Spring physics and WAAPI keyframe animations: `<button p-animate.spring @click="liked = !liked">`
- **`p-effect`**: Execute side-effects reactively: `<div p-effect="console.log(count)">`
- **`p-ref`**: Register DOM element reference: `<input p-ref="searchField" />`
- **`p-cloak`**: Hide unrendered DOM until PineJS initializes: `<div p-cloak>`
- **`p-teleport`**: Teleport templates to external DOM containers: `<template p-teleport="body">`
- **`p-id`**: Scoped unique element ID generator for accessible form controls: `<div p-id="['user-id']">`
- **`p-hydrate`**: Server-side rendering (SSR) hydration activation marker: `<div p-data="{ count: 0 }" p-hydrate>`

---

## 🔮 Magic Properties Reference

- **`$el`**: The current DOM element
- **`$root`**: The closest component root element
- **`$data`**: Access current reactive component state scope
- **`$refs`**: Access elements marked with `p-ref` (`$refs.searchField.focus()`)
- **`$id(name)`**: Generate deterministic scoped unique element IDs
- **`$watch(prop, callback)`**: Reactively watch signals and variables
- **`$dispatch(event, payload)`**: Dispatch bubbling custom DOM events
- **`$nextTick(callback)`**: Execute after the next DOM update cycle
- **`$store(name)`**: Access global reactive store state
- **`$signal(initialValue)`**: Instantiate a raw fine-grained Signal
- **`$persist(initialValue, key)`**: Fine-grained reactive `localStorage` binding
- **`$history(initialValue, paramName)`**: Bidirectional URL query search parameter & `popstate` synchronization
- **`$fetch(url)`**: Reactive HTTP request state (`loading`, `data`, `error`)
- **`$intersect(callback)`**: Viewport intersection observer
- **`$focus`**: Keyboard focus manager and modal focus trap (`$focus.trap(el)`)

---

## 🛠️ Global JavaScript API

```javascript
// Global fine-grained signals
const count = Pine.signal(0);
const doubled = Pine.computed(() => count.value * 2);
Pine.effect(() => console.log(doubled.value));

// Transaction batching
Pine.batch(() => {
  count.value = 10;
});

// DevTools & Diagnostics
const inspection = Pine.devtools.inspect(document.querySelector('#my-app'));
console.log(inspection.data);

// Global state stores
Pine.store('auth', {
  user: 'Alex',
  token: 'jwt_123'
});

// Reusable component definitions
Pine.data('dropdown', () => ({
  open: false,
  toggle() { this.open = !this.open; }
}));

// Custom directives
Pine.directive('uppercase', (el) => {
  el.style.textTransform = 'uppercase';
});

// Plugins
Pine.plugin((Pine) => {
  // custom plugin logic
});
```

---

## 📂 Project Structure

```
pinejs/
├── dist/
│   ├── pine.js             # Development bundle with full diagnostics
│   ├── pine.min.js         # Production bundle (< 8 KB)
│   └── pine.esm.js         # ES Module export
├── docs/
│   ├── index.html          # Alpine.js-style interactive documentation site
│   ├── docs.css            # Clean dark/light theme typography & layout
│   ├── docs.js             # Interactive docs search, navigation & theme manager
│   ├── playground.html     # Live dual-pane code playground
│   └── benchmarks.html     # Realtime stress benchmarks
├── tests/
│   └── test-suite.html     # Automated browser test suite
├── package.json
└── README.md
```

---

## 🧪 Running the Documentation & Tests

1. Open `docs/index.html` in your browser to browse the Alpine-style documentation.
2. Open `docs/playground.html` for the live interactive sandbox.
3. Open `docs/benchmarks.html` to run fine-grained reactivity benchmarks.
4. Open `tests/test-suite.html` to execute automated test assertions.

---

## 🏷️ Version History & Releases

| Version | Codename | Release Date | Status | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **`v1.3.0`** | **Cedar** | 2026-09-15 | **Latest Stable** | `p-animate` spring physics & keyframe animations, `Pine.devtools` runtime diagnostics bridge, getter receiver proxy binding. |
| **`v1.2.0`** | **Redwood** | 2026-09-14 | Previous Stable | Official TypeScript typings (`dist/pine.d.ts`), `$history` URL query sync magic, `p-hydrate` SSR directive, fine-grained reactivity. |
| **`v1.1.0`** | **Sequoia** | 2026-09-14 | Stable | Hierarchical Scope Proxy inheritance, `p-modelable` mutex, reactive array auto-sync, debounced outside clicks, `Pine.$data()` API, minification pipeline. |
| **`v1.0.0`** | **Evergreen** | 2026-09-10 | Stable | Initial release with full Alpine.js API parity, Fine-Grained Signals, built-in morphing & plugins, and 60+ interactive docs components. |

👉 For full detailed release notes, breaking changes, and roadmap, see [CHANGELOG.md](file:///e:/afterquery/shopify/utility/pinejs/CHANGELOG.md).

---

## 📄 License
MIT License © 2026 PineJS Core Team.

<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/pinejs-core/docs/logo.svg" width="90" height="90" alt="PineJS Logo" />
</p>

# 🌲 PineJS (`pine.js`)

> **Next-Generation Fine-Grained Reactive Declarative Micro-Framework for Modern Web Apps**  
> *As simple and ergonomic as Alpine.js, fast as Solid signals, ultra-lightweight (&lt; 8 KB minified).*

[![Version](https://img.shields.io/badge/version-1.5.1%20%22Larch%22-10b981.svg)](https://github.com)
[![Reactivity](https://img.shields.io/badge/reactivity-fine--grained%20signals-06b6d4.svg)](https://github.com)
[![Size](https://img.shields.io/badge/bundle%20size-%3C%2010%20KB%20min-8b5cf6.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-emerald.svg)](LICENSE)

---

## 🚀 Quick Overview

**PineJS** allows you to declare interactive frontend behavior right in your HTML without a build step or virtual DOM diffing overhead. 

Unlike Alpine.js (which uses proxy-based polling and coarse microtask tree evaluations), **PineJS is powered by true Fine-Grained Signals**. Every reactive binding (`p-text`, `:class`, `p-model`, `p-show`, `p-validate`) directly subscribes to atomic signal changes, updating DOM nodes with near-zero latency.

### 🌲 4 Expressive Syntax Flavors in v1.5.1 ("Larch"):

```html
<!-- Include via CDN -->
<script src="https://unpkg.com/pinejs-core@1.5.1/dist/pine.min.js" defer></script>

<!-- Flavor 1: Standard Pine Directives -->
<div p-data="{ count: 0 }">
  <button @click="count++">Increment</button>
  <span p-text="count"></span>
</div>

<!-- Flavor 2: Prefix-Free Semantic HTML -->
<div state="{ count: 0 }">
  <button @click="count++">Increment</button>
  <span text="count"></span>
</div>

<!-- Flavor 3: Ultra-Concise Symbol & Emoji Directives -->
<div 🌲="{ count: 0 }">
  <button @click="count++">Increment</button>
  <span ⚡="count"></span>
</div>

<!-- Flavor 4: 100% Alpine.js Drop-in Chameleon Mode (Zero edits needed!) -->
<div x-data="{ count: 0 }">
  <button @click="count++">Increment</button>
  <span x-text="count"></span>
</div>
```

---

## ⚡ Key Improvements Over Alpine.js

| Feature | Alpine.js (v3) | PineJS (v1.5 "Larch") |
| :--- | :--- | :--- |
| **Reactivity Architecture** | Coarse Proxy tree effects | **True Fine-Grained Signals (`Signal`, `Computed`, `Effect`, `Batch`)** |
| **DOM Update Granularity** | Re-evaluates entire directive expressions | **Direct atomic text node & attribute subscriptions** |
| **Bundle Size** | ~14 KB minified | **&lt; 10 KB minified**, zero dependencies |
| **Directive Flavors** | `x-` prefix only | **Multi-Prefix (`p-`, `x-`, `pine-`), Prefix-Free Semantic HTML, & Symbol/Emoji (`🌲`, `⚡`, `~`, `?`, `*`)** |
| **Tagged Template Components** | Not available | **`Pine.html` compiler-less reactive templates** |
| **Form Validation** | Manual custom code | **Built-in `p-validate` with real-time `$errors`, `$valid`, `$touched`** |
| **Multi-Tab Sync** | Manual `storage` listeners | **Built-in `$broadcast` (native `BroadcastChannel` synchronization)** |
| **View Transitions** | CSS transitions only | **Built-in `$viewTransition` (native `document.startViewTransition`)** |
| **Off-Thread Web Workers** | Manual Web Worker code | **Built-in `Pine.worker` off-thread reactive signal computation** |
| **Animation Engine** | CSS class transitions only | **CSS transitions, `p-animate` Spring physics, & `Pine.timeline` WAAPI Orchestrator** |
| **Built-in Magics** | `$el`, `$refs`, `$watch`, `$dispatch`, `$nextTick`, `$root`, `$data`, `$id`, `$store` | All Alpine magics PLUS **`$signal`**, **`$persist`**, **`$history`**, **`$fetch`**, **`$broadcast`**, **`$viewTransition`**, **`$intersect`**, **`$focus`** |

---

## 📦 Directives Reference

- **`p-data` / `state` / `🌲` / `x-data`**: Initialize component scope: `<div p-data="{ count: 0 }">` or `<div state="{ count: 0 }">`
- **`p-validate` / `valid`**: Declarative form validation: `<input p-model="email" p-validate.required.email />`
- **`p-bind` / `:attr`**: Bind attributes dynamically: `<button :disabled="isLoading" :class="{ active: isOpen }">`
- **`p-on` / `@event`**: Listen for events with modifiers: `<button @click.prevent="submit()" @click.outside="close()">`
  - Modifiers: `.prevent`, `.stop`, `.debounce.300ms`, `.throttle.100ms`, `.outside`, `.window`, `.document`, `.once`, `.passive`, `.enter`, `.escape`
- **`p-text` / `text` / `⚡`**: Update atomic `textContent`: `<span p-text="username"></span>` or `<span text="username"></span>`
- **`p-html` / `html`**: Update inner `innerHTML`: `<div p-html="rawArticle"></div>`
- **`p-model` / `model` / `~`**: Two-way data binding for inputs, textareas, selects, checkboxes, radios with `.number`, `.trim`, `.lazy`
- **`p-modelable`**: Expose internal component state to parent `p-model`: `<div p-modelable="selected">`
- **`p-show` / `show` / `?`**: Toggle element visibility (`display: none` / transitions): `<div p-show="isOpen"></div>`
- **`p-if` / `when`**: Conditionally mount/unmount DOM templates: `<template p-if="isLoggedIn">...</template>` or `<template when="isLoggedIn">...</template>`
- **`p-for` / `loop` / `*`**: Loop over arrays, objects, or numbers: `<template p-for="(item, i) in items">...</template>` or `<template loop="item in items">...</template>`
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
- **`$broadcast(initialValue, channelName)`**: Cross-tab realtime reactive synchronization via `BroadcastChannel`
- **`$viewTransition(callback)`**: Native View Transitions API animation wrapper
- **`$persist(initialValue, key)`**: Fine-grained reactive `localStorage` binding
- **`$history(initialValue, paramName)`**: Bidirectional URL query search parameter & `popstate` synchronization
- **`$fetch(url)`**: Reactive HTTP request state (`loading`, `data`, `error`)
- **`$intersect(callback)`**: Viewport intersection observer
- **`$focus`**: Keyboard focus manager and modal focus trap (`$focus.trap(el)`)

---

## 🛠️ Global JavaScript API

```javascript
// Tagged Template Components (Compiler-less)
const Card = ({ title }) => Pine.html`
  <div state="{ liked: false }">
    <h3>${title}</h3>
    <button @click="liked = !liked" :class="{ active: liked }">Like</button>
  </div>
`;

// Off-Thread Web Worker Signal Bridge
const heavyWorker = Pine.worker((num) => {
  // Heavy computation running in background thread
  return num * 42;
});
heavyWorker.compute(100);

// Global fine-grained signals
const count = Pine.signal(0);
const doubled = Pine.computed(() => count.value * 2);
Pine.effect(() => console.log(doubled.value));

// Configure directive prefix
Pine.prefix('pine'); // Support pine-data, pine-text, etc.
Pine.prefix(['p-', 'x-', 'pine-']); // Support multiple prefixes simultaneously

// Web Animations API (WAAPI) Timeline Orchestration
const tl = Pine.timeline()
  .add('#badge', [{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300 })
  .add('#title', [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 400 }, '-=100');
tl.play();

// Transaction batching
Pine.batch(() => {
  count.value = 10;
});
```

---

## 🏷️ Version History & Roadmap

| Version | Codename | Release Date | Status | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **`v1.5.1`** | **Larch** | 2026-09-15 | **Latest Stable** | Tagged Template Components (`Pine.html`), Form Validation (`p-validate`), Cross-Tab Broadcast Sync (`$broadcast`), Native View Transitions (`$viewTransition`), Web Worker Signal Bridge (`Pine.worker`). |
| **`v1.4.0`** | **Spruce** | 2026-09-15 | Previous Stable | Configurable multi-prefix engine (`Pine.prefix`), prefix-free semantic HTML (`state`, `text`, `show`, `model`, `loop`), symbol shorthands (`🌲`, `⚡`, `~`, `?`, `*`), WAAPI timeline orchestrator (`Pine.timeline`), chameleon drop-in mode. |
| **`v1.3.0`** | **Cedar** | 2026-09-15 | Stable | `p-animate` spring physics & keyframe animations, `Pine.devtools` runtime diagnostics bridge, getter receiver proxy binding. |
| **`v1.2.0`** | **Redwood** | 2026-09-14 | Stable | Official TypeScript typings (`dist/pine.d.ts`), `$history` URL query sync magic, `p-hydrate` SSR directive, fine-grained reactivity. |
| **`v1.1.0`** | **Sequoia** | 2026-09-14 | Stable | Hierarchical Scope Proxy inheritance, `p-modelable` mutex, reactive array auto-sync, debounced outside clicks, `Pine.$data()` API, minification pipeline. |
| **`v1.0.0`** | **Evergreen** | 2026-09-10 | Stable | Initial release with full Alpine.js API parity, Fine-Grained Signals, built-in morphing & plugins, and 60+ interactive docs components. |

👉 For full detailed release notes, architecture plans, and roadmap, see [CHANGELOG.md](file:///e:/afterquery/shopify/utility/pinejs/CHANGELOG.md).

---

## 📄 License
MIT License © 2026 PineJS Core Team.

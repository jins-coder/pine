<p align="center">
  <img src="docs/logo.svg" width="100" height="100" alt="PineJS Logo" />
</p>

<h1 align="center">🌲 PineJS</h1>

<p align="center">
  <strong>Next-Generation Fine-Grained Reactive Declarative Micro-Framework for Modern Web Apps</strong><br>
  <em>Direct-DOM signal reactivity, declarative directives, native realtime engines, and zero-build simplicity.</em>
</p>

<p align="center">
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/version-1.6.0%20%22Bristlecone%22-10b981.svg?style=flat-square" alt="Version 1.6.0"></a>
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/reactivity-fine--grained%20signals-06b6d4.svg?style=flat-square" alt="Fine-Grained Reactivity"></a>
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/bundle%20size-16.0%20KB%20min%20gzip-8b5cf6.svg?style=flat-square" alt="Bundle Size"></a>
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/tests-51%2F51%20passing%20(100%25)-emerald.svg?style=flat-square" alt="Test Status"></a>
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/dependencies-0%20deps-f59e0b.svg?style=flat-square" alt="Zero Dependencies"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
</p>

---

## ⚡ Why PineJS?

Modern web development shouldn't require complex toolchains, megabyte-sized runtimes, or virtual DOM reconciliation overhead just to build reactive user interfaces.

**PineJS** gives you the simplicity of declaring UI behavior directly inside your HTML markup, backed by **true fine-grained signals**. When a state property changes, only the exact text node or DOM attribute that depends on that signal re-evaluates—no tree diffing, no full-component re-renders, and sub-millisecond execution.

```html
<div p-data="{ count: 0 }">
  <button @click="count++">Increment</button>
  <span p-text="count"></span>
</div>
```

---

## 🚀 Installation & Dual CDN Guide

PineJS provides two dedicated builds to match your development and deployment workflows:

### 1. ⚡ Production Version (`pine.prod.js` / `pine.min.js`)
* **Best for**: Production websites, live storefronts, high-performance web apps.
* **Characteristics**: Fully minified with esbuild/terser, stripped of debug logging, tree-shaken, **~16.0 KB gzipped** (14.3 KB brotli).

```html
<!-- jsDelivr (GitHub Latest / Tagged) -->
<script src="https://cdn.jsdelivr.net/gh/jins-coder/pine@main/dist/pine.prod.js" defer></script>

<!-- unpkg (NPM release) -->
<script src="https://unpkg.com/pinejs-core@1.6.0/dist/pine.prod.js" defer></script>
```

### 2. 🛠️ Development Version (`pine.dev.js`)
* **Best for**: Local development, debugging, staging environments, interactive tutorials.
* **Characteristics**: Unminified, informative console diagnostics, detailed syntax error reports, uncompressed stack traces.

```html
<!-- jsDelivr (GitHub Latest / Tagged) -->
<script src="https://cdn.jsdelivr.net/gh/jins-coder/pine@main/dist/pine.dev.js" defer></script>

<!-- unpkg (NPM release) -->
<script src="https://unpkg.com/pinejs-core@1.6.0/dist/pine.dev.js" defer></script>
```

### 📦 Package Manager (npm / pnpm / yarn)

```bash
npm install pinejs-core
```

```javascript
// Import Production or Development builds in Vite / Webpack / Rollup
import Pine from 'pinejs-core';          // Default bundle
import 'pinejs-core/prod';              // Explicit production bundle
import 'pinejs-core/dev';               // Explicit development bundle
```

---

## 🌲 Syntax Flavors & Clean Markup

PineJS is built with flexibility at its core. You can choose the syntax style that best matches your codebase aesthetic:

### Flavor 1: Standard Directives (`p-`)
```html
<div p-data="{ open: false }">
  <button @click="open = !open">Toggle</button>
  <div p-show="open" p-transition.fade>Hello Pine!</div>
</div>
```

### Flavor 2: Explicit Namespaced Directives (`pine-`)
```html
<div pine-data="{ query: '' }">
  <input pine-model="query" placeholder="Search..." />
  <p>Searching for: <span pine-text="query"></span></p>
</div>
```

### Flavor 3: Prefix-Free Semantic HTML
```html
<div state="{ count: 0 }">
  <button @click="count++">Increment</button>
  <span text="count"></span>
</div>
```

> [!TIP]
> You can configure your own custom prefix at runtime using `Pine.prefix('app-')` or `Pine.prefix(['p-', 'pine-'])`.

---

## 🌐 Global Data & Factory Functions in `p-data`

PineJS allows you to initialize component state in multiple clean ways: inline objects, global `<script>` variables, factory functions, or registered components:

### 1. Global `<script>` Variables
Reference plain objects or arrays defined anywhere in your page scripts:

```html
<script>
  const alphadata = {
    user: 'Alex',
    role: 'Admin',
    status: 'online'
  };
</script>

<div p-data="alphadata">
  <h2 p-text="user"></h2>
  <span p-text="role"></span>
</div>
```

### 2. Component Factory Functions
Functions are automatically executed to generate independent, reactive component instances:

```html
<script>
  function counterComponent(initial = 0) {
    return {
      count: initial,
      increment() { this.count++; },
      decrement() { this.count--; }
    };
  }
</script>

<div p-data="counterComponent(10)">
  <button @click="decrement()">-</button>
  <span p-text="count"></span>
  <button @click="increment()">+</button>
</div>
```

### 3. Registered Components via `Pine.data()`
```javascript
Pine.data('dropdown', (defaultOpen = false) => ({
  isOpen: defaultOpen,
  toggle() { this.isOpen = !this.isOpen; },
  close() { this.isOpen = false; }
}));
```
```html
<div p-data="dropdown(false)">
  <button @click="toggle()">Menu</button>
  <ul p-show="isOpen" @click.outside="close()">
    <li>Profile</li>
    <li>Settings</li>
  </ul>
</div>
```

---

## 📡 Built-In Realtime Engines

PineJS includes lightweight, first-class realtime reactivity engines with zero external dependencies and automatic lifecycle cleanup when elements are unmounted:

### 1. WebSocket Full-Duplex Client (`$websocket` / `Pine.websocket`)
Features automatic exponential-backoff reconnects, auto-JSON serialization, message history buffering, and reactive state:

```html
<div p-data="{ ws: $websocket('wss://echo.websocket.events'), msg: '' }">
  <div class="status">
    Status: <span p-text="ws.status"></span>
    <span :class="{ 'connected': ws.connected }">●</span>
  </div>

  <form @submit.prevent="ws.send({ text: msg }); msg = ''">
    <input p-model="msg" placeholder="Type a message..." />
    <button :disabled="!ws.connected">Send</button>
  </form>

  <p>Latest Message: <span p-text="ws.data?.text || 'None'"></span></p>
</div>
```

### 2. Server-Sent Events Client (`$sse` / `Pine.sse`)
Ideal for LLM chat streaming, live tickers, real-time dashboards, and notifications:

```html
<div p-data="{ stream: $sse('/api/notifications') }">
  <p>Status: <span p-text="stream.status"></span></p>
  <div p-show="stream.data">
    <strong p-text="stream.data.title"></strong>
    <p p-text="stream.data.body"></p>
  </div>
</div>
```

### 3. Cross-Tab Synchronization (`$broadcast`)
Keep state synced across all open browser tabs via native `BroadcastChannel`:

```html
<div p-data="{ theme: $broadcast('dark', 'app-theme') }">
  <button @click="theme = theme === 'dark' ? 'light' : 'dark'">
    Current Theme: <span p-text="theme"></span> (Syncs across tabs!)
  </button>
</div>
```

---

## 📖 Complete Directives Reference

| Directive | Description | Example |
| :--- | :--- | :--- |
| **`p-data`** | Declares reactive component state scope | `<div p-data="{ count: 0 }">` |
| **`p-bind` / `:attr`** | Dynamically binds attributes & CSS classes | `<button :disabled="loading" :class="{ active: on }">` |
| **`p-on` / `@event`** | Listens for DOM events with rich modifiers | `<button @click.prevent.stop="save()">` |
| **`p-text`** | Updates atomic `textContent` via signal subscription | `<span p-text="user.name"></span>` |
| **`p-html`** | Sets sanitized raw HTML | `<div p-html="markdownContent"></div>` |
| **`p-model`** | Two-way binding for inputs, selects, and checkboxes | `<input p-model.trim.lazy="query" />` |
| **`p-modelable`** | Exposes inner component property to parent `p-model` | `<div p-data="{ value: 0 }" p-modelable="value">` |
| **`p-show`** | Toggles visibility with auto ARIA `aria-hidden` sync | `<div p-show="isOpen" p-transition.fade>` |
| **`p-if`** | Conditionally renders template element in DOM | `<template p-if="isLoggedIn"><span>Welcome!</span></template>` |
| **`p-else-if`** | Intermediate condition for `<template>` branch | `<template p-else-if="isPending"><span>Loading...</span></template>` |
| **`p-else`** | Fallback condition for `<template>` branch | `<template p-else><span>Please sign in.</span></template>` |
| **`p-for`** | Loops over arrays, objects, or ranges | `<template p-for="(item, i) in items" :key="item.id">` |
| **`p-validate`** | Form validation with `$errors`, `$valid`, `$touched` | `<input p-model="email" p-validate.required.email />` |
| **`p-trap`** | Traps keyboard tab navigation (WAI-ARIA dialogs) | `<div role="dialog" p-trap="isOpen">` |
| **`p-mask`** | Formats input values (`9` numbers, `a` letters, `*` any) | `<input p-mask="9999-9999-9999-9999" />` |
| **`p-error`** | Declarative error boundary catching component crashes | `<div p-error="hasError = true"><span p-text="$error"></span></div>` |
| **`p-teleport`** | Portals templates to other DOM targets (e.g. `body`) | `<template p-teleport="body"><div class="modal">...</div></template>` |
| **`p-transition`** | Enter/leave CSS transition animations (`fade`, `scale`) | `<div p-show="open" p-transition.fade.duration.200ms>` |
| **`p-animate`** | Spring physics and WAAPI keyframe animations | `<button p-animate.spring @click="liked = !liked">` |
| **`p-effect`** | Runs reactive side-effect when accessed signals change | `<div p-effect="console.log('Count changed:', count)">` |
| **`p-ref`** | Registers a reference to a DOM node | `<input p-ref="inputField" />` (access via `$refs.inputField`) |
| **`p-cloak`** | Hides uncompiled DOM until PineJS boots | `<div p-cloak>` (use with `[p-cloak] { display: none; }`) |
| **`p-id`** | Generates deterministic scoped element IDs | `<div p-id="['input', 'label']">` |
| **`p-hydrate`** | Tells PineJS to hydrate pre-rendered SSR HTML | `<div p-data="{ count: 0 }" p-hydrate>` |

### Event Modifiers Reference

Combine modifiers seamlessly: `@submit.prevent.stop="save"` or `@keydown.window.escape="close"`.

* **Flow**: `.prevent`, `.stop`, `.self`, `.capture`, `.once`, `.passive`
* **Rate-limiting**: `.debounce.250ms`, `.throttle.100ms`
* **Targeting**: `.outside`, `.window`, `.document`
* **Keyboard**: `.enter`, `.escape`, `.tab`, `.space`, `.backspace`, `.delete`, `.up`, `.down`, `.left`, `.right`
* **Modifier Keys**: `.ctrl`, `.meta`, `.cmd`, `.shift`, `.alt`
* **Mouse**: `.left`, `.middle`, `.right`

---

## 🔮 Magic Properties Reference

| Magic | Description | Example Usage |
| :--- | :--- | :--- |
| **`$el`** | The current DOM element | `$el.focus()` |
| **`$root`** | The root DOM element of the current component | `$root.dataset.theme` |
| **`$data`** | The reactive proxy scope of the current component | `console.log($data)` |
| **`$refs`** | Map of DOM elements marked with `p-ref` | `$refs.searchBox.select()` |
| **`$id(name)`** | Returns a scoped unique identifier | `:id="$id('input')"` |
| **`$watch(prop, cb)`** | Reactively observes property or expression changes | `$watch('count', (newVal) => track(newVal))` |
| **`$dispatch(event, detail)`** | Dispatches a bubbling custom DOM Event | `$dispatch('item-added', { id: 42 })` |
| **`$nextTick(cb)`** | Executes callback after the next DOM update flush | `$nextTick(() => $refs.box.scrollTop = 9999)` |
| **`$store(name)`** | Accesses a shared global reactive store | `$store('cart').items.length` |
| **`$persist(val, key)`** | Persists signal to `localStorage` with reactive sync | `items: $persist([], 'todo_items')` |
| **`$history(val, param)`** | Syncs state with URL query search parameters | `search: $history('', 'q')` |
| **`$fetch(url)`** | Reactive HTTP fetcher with `data`, `loading`, `error` | `users: $fetch('/api/users')` |
| **`$websocket(url)`** | Realtime WebSocket client with auto-reconnect & JSON | `ws: $websocket('wss://server/chat')` |
| **`$sse(url)`** | Realtime Server-Sent Events client | `stream: $sse('/events')` |
| **`$broadcast(val, chan)`** | Cross-tab reactive synchronization | `auth: $broadcast(null, 'session')` |
| **`$viewTransition(cb)`** | Executes update inside Native View Transitions API | `$viewTransition(() => tab = 'settings')` |
| **`$intersect(cb)`** | Triggered when element enters viewport | `@intersect="loadMore()"` |
| **`$focus`** | Accessible focus management helper | `$focus.trap($el)` or `$focus.focusFirst($el)` |
| **`$error`** | Captured error object within `p-error` boundary | `<p p-text="$error?.message"></p>` |

---

## 🛡️ Content Security Policy (CSP) Safe Mode

For financial applications, high-security enterprise intranets, and Chrome extensions that ban `unsafe-eval`, PineJS includes a built-in AST evaluator:

```javascript
// Enable Strict CSP Mode - eliminates all new Function / eval usage
Pine.csp(true);
```

```html
<!-- Fully functional without eval/Function -->
<div p-data="{ count: 0, items: ['Apple', 'Banana'] }">
  <button @click="count = count + 1">Add</button>
  <p p-text="items[count % items.length]"></p>
</div>
```

---

## 🛠️ Global JavaScript API

```javascript
// Initialize or register global stores
Pine.store('auth', {
  user: null,
  login(name) { this.user = name; },
  logout() { this.user = null; }
});

// Custom Directives
Pine.directive('tooltip', (el, { value }) => {
  el.setAttribute('title', value);
});

// Custom Magic Properties
Pine.magic('clipboard', () => ({
  async copy(text) { await navigator.clipboard.writeText(text); }
}));

// Fine-Grained Signals API
const count = Pine.signal(0);
const doubled = Pine.computed(() => count.value * 2);
Pine.effect(() => console.log('Doubled is:', doubled.value));

// Transaction Batching
Pine.batch(() => {
  count.value = 5;
  // All subscriber DOM effects execute once at end of batch
});

// Global Telemetry & Error Tracking (Sentry, Datadog)
Pine.onError((err, el, expr) => {
  console.error(`[Pine Telemetry] Expression "${expr}" failed on`, el, err);
});
```

---

## 🔮 What's Currently Lacking / Future Horizons

While PineJS v1.6.0 ("Bristlecone") is exceptionally capable, mature, and passes all 51 automated test suites with 100% reliability, an objective engineering assessment reveals several key architectural frontiers for future releases:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PineJS Future Horizon Roadmap                        │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Server-Side HTML Rendering  │ Pine.renderToString() for Node/Edge   │
│ 2. Declarative Micro-Router    │ p-route, nested views, param parsing  │
│ 3. Unified Form Engine         │ $form (dirty, pristine, auto-reset)   │
│ 4. DevTools Chrome Extension   │ Visual signal graph & time travel     │
│ 5. Scoped Shadow DOM Isolation │ p-scope web-component encapsulation   │
└────────────────────────────────┴───────────────────────────────────────┘
```

### 1. Server-Side HTML String Renderer (`Pine.renderToString`)
* **Current State**: PineJS features `p-hydrate`, which skips destructive re-rendering when encountering pre-rendered HTML on the client.
* **What's Lacking**: There is currently no official standalone Node.js, Deno, or Cloudflare Workers SSR engine to compile a template + state into an initial HTML string on the server without a headless browser.
* **Target Horizon**: A zero-DOM server-side string compiler that outputs pre-populated HTML with embedded state markers.

### 2. Declarative Client-Side Micro-Router (`p-route` / `Pine.router`)
* **Current State**: PineJS provides `$history(val, 'param')` for synchronizing URL query parameters with reactive state.
* **What's Lacking**: PineJS currently has no built-in client-side SPA routing system with path pattern matching (`/user/:id`), navigation guards, nested layouts, and automatic View Transitions between page routes.
* **Target Horizon**: A lightweight `<template p-route="/path">` micro-router plugin under 2 KB.

### 3. Unified Reactive Form Engine (`$form`)
* **Current State**: `p-validate` provides robust declarative field validation with `$errors`, `$valid`, `$touched`, and `$dirty`.
* **What's Lacking**: There is no overarching `$form` controller managing holistic form state: serialization into `FormData` or JSON, async submission state (`$form.submitting`), auto-rollback on server error, and programmatic resetting (`$form.reset()`).
* **Target Horizon**: First-class `<form p-data="$form({ ... })">` with automatic submit orchestration and validation aggregation.

### 4. Dedicated Browser DevTools Extension
* **Current State**: `Pine.devtools` provides an inspection API (`Pine.devtools.inspect(el)`, `Pine.devtools.getScope(el)`).
* **What's Lacking**: A dedicated Chrome/Firefox DevTools panel with an interactive visual component tree, live signal dependency graphs, and time-travel state debugging.
* **Target Horizon**: A standardized `window.__PINE_DEVTOOLS_HOOK__` bridge and Chrome Web Store extension.

### 5. Scoped Shadow DOM Encapsulation (`p-scope`)
* **Current State**: Component state is scoped via Hierarchical Scope Proxies, but CSS and DOM nodes remain in the global light DOM.
* **What's Lacking**: Native Shadow DOM attachment to create isolated micro-frontends or distributable Web Components with non-bleeding styles.

---

## 🧪 Automated Testing & Verification

PineJS maintains a comprehensive automated test suite verified on every build via headless Google Chrome:

```bash
# Run headless browser test suite
npm test
```

```
🌲 PineJS Automated Headless Test Runner
   Suites Total:  51
   Suites Passed: 51 (100%)
   Suites Failed: 0
   Tests Total:   51
   Tests Passed:  51 (100%)
   ✨ All test suites passed successfully!
```

---

## 🏷️ Release History

| Version | Codename | Date | Key Highlights |
| :--- | :--- | :--- | :--- |
| **`v1.6.0`** | **Bristlecone** | 2026-09-15 | Dual CDN build targets (`pine.prod.js` & `pine.dev.js`), native `$websocket` and `$sse` realtime engines, global script data resolution (`p-data="alphadata"`), CSP-safe mode (`Pine.csp`), error boundaries (`p-error`), deep `$persist`, headless CI runner (51/51 tests). |
| **`v1.5.1`** | **Larch** | 2026-09-15 | Tagged template components (`Pine.html`), form validation (`p-validate`), cross-tab sync (`$broadcast`), native View Transitions (`$viewTransition`), Web Worker signal bridge (`Pine.worker`). |
| **`v1.4.0`** | **Spruce** | 2026-09-15 | Multi-prefix engine (`Pine.prefix`), prefix-free semantic HTML (`state`, `text`, `loop`, `show`), WAAPI timeline orchestrator (`Pine.timeline`). |
| **`v1.3.0`** | **Cedar** | 2026-09-14 | Spring physics animations (`p-animate`), runtime devtools bridge, getter receiver proxy binding. |
| **`v1.2.0`** | **Redwood** | 2026-09-14 | Official TypeScript typings (`dist/pine.d.ts`), `$history` URL sync, `p-hydrate` SSR marker. |
| **`v1.1.0`** | **Sequoia** | 2026-09-14 | Hierarchical Scope Proxy inheritance, `p-modelable` mutex, reactive array auto-sync. |
| **`v1.0.0`** | **Evergreen** | 2026-09-10 | Initial release: fine-grained signals, reactive directives, built-in morphing. |

---

## 📄 License

MIT License © 2026 PineJS Core Team. Open-source and free for commercial and personal use.

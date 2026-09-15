<p align="center">
  <img src="docs/logo.svg" width="100" height="100" alt="PineJS Logo" />
</p>

<h1 align="center">🌲 PineJS</h1>

<p align="center">
  <strong>Next-Generation Fine-Grained Reactive Declarative Micro-Framework for Modern Web Apps</strong><br>
  <em>Direct-DOM signal reactivity, built-in client micro-router, unified form engine, async suspense, zero-DOM SSR, native realtime, and zero-build simplicity.</em>
</p>

<p align="center">
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/version-1.7.0%20%22Douglas%22-10b981.svg?style=flat-square" alt="Version 1.7.0"></a>
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/reactivity-fine--grained%20signals-06b6d4.svg?style=flat-square" alt="Fine-Grained Reactivity"></a>
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/bundle%20size-23.2%20KB%20min%20gzip-8b5cf6.svg?style=flat-square" alt="Bundle Size"></a>
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/tests-71%2F71%20passing%20(100%25)-emerald.svg?style=flat-square" alt="Test Status"></a>
  <a href="https://github.com/jins-coder/pine"><img src="https://img.shields.io/badge/dependencies-0%20deps-f59e0b.svg?style=flat-square" alt="Zero Dependencies"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <br>
  <a href="https://github.com/jins-coder/pine">📦 GitHub Repository</a> · <a href="https://github.com/jins-coder/pine/issues">🐛 Issues</a> · <a href="https://github.com/jins-coder/pine/releases">📋 Releases</a>
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
* **Characteristics**: Fully minified with esbuild/terser, stripped of debug logging, tree-shaken, **~23.2 KB gzipped** (20.6 KB brotli).

```html
<!-- jsDelivr (GitHub Latest — always up to date) -->
<script src="https://cdn.jsdelivr.net/gh/jins-coder/pine@main/dist/pine.prod.js" defer></script>

<!-- jsDelivr (Pinned to v1.7.0 tag) -->
<script src="https://cdn.jsdelivr.net/gh/jins-coder/pine@v1.7.0/dist/pine.prod.js" defer></script>

<!-- unpkg (NPM release) -->
<script src="https://unpkg.com/pinejs-core@latest/dist/pine.prod.js" defer></script>
```

### 2. 🛠️ Development Version (`pine.dev.js`)
* **Best for**: Local development, debugging, staging environments, interactive tutorials.
* **Characteristics**: Unminified, informative console diagnostics, detailed syntax error reports, uncompressed stack traces.

```html
<!-- jsDelivr (GitHub Latest — always up to date) -->
<script src="https://cdn.jsdelivr.net/gh/jins-coder/pine@main/dist/pine.dev.js" defer></script>

<!-- jsDelivr (Pinned to v1.7.0 tag) -->
<script src="https://cdn.jsdelivr.net/gh/jins-coder/pine@v1.7.0/dist/pine.dev.js" defer></script>

<!-- unpkg (NPM release) -->
<script src="https://unpkg.com/pinejs-core@latest/dist/pine.dev.js" defer></script>
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

## 🧭 Client-Side Micro-Router (`p-route` & `p-link`)

Build complete Single-Page Applications (SPAs) with zero external routing libraries:

```html
<nav>
  <a p-link href="/">Home</a>
  <a p-link href="/products/42">Product #42</a>
  <a p-link href="/about">About</a>
</nav>

<!-- Declarative Route Views -->
<template p-route="/">
  <div>Welcome to our store!</div>
</template>

<template p-route="/products/:id">
  <div p-data="{ id: $route.params.id }">
    Viewing Product #<span p-text="id"></span>
  </div>
</template>

<template p-route="*">
  <div>404 Page Not Found</div>
</template>
```

* **Dynamic Route Parameters**: `:param` segments automatically mapped to `$route.params`.
* **Declarative Links**: `<a p-link href="...">` intercepts clicks, prevents reloads, and toggles `.active` class automatically.
* **View Transitions**: Integrated with native `document.startViewTransition()` for smooth page transitions.
* **Programmatic Navigation**: `$route.push('/path')`, `$route.replace('/path')`, `$route.go(-1)`.
* **Guards**: `Pine.router.beforeEach((to, from) => { if (needAuth && !isLoggedIn) return false; })`.

---

## 📋 Unified Reactive Form Engine (`$form`)

Dramatically simplify form state, validation, dirty tracking, and submissions:

```html
<form p-data="$form({
  username: '',
  email: '',
  acceptTerms: false
})" @submit.prevent="$form.submit('/api/register')">

  <input p-model="username" p-validate.required />
  <p p-show="$form.errors.username" p-text="$form.errors.username" class="error"></p>

  <input p-model="email" p-validate.required.email />
  <p p-show="$form.errors.email" p-text="$form.errors.email" class="error"></p>

  <!-- Automatic Reactive Form State Properties -->
  <button :disabled="$form.invalid || $form.submitting || !$form.dirty">
    <span p-show="$form.submitting">Creating Account...</span>
    <span p-show="!$form.submitting">Register</span>
  </button>
  <button type="button" @click="$form.reset()">Reset</button>
</form>
```

* **Dirty / Pristine Tracking**: `$form.dirty`, `$form.pristine`, `$form.isDirty('username')`.
* **Validity Aggregation**: `$form.valid`, `$form.invalid`, `$form.errors`.
* **Submission States**: `$form.submitting`, `$form.submitted`, `$form.submitCount`.
* **Serialization & Resets**: `$form.formData()`, `$form.json()`, `$form.reset()`.

---

## ⏳ Async Suspense & Skeleton Loader (`p-suspense`)

Display fallback skeleton loaders while async promises, remote components, or data fetches resolve:

```html
<div p-suspense>
  <template p-fallback>
    <div class="skeleton-placeholder">
      <div class="shimmer-line"></div>
      <div class="shimmer-line"></div>
    </div>
  </template>

  <!-- Automatically reveals once inner $fetch resolves -->
  <div p-data="{ user: $fetch('/api/user/profile') }">
    <h2 p-text="user.name"></h2>
    <p p-text="user.bio"></p>
  </div>
</div>
```

---

## 📦 On-Demand Remote Component Loader (`p-component`)

Fetch and mount remote HTML templates on demand using built-in DOM morphing:

```html
<div p-component="/snippets/cart-drawer.html">
  <template p-loading>
    <div class="spinner">Loading Cart...</div>
  </template>
</div>
```

---

## 🖥️ Zero-DOM Server-Side HTML String Compiler (`Pine.renderToString`)

Compile Pine templates directly on Node.js, Cloudflare Workers, Express, Fastify, or Deno without headless browsers or JSDOM:

```javascript
import Pine from 'pinejs-core';

const html = Pine.renderToString(`
  <div p-data="{ user: 'Alice', role: 'Admin' }">
    <h1 p-text="user"></h1>
    <span p-text="role"></span>
  </div>
`);

// Outputs:
// <div p-hydrate p-data="{ user: 'Alice', role: 'Admin' }">
//   <h1 p-text="user">Alice</h1>
//   <span p-text="role">Admin</span>
// </div>
```

---

## 🛡️ Scoped Shadow DOM Encapsulation (`p-shadow`)

Isolate styles and DOM completely for third-party embeds, Shopify apps, and Web Components:

```html
<div p-shadow>
  <style>
    button { background: #10b981; color: white; border-radius: 8px; }
  </style>
  <div p-data="{ likes: 0 }">
    <button @click="likes++">Likes: <span p-text="likes"></span></button>
  </div>
</div>
```

---

## 💾 Large Offline Storage (`$idb` / `Pine.idb`)

Bypass the synchronous 5MB `localStorage` ceiling with non-blocking IndexedDB persistence:

```html
<div p-data="{ orders: $idb([], 'customer_orders') }">
  <button @click="orders.push({ id: Date.now(), total: 49.99 })">
    Add Order (Saved in IndexedDB!)
  </button>
  <p>Total Cached Orders: <span p-text="orders.length"></span></p>
</div>
```

---

## 🔍 Chrome DevTools Extension & Hook

PineJS includes an official DevTools hook and Chrome Extension panel located in [`devtools/`](devtools/):

```javascript
// Global hook available on window
window.__PINE_DEVTOOLS_GLOBAL_HOOK__.getComponentTree();
window.__PINE_DEVTOOLS_GLOBAL_HOOK__.on('route:change', (data) => console.log(data));
```

To load the PineJS DevTools in Chrome:
1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the [`devtools/`](devtools/) folder in this repository.

---

## 🌲 Syntax Flavors & Clean Markup

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

---

## 📡 Built-In Realtime Engines

### 1. WebSocket Full-Duplex Client (`$websocket` / `Pine.websocket`)
```html
<div p-data="{ ws: $websocket('wss://echo.websocket.events'), msg: '' }">
  <span p-text="ws.status"></span>
  <form @submit.prevent="ws.send({ text: msg }); msg = ''">
    <input p-model="msg" />
    <button :disabled="!ws.connected">Send</button>
  </form>
  <p>Received: <span p-text="ws.data?.text"></span></p>
</div>
```

### 2. Server-Sent Events Client (`$sse` / `Pine.sse`)
```html
<div p-data="{ stream: $sse('/api/live-stream') }">
  <p>Status: <span p-text="stream.status"></span></p>
  <span p-text="stream.data?.message"></span>
</div>
```

### 3. Cross-Tab Synchronization (`$broadcast`)
```html
<div p-data="{ theme: $broadcast('dark', 'app-theme') }">
  <button @click="theme = theme === 'dark' ? 'light' : 'dark'">
    Theme: <span p-text="theme"></span> (Syncs across tabs!)
  </button>
</div>
```

---

## 📖 Complete Directives Reference

| Directive | Description | Example |
| :--- | :--- | :--- |
| **`p-data`** | Declares reactive component state scope | `<div p-data="{ count: 0 }">` |
| **`p-route`** | Client-side route matching with `:params` & `*` | `<template p-route="/user/:id">` |
| **`p-link`** | Declarative link with auto active-class toggle | `<a p-link href="/dashboard">` |
| **`p-suspense`** | Suspense coordinator with fallback template | `<div p-suspense><template p-fallback>...` |
| **`p-component`**| Loads and morphs remote HTML templates | `<div p-component="/snippets/cart.html">` |
| **`p-shadow`** | Encapsulates element in Shadow DOM | `<div p-shadow>` |
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
| **`p-ref`** | Registers a reference to a DOM node | `<input p-ref="inputField" />` |
| **`p-cloak`** | Hides uncompiled DOM until PineJS boots | `<div p-cloak>` |
| **`p-id`** | Generates deterministic scoped element IDs | `<div p-id="['input', 'label']">` |
| **`p-hydrate`** | Tells PineJS to hydrate pre-rendered SSR HTML | `<div p-data="{ count: 0 }" p-hydrate>` |

| **`p-scope`** | Creates an isolated child scope on any element | `<div p-scope="{ color: 'red' }">` |

---

## ⚙️ Engine Hardening & Production APIs

PineJS v1.7.0 includes deep engine-level primitives for production hardening:

### Explicit Reactive Scopes (`Pine.scope`)
```javascript
const scope = Pine.scope();
scope.effect(() => console.log(count.value));
scope.listen(btn, 'click', () => count.value++);
scope.timeout(() => console.log('delayed'), 1000);
scope.dispose(); // Tears down ALL effects, listeners, and timers
```

### Centralized Scheduler (`Pine.scheduler`)
```javascript
Pine.scheduler.schedule(() => updateUI(), 'raf');     // requestAnimationFrame
Pine.scheduler.schedule(() => analytics(), 'idle');    // requestIdleCallback
Pine.scheduler.flush();                               // Force-flush all queues
```

### Async Batch Mutations (`Pine.batchAsync`)
```javascript
await Pine.batchAsync(async () => {
  count.value++;
  await fetchData();
  items.value = data;  // Subscribers flush ONCE at completion
});
```

### Transactional State Updates (`Pine.transaction`)
```javascript
try {
  Pine.transaction(() => {
    user.name = 'Bob';
    user.balance -= 100;
    if (user.balance < 0) throw new Error('Insufficient funds');
  }, { rollbackOnError: true }); // Auto-rollback on throw!
} catch (e) {
  // user.name and user.balance are back to original values
}
```

### Error Boundaries (`Pine.errorBoundary`)
```javascript
Pine.errorBoundary(() => riskyComponentInit(), {
  onError(err) { showFallbackUI(err); }
});
```

### Async Resource Engine 2.0 (`Pine.resource`)
```javascript
const users = Pine.resource('/api/users', { cache: true, ttl: 30000 });
console.log(users.status);  // 'idle' → 'loading' → 'success' | 'error'
console.log(users.data);    // Resolved payload
users.refresh();             // Background refresh (status → 'refreshing')
users.cancel();              // Abort in-flight request via AbortController
users.reset();               // Reset to initial state
```

### First-Class Component Foundation (`Pine.component`)
```javascript
const Card = Pine.component({
  props: {
    title: { type: String, required: true },
    count: { type: Number, default: 0 }
  },
  setup(props) {
    Pine.onMount(() => console.log('Card mounted'));
    Pine.onUnmount(() => console.log('Card removed'));
    return { doubled: props.count * 2 };
  },
  template: (p) => `<div class="card"><h3>${p.title}</h3></div>`
});
const card = Card({ title: 'Hello' });
card.render(document.getElementById('app'));
```

### Web Components Custom Elements (`Pine.define`)
```javascript
Pine.define('pine-counter', {
  props: { start: Number },
  template: (p) => `<button p-data="{ n: ${p.start || 0} }" @click="n++" p-text="n"></button>`
});
// Use anywhere: <pine-counter start="5"></pine-counter>
```

### Testing Harness (`Pine.mount`)
```javascript
const app = Pine.mount('<div p-data="{ count: 0 }"><button @click="count++">+</button><span p-text="count"></span></div>');
await app.click('button');       // Simulate click
app.text('span');                // → '1'
await app.input('input', 'Hi');  // Simulate input
app.unmount();                   // Full cleanup
```

### Expression Compilation Cache (`Pine.cache`)
```javascript
Pine.cache.stats;  // { hits: 142, misses: 23, size: 65 }
Pine.cache.clear(); // Flush all cached compiled expressions
```

### DevTools Timeline Profiler & Memory Inspector
```javascript
Pine.devtools.timeline.mark('component:render', { id: 'UserCard' });
Pine.devtools.timeline.getEvents(); // Timeline event log
Pine.devtools.memory.inspect();     // { activeRoots: 3, cacheEntries: 45 }
```

---

## 🔮 Magic Properties Reference

| Magic | Description | Example Usage |
| :--- | :--- | :--- |
| **`$route`** | Client router instance with `path`, `params`, `push`, `replace` | `$route.push('/user/' + id)` |
| **`$form(init)`** | Unified reactive form model with dirty, reset, submit | `form: $form({ email: '' })` |
| **`$suspense(p)`** | Registers an async Promise in closest `<div p-suspense>` | `$suspense(fetchData())` |
| **`$idb(val, key)`** | Non-blocking IndexedDB persistence | `history: $idb([], 'logs')` |
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
| **`$focus`** | Accessible focus management helper | `$focus.trap($el)` |
| **`$error`** | Captured error object within `p-error` boundary | `<p p-text="$error?.message"></p>` |

---

## 🧪 Automated Testing & Verification

PineJS maintains a comprehensive automated test suite verified on every build via headless Google Chrome:

```bash
# Run headless browser test suite
npm test
```

```
🌲 PineJS Automated Headless Test Runner
   Suites Total:  71
   Suites Passed: 71 (100%)
   Suites Failed: 0
   Tests Total:   71
   Tests Passed:  71 (100%)
   ✨ All test suites passed successfully!
```

---

## 🏷️ Release History

| Version | Codename | Date | Key Highlights |
| :--- | :--- | :--- | :--- |
| **`v1.7.0`** | **Douglas** | 2026-09-15 | **Major Upgrade Release**: Client-Side Micro-Router, Unified Reactive Form Engine, Async Suspense & Skeleton Loader, Remote Component Loader, Zero-DOM SSR Compiler, Shadow DOM Encapsulation, IndexedDB Offline Storage, Chrome DevTools Extension. **Engine Hardening**: Explicit Reactive Scopes (`Pine.scope`), Centralized Scheduler (`Pine.scheduler`), Async Batch Mutations (`Pine.batchAsync`), Transactional State Rollback (`Pine.transaction`), Error Boundaries (`Pine.errorBoundary`), Async Resource Engine 2.0 (`Pine.resource`), Component Foundation with Lifecycles (`Pine.component`, `Pine.onMount`, `Pine.onUnmount`), Web Components Interop (`Pine.define`), Testing Harness (`Pine.mount`), LRU Expression Cache (`Pine.cache`), DevTools Timeline Profiler, Circular Dependency Protection. **71/71 test suites passing (100%)**. |
| **`v1.6.0`** | **Bristlecone** | 2026-09-15 | Dual CDN build targets (`pine.prod.js` & `pine.dev.js`), native `$websocket` and `$sse` realtime engines, global script data resolution (`p-data="alphadata"`), CSP-safe mode (`Pine.csp`), error boundaries (`p-error`), deep `$persist`, headless CI runner. |
| **`v1.5.1`** | **Larch** | 2026-09-15 | Tagged template components (`Pine.html`), form validation (`p-validate`), cross-tab sync (`$broadcast`), native View Transitions (`$viewTransition`), Web Worker signal bridge (`Pine.worker`). |
| **`v1.4.0`** | **Spruce** | 2026-09-15 | Multi-prefix engine (`Pine.prefix`), prefix-free semantic HTML (`state`, `text`, `loop`, `show`), WAAPI timeline orchestrator (`Pine.timeline`). |
| **`v1.3.0`** | **Cedar** | 2026-09-14 | Spring physics animations (`p-animate`), runtime devtools bridge, getter receiver proxy binding. |
| **`v1.2.0`** | **Redwood** | 2026-09-14 | Official TypeScript typings (`dist/pine.d.ts`), `$history` URL sync, `p-hydrate` SSR marker. |
| **`v1.1.0`** | **Sequoia** | 2026-09-14 | Hierarchical Scope Proxy inheritance, `p-modelable` mutex, reactive array auto-sync. |
| **`v1.0.0`** | **Evergreen** | 2026-09-10 | Initial release: fine-grained signals, reactive directives, built-in morphing. |

---

## 📄 License

MIT License © 2026 PineJS Core Team. Open-source and free for commercial and personal use.

---

<p align="center">
  <a href="https://github.com/jins-coder/pine"><strong>⭐ Star on GitHub</strong></a> · 
  <a href="https://github.com/jins-coder/pine/issues">Report Issues</a> · 
  <a href="https://github.com/jins-coder/pine/pulls">Contribute</a>
</p>

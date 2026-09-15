# 🌲 PineJS Architectural Fixations & Enhancements Reference

This document provides a comprehensive technical overview of the architectural enhancements, bug fixes, directive expansions, and lifecycle systems implemented in **PineJS v1.5.1 ("Larch")**.

---

## 📑 Summary of Enhancements

| Area | Feature / Fix | Description |
| :--- | :--- | :--- |
| **DOM Lifecycle** | `MutationObserver` Integration | Auto-initializes injected DOM nodes and auto-cleans unmounted trees. |
| **Lifecycle API** | `Pine.destroyTree(root)` | Public API to teardown scopes, remove listeners, and clean up effects. |
| **FOUC Prevention**| `p-cloak` Style Injection | Automatically injects CSS hiding `[p-cloak]`, `[x-cloak]`, and `[cloak]`. |
| **Conditionals** | `p-else-if` & `p-else` | Sequential condition chains on sibling `<template>` tags. |
| **Template Engine**| Multi-Child Templates | `<template p-if>` and `<template p-for>` support multi-node fragments. |
| **List Rendering** | Custom `:key` in `p-for` | Custom identity keys for optimal DOM reuse and minimal layout thrashing. |
| **Event Modifiers**| Keyboard & Mouse Keys | Added `.ctrl`, `.meta`, `.cmd`, `.shift`, `.alt`, `.left`, `.middle`, `.right`. |
| **Event Modifiers**| Robust `.outside` Logic | Capture-phase visibility detection prevents trigger buttons from closing menus. |
| **Accessibility** | `p-trap` Focus Confinement | WAI-ARIA compliant modal focus trapping with auto-restoration. |
| **Input Masking** | Expanded `p-mask` Tokens | Added support for letters (`a`) and alphanumeric (`*`) alongside digits (`9`). |
| **DOM Morphing** | Form State Sync in `morph` | Preserves live input values, cursor state, and checkboxes during morphs. |
| **Animations** | Promise-like `Pine.timeline` | Added `.add()` chaining and `.then()`, `.catch()`, `.finally()` Promise interface. |
| **Magics** | Resilient `$viewTransition` | Guaranteed fallback execution in headless, inactive, and virtual-time contexts. |
| **Type Definitions**| TypeScript & ESM Exports | Full typing in `dist/pine.d.ts` and module exports in `dist/pine.esm.js`. |

---

## 1. Automatic DOM Lifecycle Management

### MutationObserver Integration
PineJS now automatically tracks DOM tree mutations using a singleton `MutationObserver`:
- **Dynamically Injected HTML**: Whenever nodes are inserted (e.g., via `innerHTML`, `appendChild`, HTMX, Turbo, or AJAX), PineJS automatically scans and initializes all `p-data` components and directives.
- **Dynamic Node Teardown**: When elements are removed from the DOM, all reactive subscriptions, event listeners, interval timers, and signal effects are automatically disposed to guarantee **zero memory leaks**.

### Public Lifecycle Control
```javascript
// Start / Stop auto-observation manually if needed
Pine.startObserver();
Pine.stopObserver();

// Manually teardown a subtree and its reactive effects
Pine.destroyTree(document.getElementById('widget'));
```

---

## 2. Auto-Injected Cloak Styles

PineJS automatically injects the following CSS into `<head>` upon execution:
```css
[p-cloak], [x-cloak], [cloak] {
  display: none !important;
}
```
When elements finish compiling, `p-cloak` is automatically stripped, completely eliminating Flash of Unstyled Content (FOUC) without manual stylesheet inclusion.

---

## 3. Conditional Branching (`p-else` & `p-else-if`)

Full support for sequential condition chains using sibling `<template>` elements:

```html
<div p-data="{ status: 'loading' }">
  <template p-if="status === 'loading'">
    <div class="spinner">Loading...</div>
  </template>

  <template p-else-if="status === 'error'">
    <div class="alert alert-danger">An error occurred.</div>
  </template>

  <template p-else>
    <div class="content">Content loaded successfully!</div>
  </template>
</div>
```

Also supports prefix-free and Alpine aliases:
- `x-else-if`, `else-if`, `elseif`
- `x-else`, `else`

---

## 4. Multi-Child Template Fragments

Previously, `<template p-if>` and `<template p-for>` only rendered single child elements. PineJS now supports multi-root template contents:

```html
<template p-if="showDetails">
  <h4>Item Overview</h4>
  <p>Detailed description line 1.</p>
  <p>Detailed description line 2.</p>
</template>
```

All sibling nodes are tracked via internal boundary markers and cleanly inserted or removed as an atomic unit.

---

## 5. Explicit Key Evaluation in `p-for`

List rendering now evaluates custom item identity expressions (`:key` or `p-bind:key`):

```html
<template p-for="item in items" :key="item.id">
  <li class="item-row">
    <span p-text="item.title"></span>
  </li>
</template>
```

When arrays are sorted, filtered, or reordered, PineJS reorders existing DOM nodes rather than recreating them from scratch.

---

## 6. Comprehensive Event Modifiers (`p-on` / `@event`)

### Keyboard & Modifier Keys
- `.ctrl` — Fires only if <kbd>Control</kbd> is pressed.
- `.meta` / `.cmd` — Fires only if <kbd>Command</kbd> / <kbd>Meta</kbd> / <kbd>Windows</kbd> key is pressed.
- `.shift` — Fires only if <kbd>Shift</kbd> is pressed.
- `.alt` — Fires only if <kbd>Alt</kbd> / <kbd>Option</kbd> is pressed.

```html
<input @keydown.ctrl.enter="sendMessage()" placeholder="Ctrl + Enter to send" />
<input @keydown.cmd.k.prevent="openSearchModal()" />
```

### Mouse Button Modifiers
- `.left` — Triggers only on primary button (button 0).
- `.middle` — Triggers only on auxiliary / scroll-wheel button (button 1).
- `.right` — Triggers only on secondary button (button 2).

```html
<div @mousedown.middle="openInNewTab()" @contextmenu.prevent="showContextMenu()"></div>
```

### Bulletproof `.outside` Click Handling
Previous implementations suffered from race conditions where the click event that toggled an element open bubbled to `document` and immediately triggered the `.outside` click handler.

PineJS resolves this with **capture-phase visibility detection**:
- At the moment the click starts on `document` (capture phase), Pine checks if the target element was already visible.
- If the element was hidden when the click initiated, the click is recognized as the toggle action and is ignored.
- Only subsequent clicks while the element is already open trigger the outside handler.

---

## 7. Declarative Focus Trapping (`p-trap`)

Conforms to WAI-ARIA modal dialogue accessibility standards:

```html
<div p-data="{ modalOpen: false }">
  <button @click="modalOpen = true">Open Modal</button>

  <div id="dialog" p-show="modalOpen" p-trap="modalOpen" role="dialog" aria-modal="true">
    <h2>Accessible Modal</h2>
    <input type="text" placeholder="First focusable element" />
    <button @click="modalOpen = false">Close</button>
  </div>
</div>
```

Features:
- Confines <kbd>Tab</kbd> and <kbd>Shift+Tab</kbd> within the element boundaries.
- Automatically focuses the first tabbable input when mounted.
- Automatically restores focus to the previously active element when unmounted.

---

## 8. Enhanced Input Masking (`p-mask`)

`p-mask` now supports three distinct formatting tokens:
- `9` — Numeric digit (`0-9`).
- `a` — Alphabetical character (`a-z`, `A-Z`).
- `*` — Alphanumeric character (`0-9`, `a-z`, `A-Z`).

```html
<!-- Credit Card -->
<input p-mask="9999 9999 9999 9999" placeholder="4000 1234 5678 9010" />

<!-- License Plate -->
<input p-mask="aaa-9999" placeholder="ABC-1234" />

<!-- Promo / Coupon Code -->
<input p-mask="****-****" placeholder="PROMO-2026" />
```

---

## 9. Form State Synchronization in `Pine.morph()`

`Pine.morph(targetEl, newHtml)` performs intelligent virtual-DOM style morphing directly on live elements:
- Preserves active user text input without resetting to server defaults.
- Preserves checkbox and radio button checked states unless HTML attributes explicitly diverge.
- Automatically mounts newly appended DOM fragments through `initTree`.

```javascript
Pine.morph(container, `
  <div id="form-root">
    <input type="text" id="username" />
    <input type="checkbox" id="terms" />
    <div class="newly-added-section" p-data="{ rating: 5 }">
      <span p-text="rating"></span>
    </div>
  </div>
`);
```

---

## 10. Promise-Ready Timeline Orchestrator (`Pine.timeline`)

```javascript
const tl = Pine.timeline()
  .add('#modal', [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 250 })
  .add('#modal-content', [{ transform: 'translateY(20px)' }, { transform: 'translateY(0)' }], { duration: 200 }, '-=100');

// Playback controls
tl.play();
tl.pause();
tl.reverse();

// Promise interface
await tl;
console.log('Animation completed');
```

---

## 11. Resilient View Transitions (`$viewTransition`)

Wraps `document.startViewTransition()` with guaranteed asynchronous fallback:

```html
<div p-data="{ view: 'list' }">
  <button @click="$viewTransition(() => view = 'grid')">Grid View</button>
  <div p-show="view === 'list'">...</div>
  <div p-show="view === 'grid'">...</div>
</div>
```

---

## 12. Verification & Test Suite

The comprehensive test suite in `tests/test-suite.html` verifies all 42 feature units across:
1. **Signals Primitive & Computed Reactivity** (peek, memoization, batching)
2. **Core Directives** (`p-data`, `p-bind`, `p-on`, `p-model`, `p-if`, `p-else`, `p-for`, `p-mask`, `p-trap`, `p-cloak`)
3. **Advanced Magics** (`$refs`, `$dispatch`, `$store`, `$history`, `$broadcast`, `$viewTransition`, `$worker`, `$errors`)
4. **Plugins & Integrations** (`Pine.morph`, `Pine.timeline`, `Pine.html`, `Pine.devtools`)
5. **Alpine.js Chameleon Compatibility** (`x-data`, `x-show`, `x-text`, `x-for`, `@click.outside`)

**Result:** `42/42 Passed (100%)` in Headless Chromium.

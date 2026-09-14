/**
 * PineJS Documentation Site Interactive Script & Complete Index
 */

const docIndex = [
  // Start & Upgrading
  { id: 'start-here', title: 'Start Here', category: 'Start', desc: 'Introduction and getting started with PineJS' },
  { id: 'upgrade-guide', title: 'Upgrade From Alpine.js / V2', category: 'Start', desc: 'Seamless 1:1 migration guide from Alpine.js to PineJS' },
  { id: 'releases', title: 'Releases & Version History', category: 'Start', desc: 'Complete changelog, release codenames, and version list' },

  // Essentials
  { id: 'essentials-installation', title: 'Installation', category: 'Essentials', desc: 'Include PineJS via CDN script tag, npm, or ES Module' },
  { id: 'essentials-state', title: 'State Management', category: 'Essentials', desc: 'Declare local and global reactive state with signals' },
  { id: 'essentials-templating', title: 'Templating', category: 'Essentials', desc: 'Conditional rendering, loops, text, and html directives' },
  { id: 'essentials-events', title: 'Events', category: 'Essentials', desc: 'Handling user input, keyboard shortcuts, and modifiers' },
  { id: 'essentials-lifecycle', title: 'Lifecycle', category: 'Essentials', desc: 'Initialization, updates, and cleanup lifecycles' },

  // UI Components
  { id: 'component-dropdown', title: 'Dropdown Component', category: 'UI Components', desc: 'Accessible dropdown menu with click outside and escape key' },
  { id: 'component-modal', title: 'Modal Dialog Component', category: 'UI Components', desc: 'Dialog overlay with teleport, focus trap, and background blur' },
  { id: 'component-tabs', title: 'Tabs & Accordion', category: 'UI Components', desc: 'Tab switching and smooth collapsible accordion items' },

  // Directives
  { id: 'p-data', title: 'p-data', category: 'Directives', desc: 'Declare a component root and initialize its reactive state' },
  { id: 'p-init', title: 'p-init', category: 'Directives', desc: 'Run code when an element is mounted and initialized' },
  { id: 'p-show', title: 'p-show', category: 'Directives', desc: 'Toggle visibility (display: none) with smooth transitions' },
  { id: 'p-bind', title: 'p-bind (:)', category: 'Directives', desc: 'Bind attributes, classes, and styles reactively' },
  { id: 'p-on', title: 'p-on (@)', category: 'Directives', desc: 'Listen to DOM events with powerful modifier chains' },
  { id: 'p-text', title: 'p-text', category: 'Directives', desc: 'Set atomic textContent reactively' },
  { id: 'p-html', title: 'p-html', category: 'Directives', desc: 'Set innerHTML reactively' },
  { id: 'p-model', title: 'p-model', category: 'Directives', desc: 'Two-way binding for input, select, checkbox, and radio' },
  { id: 'p-modelable', title: 'p-modelable', category: 'Directives', desc: 'Expose internal properties to parent p-model directives' },
  { id: 'p-for', title: 'p-for', category: 'Directives', desc: 'Keyed list rendering on <template> tags' },
  { id: 'p-transition', title: 'p-transition', category: 'Directives', desc: 'Smooth CSS enter and leave transitions and presets' },
  { id: 'p-effect', title: 'p-effect', category: 'Directives', desc: 'Execute reactive side-effects when dependencies change' },
  { id: 'p-ignore', title: 'p-ignore', category: 'Directives', desc: 'Skip compilation and DOM scanning on specific subtrees' },
  { id: 'p-ref', title: 'p-ref', category: 'Directives', desc: 'Register raw DOM element references into $refs' },
  { id: 'p-cloak', title: 'p-cloak', category: 'Directives', desc: 'Hide HTML elements until PineJS initializes' },
  { id: 'p-teleport', title: 'p-teleport', category: 'Directives', desc: 'Teleport template content to external DOM targets' },
  { id: 'p-if', title: 'p-if', category: 'Directives', desc: 'Conditionally mount and unmount elements on <template> tags' },
  { id: 'p-id', title: 'p-id', category: 'Directives', desc: 'Declare scoped unique IDs for form accessibility' },

  // Magics
  { id: 'magic-el', title: '$el', category: 'Magics', desc: 'Access current DOM element' },
  { id: 'magic-refs', title: '$refs', category: 'Magics', desc: 'Access registered elements with p-ref' },
  { id: 'magic-store', title: '$store', category: 'Magics', desc: 'Access global shared reactive state' },
  { id: 'magic-watch', title: '$watch', category: 'Magics', desc: 'Watch reactive signals or properties and run callbacks' },
  { id: 'magic-dispatch', title: '$dispatch', category: 'Magics', desc: 'Dispatch custom bubbling DOM events' },
  { id: 'magic-nexttick', title: '$nextTick', category: 'Magics', desc: 'Run callback after pending DOM updates finish' },
  { id: 'magic-root', title: '$root', category: 'Magics', desc: 'Access component root DOM element' },
  { id: 'magic-data', title: '$data', category: 'Magics', desc: 'Access current reactive component scope' },
  { id: 'magic-id', title: '$id', category: 'Magics', desc: 'Generate unique accessible HTML element IDs' },
  { id: 'magic-signal', title: '$signal', category: 'Magics', desc: 'Create and consume raw Signal primitives' },
  { id: 'magic-persist', title: '$persist', category: 'Magics', desc: 'Persist state to localStorage with reactive updates' },
  { id: 'magic-fetch', title: '$fetch', category: 'Magics', desc: 'Reactive HTTP fetch client with loading/data states' },
  { id: 'magic-intersect', title: '$intersect', category: 'Magics', desc: 'IntersectionObserver viewport visibility helper' },

  // Globals
  { id: 'global-data', title: 'Pine.data()', category: 'Globals', desc: 'Define reusable component factories' },
  { id: 'global-store', title: 'Pine.store()', category: 'Globals', desc: 'Create global reactive data stores' },
  { id: 'global-bind', title: 'Pine.bind()', category: 'Globals', desc: 'Bundle reusable attributes and event listeners' },
  { id: 'global-directive', title: 'Pine.directive()', category: 'Globals', desc: 'Register custom directives' },
  { id: 'global-magic', title: 'Pine.magic()', category: 'Globals', desc: 'Register custom magic properties' },
  { id: 'global-plugin', title: 'Pine.plugin()', category: 'Globals', desc: 'Register framework extensions and plugins' },
  { id: 'global-start', title: 'Pine.start()', category: 'Globals', desc: 'Boot and initialize PineJS on document' },

  // Plugins
  { id: 'plugin-mask', title: 'Mask Plugin (p-mask)', category: 'Plugins', desc: 'Format and restrict input fields (phone, date, currency)' },
  { id: 'plugin-intersect', title: 'Intersect Plugin ($intersect)', category: 'Plugins', desc: 'Lazy load content when visible on screen' },
  { id: 'plugin-resize', title: 'Resize Plugin (p-resize)', category: 'Plugins', desc: 'Observe element dimension changes with ResizeObserver' },
  { id: 'plugin-persist', title: 'Persist Plugin ($persist)', category: 'Plugins', desc: 'Seamless localStorage state synchronization' },
  { id: 'plugin-focus', title: 'Focus Plugin ($focus, p-trap)', category: 'Plugins', desc: 'Manage keyboard focus and focus trapping' },
  { id: 'plugin-collapse', title: 'Collapse Plugin (p-collapse)', category: 'Plugins', desc: 'Smooth accordion height animations' },
  { id: 'plugin-anchor', title: 'Anchor Plugin (p-anchor)', category: 'Plugins', desc: 'Position floating elements relative to anchors' },
  { id: 'plugin-morph', title: 'Morph Plugin (Pine.morph)', category: 'Plugins', desc: 'Morph and patch DOM trees with zero layout disruption' },
  { id: 'plugin-sort', title: 'Sort Plugin (p-sort)', category: 'Plugins', desc: 'Drag-and-drop sortable list reordering' },

  // Advanced
  { id: 'advanced-csp', title: 'Content Security Policy (CSP)', category: 'Advanced', desc: 'Running PineJS in strict CSP environments without unsafe-eval' },
  { id: 'advanced-reactivity', title: 'Reactivity & Signals Deep-Dive', category: 'Advanced', desc: 'Fine-grained signal graph vs virtual DOM vs microtask loops' },
  { id: 'advanced-extending', title: 'Extending PineJS', category: 'Advanced', desc: 'Authoring third-party directives, plugins, and custom magics' },
  { id: 'advanced-async', title: 'Async Handling', category: 'Advanced', desc: 'Managing async functions, promises, and network lifecycles' }
];

document.addEventListener('DOMContentLoaded', () => {
  // Navigation handling
  function navigateTo(targetId) {
    const sections = document.querySelectorAll('.doc-section');
    const navLinks = document.querySelectorAll('.sidebar-item a');
    let matched = false;

    sections.forEach((sec) => {
      if (sec.id === targetId) {
        sec.classList.add('active');
        matched = true;
      } else {
        sec.classList.remove('active');
      }
    });

    if (!matched && sections.length > 0) {
      sections[0].classList.add('active');
      targetId = sections[0].id;
    }

    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === `#${targetId}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (hash) navigateTo(hash);
  });

  const initialHash = window.location.hash.slice(1) || 'start-here';
  navigateTo(initialHash);

  // Theme switcher (defaults to light)
  const themeToggleBtn = document.getElementById('theme-toggle');
  const storedTheme = localStorage.getItem('pine_doc_theme') || 'light';
  document.documentElement.setAttribute('data-theme', storedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.innerHTML = storedTheme === 'light' ? '🌙' : '☀️';
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('pine_doc_theme', next);
      themeToggleBtn.innerHTML = next === 'light' ? '🌙' : '☀️';
    });
  }

  // Copy Code Buttons
  document.querySelectorAll('.code-copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pre = btn.closest('.code-box').querySelector('pre');
      if (pre) {
        navigator.clipboard.writeText(pre.textContent).then(() => {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          btn.style.borderColor = 'var(--accent-pine)';
          setTimeout(() => {
            btn.textContent = original;
            btn.style.borderColor = '';
          }, 2000);
        });
      }
    });
  });

  // Search Modal (Ctrl/Cmd + K)
  const searchModalBackdrop = document.getElementById('search-modal-backdrop');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const searchTrigger = document.getElementById('search-trigger');

  function openSearch() {
    searchModalBackdrop.classList.add('open');
    searchInput.value = '';
    searchInput.focus();
    renderSearchResults('');
  }

  function closeSearch() {
    searchModalBackdrop.classList.remove('open');
  }

  if (searchTrigger) {
    searchTrigger.addEventListener('click', openSearch);
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && searchModalBackdrop.classList.contains('open')) {
      closeSearch();
    }
  });

  searchModalBackdrop.addEventListener('click', (e) => {
    if (e.target === searchModalBackdrop) {
      closeSearch();
    }
  });

  function renderSearchResults(query) {
    const q = query.toLowerCase().trim();
    const filtered = docIndex.filter((item) => {
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      searchResults.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No documentation matching "${query}"</div>`;
      return;
    }

    searchResults.innerHTML = filtered
      .map(
        (item) => `
        <div class="search-result-item" data-id="${item.id}">
          <div class="search-result-category">${item.category}</div>
          <div class="search-result-title">${item.title}</div>
          <div class="search-result-desc">${item.desc}</div>
        </div>
      `
      )
      .join('');

    searchResults.querySelectorAll('.search-result-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        window.location.hash = id;
        navigateTo(id);
        closeSearch();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderSearchResults(e.target.value);
    });
  }
});

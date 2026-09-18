/* Apex Logistics — shared client behaviour.
   Everything here is progressive enhancement: the pages work without it. */
(function () {
  'use strict';

  var root = document.documentElement;
  var STORE_KEY = 'apex-theme';

  /* ---- Theme ------------------------------------------------------------ */
  // The initial theme is applied by an inline script in the page head so there
  // is no flash; here we only wire up the toggle and keep storage in sync.
  function readStoredTheme() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function storeTheme(value) {
    try {
      if (value) localStorage.setItem(STORE_KEY, value);
      else localStorage.removeItem(STORE_KEY);
    } catch (e) { /* private mode / blocked storage — theme just won't persist */ }
  }
  function currentTheme() {
    var forced = root.getAttribute('data-theme');
    if (forced) return forced;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function initTheme() {
    var toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle) return;

    var sync = function () {
      var isDark = currentTheme() === 'dark';
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
      toggle.title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    };

    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      storeTheme(next);
      sync();
    });

    // Follow the OS while the user has not made an explicit choice.
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (!readStoredTheme()) sync(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    sync();
  }

  /* ---- Mobile navigation ------------------------------------------------ */
  function initNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('primary-nav');
    if (!toggle || !nav) return;

    var setOpen = function (open) {
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      var icon = toggle.querySelector('i');
      if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    };

    toggle.addEventListener('click', function () {
      setOpen(!document.body.classList.contains('nav-open'));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---- Admin sidebar ---------------------------------------------------- */
  function initSidebar() {
    var open = document.getElementById('sidebar-toggle');
    var close = document.getElementById('sidebar-close');
    var overlay = document.getElementById('sidebar-overlay');
    var sidebar = document.getElementById('admin-sidebar');
    if (!open || !sidebar) return;

    var setOpen = function (isOpen) {
      document.body.classList.toggle('sidebar-open', isOpen);
      sidebar.setAttribute('aria-hidden', String(!isOpen));
      open.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        var first = sidebar.querySelector('a, button');
        if (first) first.focus();
      } else {
        open.focus();
      }
    };

    open.addEventListener('click', function () { setOpen(true); });
    if (close) close.addEventListener('click', function () { setOpen(false); });
    if (overlay) overlay.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) setOpen(false);
    });
  }

  /* ---- Dropdown menus --------------------------------------------------- */
  function initDropdowns() {
    var triggers = document.querySelectorAll('[data-dropdown]');
    if (!triggers.length) return;

    var closeAll = function (except) {
      document.querySelectorAll('.dropdown.is-open').forEach(function (menu) {
        if (menu === except) return;
        menu.classList.remove('is-open');
        var owner = document.querySelector('[data-dropdown="' + menu.id + '"]');
        if (owner) owner.setAttribute('aria-expanded', 'false');
      });
    };

    triggers.forEach(function (trigger) {
      var menu = document.getElementById(trigger.getAttribute('data-dropdown'));
      if (!menu) return;
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = !menu.classList.contains('is-open');
        closeAll(menu);
        menu.classList.toggle('is-open', willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
      });
    });

    document.addEventListener('click', function () { closeAll(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  /* ---- Toasts ----------------------------------------------------------- */
  function initToasts() {
    var stack = document.querySelector('.toast-stack');
    if (!stack) return;

    var dismiss = function (toast) {
      toast.classList.add('is-leaving');
      window.setTimeout(function () { toast.remove(); }, 240);
    };

    stack.querySelectorAll('.toast').forEach(function (toast) {
      var btn = toast.querySelector('.toast__close');
      if (btn) btn.addEventListener('click', function () { dismiss(toast); });
      // Errors stay until dismissed; everything else fades out on its own.
      if (!toast.classList.contains('alert--error')) {
        window.setTimeout(function () { if (toast.isConnected) dismiss(toast); }, 6000);
      }
    });
  }

  /* ---- Destructive actions --------------------------------------------- */
  // Any form carrying data-confirm asks before it submits. Destructive routes
  // are POST-only on the server, so this is the confirmation layer on top.
  function initConfirms() {
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      var message = form.getAttribute('data-confirm');
      if (message && !window.confirm(message)) {
        e.preventDefault();
      }
    });
  }

  /* ---- Scroll reveal ---------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---- Filter forms ----------------------------------------------------- */
  // Selects inside a filter bar submit immediately; the text input waits for
  // a pause in typing so we are not firing a request per keystroke.
  function initFilters() {
    document.querySelectorAll('form.filters').forEach(function (form) {
      form.querySelectorAll('select[data-autosubmit]').forEach(function (select) {
        select.addEventListener('change', function () { form.submit(); });
      });

      var search = form.querySelector('input[data-autosubmit]');
      if (search) {
        var timer = null;
        search.addEventListener('input', function () {
          window.clearTimeout(timer);
          timer = window.setTimeout(function () { form.submit(); }, 450);
        });
      }
    });
  }

  /* ---- Chart.js defaults ------------------------------------------------ */
  // Charts read their colours from the stylesheet so they follow the theme.
  window.apexChartTheme = function () {
    var styles = getComputedStyle(root);
    var token = function (name, fallback) {
      return (styles.getPropertyValue(name) || fallback).trim();
    };
    return {
      text: token('--text-muted', '#7d736d'),
      grid: token('--border', '#e6e3e0'),
      surface: token('--surface', '#ffffff'),
      series: [1, 2, 3, 4, 5, 6, 7].map(function (n) {
        return token('--chart-' + n, '#a05436');
      })
    };
  };

  function initCharts() {
    if (typeof window.Chart === 'undefined') return;
    var theme = window.apexChartTheme();
    window.Chart.defaults.font.family =
      "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";
    window.Chart.defaults.color = theme.text;
    window.Chart.defaults.borderColor = theme.grid;
    window.Chart.defaults.plugins.legend.labels.usePointStyle = true;
    window.Chart.defaults.plugins.legend.labels.boxWidth = 8;
    window.Chart.defaults.plugins.legend.labels.padding = 14;
  }

  /* ---- Boot ------------------------------------------------------------- */
  root.classList.add('js');

  function boot() {
    initTheme();
    initNav();
    initSidebar();
    initDropdowns();
    initToasts();
    initConfirms();
    initReveal();
    initFilters();
    initCharts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

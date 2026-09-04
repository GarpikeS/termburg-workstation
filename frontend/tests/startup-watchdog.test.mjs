import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const watchdogScript = readFileSync(new URL('../public/startup-watchdog-v1.js', import.meta.url), 'utf8');

function createHarness({ appReady = false, online = true } = {}) {
  const elements = new Map();
  const windowListeners = new Map();
  let observerCallback = null;
  let timerCallback = null;
  let timerDelay = null;
  let timerCleared = false;
  let reloadCount = 0;
  let routeKey = 'route-1';
  let readyKey = appReady ? routeKey : null;

  const document = {
    activeElement: null,
    body: { style: { overflow: '' } },
    getElementById(id) {
      return elements.get(id) ?? null;
    },
  };

  class FakeElement {
    constructor(id) {
      this.id = id;
      this.hidden = id === 'startup-help';
      this.inert = false;
      this.isConnected = true;
      this.attributes = new Map();
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    click() {
      this.listeners.get('click')?.({});
    }

    focus() {
      document.activeElement = this;
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }

    querySelector(selector) {
      if (this.id !== 'root') return null;
      if (selector === '[data-termburg-route-key]') {
        return {
          getAttribute(name) {
            return name === 'data-termburg-route-key' ? routeKey : null;
          },
        };
      }
      if (selector === '[data-termburg-app-ready]' && readyKey !== null) {
        return {
          getAttribute(name) {
            return name === 'data-termburg-app-ready' ? readyKey : null;
          },
        };
      }
      return null;
    }
  }

  [
    'root',
    'startup-help',
    'startup-help-description',
    'startup-help-hint',
    'startup-help-retry',
    'startup-help-wait',
    'startup-help-close',
  ]
    .forEach(id => elements.set(id, new FakeElement(id)));
  document.activeElement = document.body;

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {
      observerCallback = this.callback;
    }

    disconnect() {
      observerCallback = null;
    }
  }

  const window = {
    history: {
      pushState() {},
      replaceState() {},
    },
    location: {
      reload() {
        reloadCount += 1;
      },
    },
    setTimeout(callback, delay) {
      timerCallback = callback;
      timerDelay = delay;
      timerCleared = false;
      return 1;
    },
    clearTimeout() {
      timerCleared = true;
    },
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    removeEventListener(type) {
      windowListeners.delete(type);
    },
  };

  vm.runInNewContext(watchdogScript, {
    document,
    window,
    MutationObserver: FakeMutationObserver,
    navigator: { onLine: online },
  });

  return {
    document,
    dialog: elements.get('startup-help'),
    root: elements.get('root'),
    description: elements.get('startup-help-description'),
    hint: elements.get('startup-help-hint'),
    retryButton: elements.get('startup-help-retry'),
    waitButton: elements.get('startup-help-wait'),
    get reloadCount() { return reloadCount; },
    get timerDelay() { return timerDelay; },
    runTimer() {
      if (!timerCleared) timerCallback?.();
    },
    markReady() {
      appReady = true;
      readyKey = routeKey;
      observerCallback?.();
    },
    markRouteLoading() {
      routeKey = `route-${Number(routeKey.split('-')[1]) + 1}`;
      appReady = false;
      observerCallback?.();
    },
    startNavigation() {
      window.history.pushState({}, '', '/next-route');
    },
    fireWindowEvent(type, event) {
      windowListeners.get(type)?.(event);
    },
  };
}

test('loads the non-blocking VPN help before the application bundle with accessible dialog markup', () => {
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /Если у вас включён VPN, отключите его/);
  assert.match(html, /Попробовать снова/);
  const watchdogTag = '<script src="/startup-watchdog-v1.js" async data-startup-watchdog>';
  assert.match(html, /src="\/startup-watchdog-v1\.js" async/);
  const watchdogIndex = html.indexOf(watchdogTag);
  const applicationIndex = html.indexOf('<script type="module"');
  assert.notEqual(watchdogIndex, -1, 'watchdog script tag must exist');
  assert.notEqual(applicationIndex, -1, 'application module tag must exist');
  assert.ok(
    watchdogIndex < applicationIndex,
    'watchdog must be declared before the application module',
  );
});

test('shows the VPN help after eight seconds and reloads on request', () => {
  const harness = createHarness();
  assert.equal(harness.timerDelay, 8000);

  harness.runTimer();

  assert.equal(harness.dialog.hidden, false);
  assert.equal(harness.root.inert, true);
  assert.equal(harness.root.getAttribute('aria-hidden'), 'true');
  assert.equal(harness.document.activeElement, harness.retryButton);

  harness.retryButton.click();
  assert.equal(harness.reloadCount, 1);
});

test('cancels the warning when the application becomes ready in time', () => {
  const harness = createHarness();

  harness.markReady();
  harness.runTimer();

  assert.equal(harness.dialog.hidden, true);
});

test('stays quiet when the async watchdog loads after the application is ready', () => {
  const harness = createHarness({ appReady: true });

  harness.runTimer();

  assert.equal(harness.dialog.hidden, true);
});

test('lets the user continue waiting and restores the application', () => {
  const harness = createHarness();
  harness.runTimer();
  harness.waitButton.click();

  assert.equal(harness.dialog.hidden, true);
  assert.equal(harness.root.inert, false);
  assert.equal(harness.root.getAttribute('aria-hidden'), null);
  assert.equal(harness.document.body.style.overflow, '');
});

test('hides an already visible warning after a late successful load', () => {
  const harness = createHarness();
  harness.runTimer();
  harness.markReady();

  assert.equal(harness.dialog.hidden, true);
  assert.equal(harness.root.inert, false);
});

test('warns about a later failed lazy chunk after startup completed', () => {
  const harness = createHarness({ appReady: true });
  let prevented = false;

  harness.fireWindowEvent('vite:preloadError', {
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(harness.dialog.hidden, false);
});

test('starts a fresh timeout before a later game route commits', () => {
  const harness = createHarness({ appReady: true });

  harness.startNavigation();
  harness.runTimer();

  assert.equal(harness.timerDelay, 8000);
  assert.equal(harness.dialog.hidden, false);
});

test('keeps a critical resource warning open when React later becomes ready', () => {
  const harness = createHarness();

  harness.fireWindowEvent('error', { target: { tagName: 'LINK', rel: 'stylesheet' } });
  harness.markReady();

  assert.equal(harness.dialog.hidden, false);
});

test('shows immediately for a failed script but ignores a failed image', () => {
  const harness = createHarness();
  harness.fireWindowEvent('error', { target: { tagName: 'IMG' } });
  assert.equal(harness.dialog.hidden, true);

  harness.fireWindowEvent('error', { target: { tagName: 'SCRIPT' } });
  assert.equal(harness.dialog.hidden, false);
});

test('uses an internet-specific message when the browser is offline', () => {
  const harness = createHarness({ online: false });
  harness.runTimer();

  assert.equal(harness.description.textContent, 'Нет подключения к интернету.');
  assert.equal(harness.hint.textContent, 'Подключитесь к сети и затем попробуйте снова.');
});

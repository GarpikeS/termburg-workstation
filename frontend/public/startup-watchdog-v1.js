(() => {
  'use strict';

  const WAIT_MS = 8000;
  const root = document.getElementById('root');
  const dialog = document.getElementById('startup-help');
  const description = document.getElementById('startup-help-description');
  const hint = document.getElementById('startup-help-hint');
  const retryButton = document.getElementById('startup-help-retry');
  const waitButton = document.getElementById('startup-help-wait');
  const closeButton = document.getElementById('startup-help-close');
  if (!root || !dialog || !description || !hint || !retryButton || !waitButton || !closeButton) return;

  const focusable = [closeButton, retryButton, waitButton];
  const defaultDescription = description.textContent;
  const defaultHint = hint.textContent;
  const previousOverflow = document.body.style.overflow;
  const previousAriaHidden = root.getAttribute('aria-hidden');
  const previousInert = root.inert;
  let previousActiveElement = null;
  let isOpen = false;
  let dismissed = false;
  let criticalFailureSeen = false;
  let timeoutId = null;
  let navigationPending = false;
  let routeKeyBeforeNavigation = null;

  const browserHistory = window.history;
  const originalPushState = browserHistory?.pushState;
  const originalReplaceState = browserHistory?.replaceState;
  let patchedPushState = null;
  let patchedReplaceState = null;

  function currentRouteKey() {
    return root.querySelector('[data-termburg-route-key]')
      ?.getAttribute('data-termburg-route-key') ?? null;
  }

  function appIsReady() {
    const readyMarker = root.querySelector('[data-termburg-app-ready]');
    if (!readyMarker) return false;
    const routeKey = currentRouteKey();
    if (routeKey === null) return true;
    return readyMarker.getAttribute('data-termburg-app-ready')
      === routeKey;
  }

  function restoreRoot() {
    document.body.style.overflow = previousOverflow;
    if (previousAriaHidden === null) root.removeAttribute('aria-hidden');
    else root.setAttribute('aria-hidden', previousAriaHidden);
    if ('inert' in root) root.inert = previousInert;
  }

  function updateConnectionMessage() {
    if (navigator.onLine === false) {
      description.textContent = 'Нет подключения к интернету.';
      hint.textContent = 'Подключитесь к сети и затем попробуйте снова.';
      return;
    }
    description.textContent = defaultDescription;
    hint.textContent = defaultHint;
  }

  function onKeyDown(event) {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      dismiss();
      return;
    }
    if (event.key !== 'Tab') return;
    const currentIndex = focusable.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex].focus();
  }

  function showDialog({ ignoreReady = false } = {}) {
    if (dismissed || isOpen || (!ignoreReady && appIsReady())) return;
    updateConnectionMessage();
    previousActiveElement = document.activeElement;
    isOpen = true;
    dialog.hidden = false;
    document.body.style.overflow = 'hidden';
    if ('inert' in root) root.inert = true;
    retryButton.focus();
    root.setAttribute('aria-hidden', 'true');
    window.addEventListener('keydown', onKeyDown);
  }

  function hideDialog() {
    if (!isOpen) return;
    isOpen = false;
    dialog.hidden = true;
    restoreRoot();
    window.removeEventListener('keydown', onKeyDown);
    if (previousActiveElement && previousActiveElement.isConnected
      && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    }
  }

  function onResourceError(event) {
    const target = event.target;
    const tagName = typeof target?.tagName === 'string' ? target.tagName.toUpperCase() : '';
    const criticalResourceFailed = tagName === 'SCRIPT'
      || (tagName === 'LINK' && target.rel === 'stylesheet');
    if (criticalResourceFailed) handleCriticalFailure();
  }

  function onPreloadError(event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    handleCriticalFailure();
  }

  function clearWatchTimeout() {
    if (timeoutId === null) return;
    window.clearTimeout(timeoutId);
    timeoutId = null;
  }

  function armWatchTimeout({ ignoreReady = false } = {}) {
    if (dismissed || isOpen || timeoutId !== null || (!ignoreReady && appIsReady())) return;
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      showDialog({ ignoreReady });
    }, WAIT_MS);
  }

  function observeUntilReady() {
    observer.disconnect();
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-termburg-app-ready', 'data-termburg-route-key'],
      childList: true,
      subtree: true,
    });
  }

  function observeRouteChanges() {
    observer.disconnect();
    const routeHost = root.querySelector('[data-termburg-route-key]');
    if (routeHost) {
      observer.observe(routeHost, {
        attributes: true,
        attributeFilter: ['data-termburg-route-key'],
      });
      return;
    }
    observeUntilReady();
  }

  function reconcileLoadingState() {
    if (navigationPending) {
      const routeKey = currentRouteKey();
      if (routeKey === routeKeyBeforeNavigation) {
        armWatchTimeout({ ignoreReady: true });
        observeUntilReady();
        return;
      }
      navigationPending = false;
    }
    if (appIsReady()) {
      clearWatchTimeout();
      if (!criticalFailureSeen) hideDialog();
      observeRouteChanges();
      return;
    }
    armWatchTimeout();
    observeUntilReady();
  }

  function beginNavigationWatch() {
    if (dismissed) return;
    const alreadyWaiting = !appIsReady() && timeoutId !== null;
    navigationPending = true;
    routeKeyBeforeNavigation = currentRouteKey();
    if (!alreadyWaiting) {
      clearWatchTimeout();
      armWatchTimeout({ ignoreReady: true });
    }
    observeUntilReady();
  }

  function patchHistoryMethod(method) {
    return function patchedHistoryMethod(...args) {
      const result = method.apply(this, args);
      beginNavigationWatch();
      return result;
    };
  }

  function installNavigationWatch() {
    if (!browserHistory) return;
    if (typeof originalPushState === 'function') {
      patchedPushState = patchHistoryMethod(originalPushState);
      browserHistory.pushState = patchedPushState;
    }
    if (typeof originalReplaceState === 'function') {
      patchedReplaceState = patchHistoryMethod(originalReplaceState);
      browserHistory.replaceState = patchedReplaceState;
    }
    window.addEventListener('popstate', beginNavigationWatch);
  }

  function removeNavigationWatch() {
    window.removeEventListener('popstate', beginNavigationWatch);
    if (!browserHistory) return;
    if (patchedPushState && browserHistory.pushState === patchedPushState) {
      browserHistory.pushState = originalPushState;
    }
    if (patchedReplaceState && browserHistory.replaceState === patchedReplaceState) {
      browserHistory.replaceState = originalReplaceState;
    }
  }

  function handleCriticalFailure() {
    criticalFailureSeen = true;
    clearWatchTimeout();
    showDialog({ ignoreReady: true });
  }

  function dismiss() {
    dismissed = true;
    clearWatchTimeout();
    observer.disconnect();
    window.removeEventListener('vite:preloadError', onPreloadError);
    window.removeEventListener('error', onResourceError, true);
    removeNavigationWatch();
    hideDialog();
  }

  const observer = new MutationObserver(reconcileLoadingState);
  retryButton.addEventListener('click', () => window.location.reload());
  waitButton.addEventListener('click', dismiss);
  closeButton.addEventListener('click', dismiss);
  window.addEventListener('vite:preloadError', onPreloadError);
  window.addEventListener('error', onResourceError, true);
  installNavigationWatch();
  observeUntilReady();
  reconcileLoadingState();
})();

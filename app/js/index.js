'use strict';

const applyTranslations = async () => {
  const config = await window.api.getConfig();
  const language = config.LANGUAGE || 'en';
  // i18n module is loaded from global script
  if (window.i18n) {
    window.i18n.changeLanguage(language);
    document.querySelector('#wifi-screen h1').textContent = window.i18n.t('connectCamera');

    const wifiListSearch = document.querySelector('#wifi-list li');
    if (wifiListSearch) {
      wifiListSearch.innerHTML = `<div class="spinner"></div> ${window.i18n.t('searching')}`;
    }

    document.querySelector('#captureButton').textContent = window.i18n.t('capture');
    document.querySelector('.shortcut-hint').innerHTML = window.i18n.t('pressSpaceToTake');

    document.querySelector('#printButton').textContent = window.i18n.t('print');
    document.querySelectorAll('.shortcut-hint')[1].innerHTML = window.i18n.t('pressEnterToPrint');

    document.querySelector('#newPhotoButton').textContent = window.i18n.t('newPhoto');
    document.querySelectorAll('.shortcut-hint')[2].innerHTML = window.i18n.t('pressSpaceForNew');

    document.querySelector('#reviewStatus').innerHTML = `<div class="spinner"></div> ${window.i18n.t('printing')}`;
  }
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyTranslations);
} else {
  applyTranslations();
}

new window.WifiSetup();

// Cursor management logic
let cursorTimeout = null;
let isTouchUsed = false;
let isWifiScreen = false;

const wifiScreenEl = document.getElementById('wifi-screen');
if (wifiScreenEl) {
  isWifiScreen = !wifiScreenEl.classList.contains('hidden');
}

const CURSOR_IDLE_TIMEOUT = 3000;

function updateCursorVisibility() {
  const body = document.body;

  if (isTouchUsed) {
    // If touch interface is active, always hide the cursor
    body.classList.add('cursor-hidden');
    return;
  }

  if (isWifiScreen) {
    // On Wi-Fi screen, if touch isn't active, always show the cursor
    body.classList.remove('cursor-hidden');
    return;
  }

  // Otherwise, we are on app screens (not touch). Cursor should be visible.
  body.classList.remove('cursor-hidden');

  // And we set a timeout to hide it if idle
  if (cursorTimeout) {
    clearTimeout(cursorTimeout);
  }

  cursorTimeout = setTimeout(() => {
    if (!isWifiScreen && !isTouchUsed) {
      body.classList.add('cursor-hidden');
    }
  }, CURSOR_IDLE_TIMEOUT);
}

// Listen for touch events to determine if a touch interface is used
window.addEventListener('touchstart', () => {
  isTouchUsed = true;
  updateCursorVisibility();
}, { passive: true });

// Listen for mouse movement to reset idle timer or cancel touch mode
// Using pointermove to accurately identify physical mouse input versus synthetic mousemove events from touch
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') {
    if (isTouchUsed) {
      isTouchUsed = false; // Mouse overrides touch if it moves
    }
    updateCursorVisibility();
  }
});

// We need a way to know when we leave the wifi screen.
// We can hook into a DOM mutation observer or expose a global function.
// Using a MutationObserver on the wifi-screen element to see when it gets hidden.
if (wifiScreenEl) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        const isHidden = wifiScreenEl.classList.contains('hidden');
        if (isHidden && isWifiScreen) {
          isWifiScreen = false;
          updateCursorVisibility();
        } else if (!isHidden && !isWifiScreen) {
          isWifiScreen = true;
          updateCursorVisibility();
        }
      }
    });
  });
  observer.observe(wifiScreenEl, { attributes: true });
}

// Initial call
updateCursorVisibility();

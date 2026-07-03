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

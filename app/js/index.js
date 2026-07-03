(function() {
require('./js/config');
'use strict';

const WifiSetup = require('./js/WifiSetup');
const i18n = require('./js/i18n');


// Apply initial translations to the DOM

const applyTranslations = () => {
i18n.changeLanguage(global.LANGUAGE || 'en');
  document.querySelector('#wifi-screen h1').textContent = i18n.t('connectCamera');

  const wifiListSearch = document.querySelector('#wifi-list li');
  if (wifiListSearch) {
    wifiListSearch.innerHTML = `<div class="spinner"></div> ${i18n.t('searching')}`;
  }

  document.querySelector('#captureButton').textContent = i18n.t('capture');
  document.querySelector('.shortcut-hint').innerHTML = i18n.t('pressSpaceToTake');

  document.querySelector('#printButton').textContent = i18n.t('print');
  document.querySelectorAll('.shortcut-hint')[1].innerHTML = i18n.t('pressEnterToPrint');

  document.querySelector('#newPhotoButton').textContent = i18n.t('newPhoto');
  document.querySelectorAll('.shortcut-hint')[2].innerHTML = i18n.t('pressSpaceForNew');

  document.querySelector('#reviewStatus').innerHTML = `<div class="spinner"></div> ${i18n.t('printing')}`;
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyTranslations);
} else {
  applyTranslations();
}

new WifiSetup();

})();
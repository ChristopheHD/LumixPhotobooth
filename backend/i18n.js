const i18next = require('i18next');
const fs = require('fs');
const path = require('path');
require('./config');
// ensure global.LANGUAGE is loaded


const loadLocales = () => {
  const localesPath = path.join(__dirname, '..', 'app', 'locales');
  const resources = {};

  if (fs.existsSync(localesPath)) {
    const langs = fs.readdirSync(localesPath);
    for (const lang of langs) {
      const langPath = path.join(localesPath, lang);
      if (fs.statSync(langPath).isDirectory()) {
        const files = fs.readdirSync(langPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const ns = file.replace('.json', '');
            const content = fs.readFileSync(path.join(langPath, file), 'utf8');

            if (!resources[lang]) resources[lang] = {};
            resources[lang][ns] = JSON.parse(content);
          }
        }
      }
    }
  }
  return resources;
};

i18next.init({
  lng: global.LANGUAGE || 'en',
  initImmediate: false,
  preload: [global.LANGUAGE || 'en'],
  fallbackLng: 'en',
  resources: loadLocales()
});

module.exports = i18next;

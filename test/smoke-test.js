const fs = require('fs');
const path = require('path');

const files = [
  'main.js',
  'app/index.html',
  'app/js/index.js',
  'app/js/Controller.js',
  'app/js/Lumix.js',
  'app/js/LumixServer.js',
  'app/js/config.js'
];

console.log('Running smoke test...');

let fail = false;
files.forEach(file => {
  if (fs.existsSync(path.join(__dirname, '..', file))) {
    console.log(`✅ ${file} exists`);
  } else {
    console.error(`❌ ${file} is missing`);
    fail = true;
  }
});

if (fail) {
  process.exit(1);
} else {
  console.log('Smoke test passed!');
}

'use strict';
console.log('index.js loading...');
// require path is relative to the directory containing index.js when using commonjs require in Electron renderer with nodeIntegration
// Reverting to ./js/Controller because the script is executed in the context of app/index.html
var Controller = require("./js/Controller");
new Controller();
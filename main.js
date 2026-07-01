'use strict';

const electron = require('electron');
const path = require('path');
const url = require('url');
const { ipcMain } = require('electron');

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {

  console.log('Loading Electron window...');

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'app/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Redirect renderer logs to terminal
  mainWindow.webContents.on('console-message', (event) => {
    // Modern signature: (event: WebContentsConsoleMessageEvent)
    // event has properties: level, message, line, sourceId
    console.log(event.message);
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
  mainWindow.setFullScreen(true);
  mainWindow.setMenu(null);
  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

ipcMain.on('print-image', (event, imagePath) => {
  let printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Required to load local file:// from data URL
    }
  });

  const htmlContent = `
    <html>
      <head><title>Photobooth Print</title></head>
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        img { width: 100%; height: 100%; object-fit: cover; }
        @page { margin: 0; size: landscape; }
      </style>
      <body>
        <img id="print-image" src="file://${imagePath}" />
        <script>
          const img = document.getElementById('print-image');
          img.onload = () => { window.imgLoaded = true; };
          img.onerror = () => { window.imgLoaded = 'error'; };
        </script>
      </body>
    </html>
  `;

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  printWindow.webContents.on('did-finish-load', async () => {
    // Wait for the image to be fully loaded
    let loaded = false;
    for (let i = 0; i < 50; i++) { // Max 5 seconds
      loaded = await printWindow.webContents.executeJavaScript('window.imgLoaded');
      if (loaded) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (loaded === 'error') {
      console.error('Failed to load image in print window.');
      printWindow.close();
      if (mainWindow) {
        mainWindow.webContents.send('print-finished', false, 'Image load error');
      }
      return;
    }

    printWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: '', // Default printer
      landscape: true,
      margins: {
        marginType: 'none'
      }
    }, (success, failureReason) => {
      if (!success) {
        console.error('Print failed:', failureReason);
      } else {
        console.log('Print job sent successfully.');
      }
      printWindow.close();
      printWindow = null;
      if (mainWindow) {
        mainWindow.webContents.send('print-finished', success, failureReason);
      }
    });
  });
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // if (process.platform !== 'darwin') {
  app.quit();
  // }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

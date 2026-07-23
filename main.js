'use strict';

const electron = require('electron');
const path = require('path');
const url = require('url');
const { ipcMain } = require('electron');
const MainController = require('./backend/MainController');

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let mainController;

function createWindow () {

  console.log('Loading Electron window...');

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Initialize main backend controller
  mainController = new MainController(mainWindow);

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

  mainWindow.setFullScreen(true);
  mainWindow.setMenu(null);
  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    if (mainController) {
      mainController.cleanup();
    }
    mainWindow = null;
    mainController = null;
  });
}

ipcMain.on('print-image', (event, imagePath) => {
  let printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  printWindow.loadFile(path.join(__dirname, 'app/print.html'), {
    query: { image: imagePath }
  });

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

    // Electron 43.0.0 on Linux has a bug where print() with options fails with "Invalid printer settings".
    // As a workaround to guarantee silent printing, we use printToPDF and pipe it to lp.
    printWindow.webContents.printToPDF({
      landscape: true,
      printBackground: true,
      preferCSSPageSize: false,
      pageSize: { width: 6, height: 4 }, // 15x10 cm equivalent in inches (landscape)
      margins: { marginType: 'none', top: 0, bottom: 0, left: 0, right: 0 }
    }).then(data => {
      const fs = require('fs');
      const os = require('os');
      const tempPdfPath = path.join(os.tmpdir(), 'print_temp_' + Date.now() + '.pdf');

      // Write the PDF
      fs.promises.writeFile(tempPdfPath, data).then(() => {
        const { exec } = require('child_process');
        // Tell lp to completely fill the page without hardware margins
        exec('lp -o fit-to-page -o media=Custom.10x15cm -o page-bottom=0 -o page-left=0 -o page-right=0 -o page-top=0 "' + tempPdfPath + '"', (error) => {
           if (error) {
             console.error('Print failed via lp:', error);
             if (mainWindow) mainWindow.webContents.send('print-finished', false, error.message);
           } else {
             console.log('Print job sent successfully via lp.');
             if (mainWindow) mainWindow.webContents.send('print-finished', true, null);
           }
           printWindow.close();
           printWindow = null;
           fs.unlink(tempPdfPath, () => {});
        });
      }).catch(err => {
        console.error('Failed to write PDF:', err);
        printWindow.close();
        printWindow = null;
        if (mainWindow) mainWindow.webContents.send('print-finished', false, err.message);
      });
    }).catch(error => {
      console.error('PrintToPDF failed:', error);
      printWindow.close();
      printWindow = null;
      if (mainWindow) {
        mainWindow.webContents.send('print-finished', false, error.message);
      }
    });
  });
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit();
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

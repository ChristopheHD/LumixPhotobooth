'use strict';

const wifi = require('node-wifi');
const http = require('http');
const { ipcMain } = require('electron');
const Lumix = require('./Lumix');
const fs = require('fs');
const path = require('path');
require('./config');

class MainController {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.camera = new Lumix();

    wifi.init({
      iface: null // network interface, choose a random one if null
    });

    this.isScanning = false;
    this.scanTimeout = null;
    this.previewInterval = null;

    this.setupIpcHandlers();
  }

  setupIpcHandlers() {
    // Clean up previously registered handlers to avoid errors if window is recreated
    ipcMain.removeHandler('wifi-check-initial');
    ipcMain.removeHandler('wifi-scan');
    ipcMain.removeHandler('wifi-connect');
    ipcMain.removeHandler('camera-init');
    ipcMain.removeHandler('camera-capture');
    ipcMain.removeHandler('camera-stop-stream');
    ipcMain.removeHandler('camera-start-stream');
    ipcMain.removeHandler('get-config');

    ipcMain.handle('wifi-check-initial', async () => {
      return new Promise((resolve) => {
        const req = http.get('http://192.168.54.1:60606/Server0/CDS_control', (res) => {
          resolve(true);
        }).on('error', (err) => {
          resolve(false);
        });
        req.setTimeout(1000, () => req.destroy());
      });
    });

    ipcMain.handle('wifi-scan', async () => {
      return new Promise((resolve, reject) => {
        wifi.scan((error, networks) => {
          if (error) {
            reject(error);
          } else {
            const uniqueNetworks = [];
            const ssids = new Set();
            for (const network of networks) {
              let isSecure = false;
              if (network.security) {
                const securityLower = network.security.toLowerCase();
                isSecure = securityLower !== 'none' && securityLower !== 'open' && network.security !== '';
              }
              if (network.ssid && !isSecure && !ssids.has(network.ssid)) {
                ssids.add(network.ssid);
                uniqueNetworks.push(network);
              }
            }
            resolve(uniqueNetworks);
          }
        });
      });
    });

    ipcMain.handle('wifi-connect', async (event, ssid) => {
      return new Promise((resolve, reject) => {
        wifi.connect({ ssid: ssid }, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    });

    ipcMain.handle('camera-init', () => {
      this.camera.initialize();
      this.camera.startStream();
      this.startPreviewStream();
    });

    ipcMain.handle('camera-capture', async () => {
      return new Promise((resolve, reject) => {
        this.camera.capture((err, ok) => {
          if (err) {
            return reject(err);
          }

          let tries = 3;
          const attemptDownload = () => {
            this.camera.getLastPhoto(async (err, data) => {
              if (err) {
                tries--;
                if (tries === 0) {
                  this.camera.startStream();
                  return reject(err);
                } else {
                  setTimeout(attemptDownload, 1000);
                  return;
                }
              }

              // Save photo
              const now = new Date();
              const timestamp = now.getFullYear() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') + '_' +
                String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0') +
                String(now.getSeconds()).padStart(2, '0');

              const filename = `lumix_capture_${timestamp}.jpg`;
              const capturesDir = path.join(__dirname, '..', 'captures');

              try {
                await fs.promises.mkdir(capturesDir, { recursive: true });
                const filepath = path.join(capturesDir, filename);
                await fs.promises.writeFile(filepath, data);
                resolve({ filepath, data }); // Data is a Buffer, will be serialized
              } catch (e) {
                console.error('Failed to save photo to disk:', e);
                resolve({ filepath: null, data });
              }
            });
          };

          attemptDownload();
        });
      });
    });

    ipcMain.handle('camera-stop-stream', () => {
      this.camera.stopStream();
      this.stopPreviewStream();
    });

    ipcMain.handle('camera-start-stream', () => {
      this.camera.startStream();
      this.startPreviewStream();
    });

    ipcMain.handle('get-config', () => {
      return {
        PRINT: global.PRINT
      };
    });
  }

  startPreviewStream() {
    if (this.previewInterval) return;

    let lastProcessedCount = -1;
    this.previewInterval = setInterval(() => {
      if (this.camera.server.count !== lastProcessedCount) {
        lastProcessedCount = this.camera.server.count;
        const imgData = this.camera.getPreviewImage();
        if (imgData && this.mainWindow && !this.mainWindow.isDestroyed()) {
          // Send as binary
          this.mainWindow.webContents.send('camera-preview', imgData);
        }
      }
    }, 16); // ~60fps
  }

  stopPreviewStream() {
    if (this.previewInterval) {
      clearInterval(this.previewInterval);
      this.previewInterval = null;
    }
  }

  cleanup() {
    this.stopPreviewStream();
    this.mainWindow = null;
  }
}

module.exports = MainController;

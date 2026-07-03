'use strict';
const wifi = require('node-wifi');
const Controller = require('./Controller');

const i18n = require('./i18n');
class WifiSetup {
  constructor() {
    this.wifiScreen = document.getElementById('wifi-screen');
    this.appContainer = document.getElementById('app-container');
    this.wifiList = document.getElementById('wifi-list');
    this.wifiError = document.getElementById('wifi-error');

    wifi.init({
      iface: null // network interface, choose a random one if null
    });

    this.isConnecting = false;
    this.isScanning = false;
    this.scanTimeout = null;

    this.checkInitialConnection();
  }

  checkInitialConnection() {
    const http = require('http');
    const req = http.get('http://192.168.54.1:60606/Server0/CDS_control', (res) => {
      // Camera is already reachable, skip Wi-Fi setup
      console.log('Camera already connected on startup.');
      this.startApp();
    }).on('error', (err) => {
      // Camera is not reachable, start Wi-Fi setup
      this.startScanning();
    });

    req.setTimeout(1000, () => {
      req.destroy();
    });
  }

  startScanning() {
    this.isScanning = true;
    this.scan(); // Initial scan
  }

  stopScanning() {
    this.isScanning = false;
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  scan() {
    if (this.isConnecting || !this.isScanning) return;

    // Only show "Searching..." if the list is completely empty
    if (this.wifiList.children.length === 0) {
      this.wifiList.innerHTML = `<li><div class="spinner"></div> ${i18n.t('searching')}</li>`;
    }

    wifi.scan((error, networks) => {
      // Bolt optimization: Schedule next scan only AFTER current scan completes.
      // This prevents CPU spin and child process accumulation from overlapping OS network scans.
      if (this.isScanning && !this.isConnecting) {
        this.scanTimeout = setTimeout(() => this.scan(), 2000); // 2 second delay between scans
      }

      if (this.isConnecting) return;
      if (error) {
        console.error('Error during Wi-Fi scan:', error);
        this.wifiError.textContent = i18n.t('errorSearching');
        this.wifiError.classList.remove('hidden');
        this.wifiList.innerHTML = '';
        return;
      }

      if (networks.length === 0) {
        this.wifiList.innerHTML = `<li>${i18n.t('noNetwork')}</li>`;
        return;
      }

      // Deduplicate networks by SSID and filter for open networks only
      const uniqueNetworks = [];
      const ssids = new Set();
      for (const network of networks) {
        // Only show networks without a password (Lumix networks are open)
        // Some platforms report 'none', '', or 'Open' for no security
        const isSecure = network.security && network.security.toLowerCase() !== 'none' && network.security.toLowerCase() !== 'open' && network.security !== '';

        if (network.ssid && !isSecure && !ssids.has(network.ssid)) {
          ssids.add(network.ssid);
          uniqueNetworks.push(network);
        }
      }

      this.wifiList.innerHTML = '';
      if (uniqueNetworks.length === 0) {
        this.wifiList.innerHTML = `<li>${i18n.t('noNetwork')}</li>`;
        return;
      }

      uniqueNetworks.forEach((network) => {
        const li = document.createElement('li');
        li.textContent = network.ssid;
        li.tabIndex = 0; // Make it focusable for keyboard navigation
        li.setAttribute('role', 'button');

        const connectHandler = () => this.connect(network.ssid);

        li.addEventListener('click', connectHandler);
        li.addEventListener('keydown', (e) => {
          if (e.code === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            connectHandler();
          }
        });

        this.wifiList.appendChild(li);
      });
    });
  }

  connect(ssid) {
    this.isConnecting = true;
    this.stopScanning();
    this.wifiList.innerHTML = `<li><div class="spinner"></div> ${i18n.t('connecting', {ssid})}</li>`;
    this.wifiError.classList.add('hidden');

    wifi.connect({ ssid: ssid }, (error) => {
      if (error) {
        console.error(`Connection error to ${ssid}:`, error);
        this.wifiError.textContent = i18n.t('connectionError', {ssid});
        this.wifiError.classList.remove('hidden');
        this.isConnecting = false;
        this.startScanning(); // Refresh the list and resume background scan
        return;
      }

      console.log(`Connected to ${ssid}. Waiting for camera...`);
      this.wifiList.innerHTML = `<li><div class="spinner"></div> ${i18n.t('waitingForCamera')}</li>`;
      this.waitForCamera();
    });
  }

  waitForCamera() {
    const http = require('http');
    let attempts = 0;
    const maxAttempts = 15; // Max 15 attempts, at ~1000ms each, ~15 seconds total

    const checkCamera = () => {
      attempts++;
      const req = http.get('http://192.168.54.1:60606/Server0/CDS_control', (res) => {
        // Any response means the camera is reachable
        console.log('Camera detected! Waiting for stabilization...');

        // Wait an additional 2 seconds before initializing commands to let the camera settle
        setTimeout(() => {
          this.startApp();
        }, 2000);

      }).on('error', (err) => {
        if (attempts >= maxAttempts) {
          console.error('Failed to reach camera after Wi-Fi connection.');
          this.wifiError.textContent = i18n.t('cameraUnreachable');
          this.wifiError.classList.remove('hidden');
          this.isConnecting = false;
          this.startScanning();
          return;
        }
        setTimeout(checkCamera, 1000);
      });

      // Add timeout to request
      req.setTimeout(1000, () => {
        req.destroy();
      });
    };

    checkCamera();
  }

  startApp() {
    this.wifiScreen.classList.add('hidden');
    this.appContainer.classList.remove('hidden');
    new Controller();
  }
}

module.exports = WifiSetup;

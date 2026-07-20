'use strict';

class WifiSetup {
  constructor() {
    this.wifiScreen = document.getElementById('wifi-screen');
    this.appContainer = document.getElementById('app-container');
    this.wifiList = document.getElementById('wifi-list');
    this.wifiError = document.getElementById('wifi-error');

    this.isConnecting = false;
    this.isScanning = false;
    this.scanTimeout = null;

    this.checkInitialConnection();
  }

  async checkInitialConnection() {
    const isConnected = await window.api.wifiCheckInitial();
    if (isConnected) {
      console.log('Camera already connected on startup.');
      this.startApp();
    } else {
      this.startScanning();
    }
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

  async scan() {
    if (this.isConnecting || !this.isScanning) return;

    if (this.wifiList.children.length === 0) {
      this.wifiList.innerHTML = `<li><div class="spinner"></div> ${window.i18n ? window.i18n.t('searching') : 'Searching...'}</li>`;
    }

    try {
      const networks = await window.api.wifiScan();

      if (this.isScanning && !this.isConnecting) {
        this.scanTimeout = setTimeout(() => this.scan(), 2000);
      }

      if (this.isConnecting) return;

      if (networks.length === 0) {
        this.wifiList.innerHTML = `<li>${window.i18n ? window.i18n.t('noNetwork') : 'No network found'}</li>`;
        return;
      }

      this.wifiList.innerHTML = '';
      networks.forEach((network) => {
        const li = document.createElement('li');
        li.textContent = network.ssid;
        li.tabIndex = 0;
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
    } catch (error) {
      if (this.isScanning && !this.isConnecting) {
        this.scanTimeout = setTimeout(() => this.scan(), 2000);
      }

      if (this.isConnecting) return;

      console.error('Error during Wi-Fi scan:', error);
      this.wifiError.textContent = window.i18n ? window.i18n.t('errorSearching') : 'Error searching for Wi-Fi networks.';
      this.wifiError.classList.remove('hidden');
      this.wifiList.innerHTML = '';
    }
  }

  async connect(ssid) {
    this.isConnecting = true;
    this.stopScanning();
    this.wifiList.innerHTML = `<li><div class="spinner"></div> ${window.i18n ? window.i18n.t('connecting', {ssid}) : 'Connecting to ' + ssid}</li>`;
    this.wifiError.classList.add('hidden');

    try {
      await window.api.wifiConnect(ssid);
      console.log(`Connected to ${ssid}. Waiting for camera...`);
      this.wifiList.innerHTML = `<li><div class="spinner"></div> ${window.i18n ? window.i18n.t('waitingForCamera') : 'Waiting for camera...'}</li>`;
      this.waitForCamera();
    } catch (error) {
      console.error(`Connection error to ${ssid}:`, error);
      this.wifiError.textContent = window.i18n ? window.i18n.t('connectionError', {ssid}) : `Connection error to ${ssid}. Please try again.`;
      this.wifiError.classList.remove('hidden');
      this.isConnecting = false;
      this.startScanning();
    }
  }

  async waitForCamera() {
    let attempts = 0;
    const maxAttempts = 15;

    const checkCamera = async () => {
      attempts++;
      const isConnected = await window.api.wifiCheckInitial();

      if (isConnected) {
        console.log('Camera detected! Waiting for stabilization...');
        setTimeout(() => {
          this.startApp();
        }, 2000);
      } else {
        if (attempts >= maxAttempts) {
          console.error('Failed to reach camera after Wi-Fi connection.');
          this.wifiError.textContent = window.i18n ? window.i18n.t('cameraUnreachable') : 'Wi-Fi connected successfully, but camera is unreachable.';
          this.wifiError.classList.remove('hidden');
          this.isConnecting = false;
          this.startScanning();
          return;
        }
        setTimeout(checkCamera, 1000);
      }
    };

    checkCamera();
  }

  startApp() {
    this.wifiScreen.classList.add('hidden');
    this.appContainer.classList.remove('hidden');
    new window.Controller();
  }
}

window.WifiSetup = WifiSetup;

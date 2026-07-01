'use strict';
const wifi = require('node-wifi');
const Controller = require('./Controller');

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
    this.scanInterval = null;

    this.checkInitialConnection();
  }

  checkInitialConnection() {
    const http = require('http');
    const req = http.get('http://192.168.54.1:60606/Server0/CDS_control', (res) => {
      // Camera is already reachable, skip Wi-Fi setup
      console.log('Caméra déjà connectée au démarrage.');
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
    this.scan(); // Initial scan
    this.scanInterval = setInterval(() => {
      this.scan();
    }, 2000); // Scan every 2 seconds for faster updates
  }

  stopScanning() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  scan() {
    if (this.isConnecting) return;

    // Only show "Recherche..." if the list is completely empty
    if (this.wifiList.children.length === 0) {
      this.wifiList.innerHTML = '<li>Recherche des réseaux...</li>';
    }

    wifi.scan((error, networks) => {
      if (this.isConnecting) return;
      if (error) {
        console.error('Erreur lors du scan WiFi:', error);
        this.wifiError.textContent = 'Erreur lors de la recherche des réseaux WiFi.';
        this.wifiError.classList.remove('hidden');
        this.wifiList.innerHTML = '';
        return;
      }

      this.wifiList.innerHTML = '';
      if (networks.length === 0) {
        this.wifiList.innerHTML = '<li>Aucun réseau trouvé</li>';
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

      uniqueNetworks.forEach((network) => {
        const li = document.createElement('li');
        li.textContent = network.ssid;
        li.tabIndex = 0; // Make it focusable for keyboard navigation

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
    this.wifiList.innerHTML = `<li>Connexion à ${ssid}...</li>`;
    this.wifiError.classList.add('hidden');

    wifi.connect({ ssid: ssid }, (error) => {
      if (error) {
        console.error(`Erreur de connexion à ${ssid}:`, error);
        this.wifiError.textContent = `Erreur de connexion à ${ssid}. Veuillez réessayer.`;
        this.wifiError.classList.remove('hidden');
        this.isConnecting = false;
        this.startScanning(); // Refresh the list and resume background scan
        return;
      }

      console.log(`Connecté à ${ssid}. Attente de l'appareil photo...`);
      this.wifiList.innerHTML = `<li>Attente de l'appareil photo...</li>`;
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
        console.log('Caméra détectée ! Attente de stabilisation...');

        // Wait an additional 2 seconds before initializing commands to let the camera settle
        setTimeout(() => {
          this.startApp();
        }, 2000);

      }).on('error', (err) => {
        if (attempts >= maxAttempts) {
          console.error('Impossible de joindre la caméra après connexion WiFi.');
          this.wifiError.textContent = 'Connexion WiFi réussie, mais appareil photo injoignable.';
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

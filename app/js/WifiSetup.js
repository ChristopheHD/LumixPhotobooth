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

    this.scan();
  }

  scan() {
    this.wifiList.innerHTML = '<li>Recherche des réseaux...</li>';

    wifi.scan((error, networks) => {
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

      // Deduplicate networks by SSID
      const uniqueNetworks = [];
      const ssids = new Set();
      for (const network of networks) {
        if (network.ssid && !ssids.has(network.ssid)) {
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
    this.wifiList.innerHTML = `<li>Connexion à ${ssid}...</li>`;
    this.wifiError.classList.add('hidden');

    wifi.connect({ ssid: ssid }, (error) => {
      if (error) {
        console.error(`Erreur de connexion à ${ssid}:`, error);
        this.wifiError.textContent = `Erreur de connexion à ${ssid}. Veuillez réessayer.`;
        this.wifiError.classList.remove('hidden');
        this.scan(); // Refresh the list
        return;
      }

      console.log(`Connecté à ${ssid}`);
      this.startApp();
    });
  }

  startApp() {
    this.wifiScreen.classList.add('hidden');
    this.appContainer.classList.remove('hidden');
    new Controller();
  }
}

module.exports = WifiSetup;

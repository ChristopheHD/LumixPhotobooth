'use strict';
require('./config');
var fs = require('fs');
var path = require('path');
var $ = require('jquery');
const { ipcRenderer } = require('electron');
var Lumix = require('./Lumix');

var previewImage = document.querySelector('#preview');
var captureButton = document.querySelector('#captureButton');
var countdownElement = document.querySelector('#countdown');
var flashElement = document.querySelector('#flash');

class Controller {
  constructor() {
    var camera = new Lumix();

    camera.initialize();
    camera.startStream();

    this.camera = camera;

    // Display optimization
    this.previewImage = previewImage;
    this.currentUrl = null;
    this.isUpdating = false;
    this.lastProcessedCount = -1;

    // Performance metrics
    this.frameTimeSum = 0;
    this.frameCount = 0;

    // Elements
    this.captureButton = document.getElementById('captureButton');
    this.countdownElement = document.getElementById('countdown');
    this.flashElement = document.getElementById('flash');

    // Bolt optimization: Bind render once to avoid per-frame allocation
    this.render = this.render.bind(this);

    // IPC Events
    ipcRenderer.on('print-finished', (event, success, error) => {
      if (!success) {
        console.error('Print failed callback:', error);
      } else {
        console.log('Print successful callback.');
      }
      this.setButtonState('Capture', false);
      this.captureButton.disabled = false;
      this.camera.startStream();
    });

    //Attach events
    captureButton.addEventListener('click', () => this.startCountdown());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();

        const spaceKey = document.getElementById('spaceKey');
        if (spaceKey) {
          spaceKey.classList.add('pressed');
        }

        this.startCountdown();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        const spaceKey = document.getElementById('spaceKey');
        if (spaceKey) {
          spaceKey.classList.remove('pressed');
        }
      }
    });

    this.render();
  }

  setButtonState(text, isLoading) {
    if (!this.captureButton) return;

    if (isLoading) {
      this.captureButton.innerHTML = `<div class="spinner"></div> ${text}`;
    } else {
      this.captureButton.textContent = text;
    }
  }

  startCountdown() {
    if (this.isCountingDown || captureButton.disabled) return;
    this.isCountingDown = true;

    var count = 3;
    if (this.captureButton) {
      this.captureButton.disabled = true;
      this.setButtonState('Preparing...', true);
    }

    countdownElement.classList.remove('hidden');
    countdownElement.classList.remove('pulse-animation');
    void countdownElement.offsetWidth; // Force reflow
    countdownElement.classList.add('pulse-animation');
    countdownElement.textContent = count;

    var interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownElement.textContent = count;
        countdownElement.classList.remove('pulse-animation');
        void countdownElement.offsetWidth; // Force reflow
        countdownElement.classList.add('pulse-animation');
      } else {
        clearInterval(interval);
        if (this.countdownElement) {
          this.countdownElement.classList.add('hidden');
        }
        this.isCountingDown = false;
        this.triggerFlash();
        this.capture();
      }
    }, 1000);
  }

  triggerFlash() {
    if (this.flashElement) {
      this.flashElement.classList.remove('hidden');
      this.flashElement.classList.add('flash-animation');

      // Remove class and hide after animation completes
      setTimeout(() => {
        this.flashElement.classList.remove('flash-animation');
        this.flashElement.classList.add('hidden');
      }, 500);
    }
  }

  render() {
    const startTime = performance.now();

    // Bolt optimization: Only process if a new frame has been received.
    // This reduces CPU/GPU work when the camera's frame rate is lower than the UI's 60fps.
    if (this.camera.server.count !== this.lastProcessedCount) {
      this.displayImage(this.camera.getPreviewImage());
    }

    requestAnimationFrame(this.render);

    // Optional: Log performance periodically
    if (this.frameCount > 0 && this.frameCount % 300 === 0) {
      console.log(`Average UI render loop time: ${(this.frameTimeSum / this.frameCount).toFixed(2)}ms`);
    }
    this.frameTimeSum += (performance.now() - startTime);
    this.frameCount++;
  }

  async displayImage(imgData) {
    // imgData is now a Buffer/Uint8Array
    if (imgData && !this.isUpdating) {
      this.isUpdating = true;
      this.lastProcessedCount = this.camera.server.count;

      try {
        // Using Blob and object URL for high-performance data transfer to <img>
        const blob = new Blob([imgData], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);

        // Update image source
        const oldUrl = this.currentUrl;
        this.previewImage.src = url;
        this.currentUrl = url;

        // Revoke old URL to free memory after the new image starts loading
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }
      } catch (e) {
        console.error('Error updating preview image:', e);
      } finally {
        this.isUpdating = false;
      }
    }
  }

  capture() {
    this.captureButton.disabled = true;
    this.setButtonState('Capturing...', true);

    this.camera.capture((err, ok)=>{
      if(err){
        this.captureButton.disabled = false;
        this.setButtonState('Capture', false);
        return;
      }

      // Attempt to download last photo taken
      this.attempt((cb) => {
        this.camera.getLastPhoto(cb);
      }, (err, data)=>{

        this.captureButton.disabled = false;
        this.setButtonState('Capture', false);

        if(err){
          console.error('Failed to download last photo from camera:', JSON.stringify(err, null, 2));
          this.camera.startStream();
          return;
        }

        // Save photo
        console.log('Photo downloaded from camera, starting browser download...');
        const filepath = this.downloadImage(data);

        if (global.AUTO_PRINT && filepath) {
          this.captureButton.disabled = true;
          this.setButtonState('Printing...', true);
          ipcRenderer.send('print-image', filepath);
        } else {
          this.captureButton.disabled = false;
          this.setButtonState('Capture', false);
          this.camera.startStream();
        }
      }, 3);

    });
  }

  downloadImage(data) {
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
      if (!fs.existsSync(capturesDir)) {
        fs.mkdirSync(capturesDir, { recursive: true });
      }

      const filepath = path.join(capturesDir, filename);
      fs.writeFileSync(filepath, data);
      console.log(`Photo saved successfully to: ${filepath}`);
      return filepath;
    } catch (e) {
      console.error('Failed to save photo to disk:', e);

      // Fallback to browser download if fs fails
      const blob = new Blob([data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
      return null;
    }
  }

  attempt(fn, callback, tries) {
    fn((err, res) => {
      if (err) {
        console.warn(`Attempt failed (${tries} tries left):`, JSON.stringify(err));
        //Retry
        if (tries === 0) {
          return callback(err, res);
        } else {
          setTimeout(() => {
            this.attempt(fn, callback, tries - 1);
          }, 1000);
          return;
        }
      }
      return callback(err, res);
    });
  }

}

module.exports = Controller;

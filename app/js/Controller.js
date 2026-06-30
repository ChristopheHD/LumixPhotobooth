'use strict';
require('./config');
var $ = require('jquery');
var Lumix = require('./Lumix');

var canvas = document.querySelector('#canvas');
var context = canvas.getContext('2d');
var captureButton = document.querySelector('#captureButton');
var countdownElement = document.querySelector('#countdown');
var flashElement = document.querySelector('#flash');

class Controller {
  constructor() {
    var camera = new Lumix();

    camera.initialize();
    camera.startStream();

    this.camera = camera;

    // Bolt optimization: Use createImageBitmap for high-performance decoding
    this.currentBitmap = null;
    this.isDecoding = false;
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

    //Attach events
    captureButton.addEventListener('click', () => this.startCountdown());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        this.startCountdown();
      }
    });

    this.render();
  }

  startCountdown() {
    if (this.isCountingDown || captureButton.disabled) return;
    this.isCountingDown = true;

    var count = 3;
    if (this.captureButton) {
      this.captureButton.disabled = true;
      this.captureButton.textContent = '🎂 Preparing...';
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
    if (imgData && !this.isDecoding) {
      this.isDecoding = true;
      this.lastProcessedCount = this.camera.server.count;

      try {
        // Bolt optimization: createImageBitmap decodes the image off the main thread.
        // We create a Blob from the binary data.
        const blob = new Blob([imgData], { type: 'image/jpeg' });
        const bitmap = await createImageBitmap(blob);

        // Clean up previous bitmap to prevent memory leaks
        if (this.currentBitmap) {
          this.currentBitmap.close();
        }

        this.currentBitmap = bitmap;
        context.drawImage(this.currentBitmap, 0, 0, this.currentBitmap.width, this.currentBitmap.height, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        console.error('Error decoding preview image:', e);
      } finally {
        this.isDecoding = false;
      }
    }
  }

  capture() {
    this.captureButton.disabled = true;
    this.captureButton.textContent = '🎂 Capturing...';

    this.camera.capture((err, ok)=>{
      if(err){
        this.captureButton.disabled = false;
        this.captureButton.textContent = 'Capture';
        return;
      }

      // Attempt to download last photo taken
      this.attempt((cb) => {
        this.camera.getLastPhoto(cb);
      }, (err, data)=>{

        this.captureButton.disabled = false;
        this.captureButton.textContent = 'Capture';

        if(err){
          console.error('Failed to download last photo from camera:', err);
          this.camera.startStream();
          return;
        }

        // Save photo
        console.log('Photo downloaded from camera, starting browser download...');
        this.downloadImage(data);
        
        this.camera.startStream();
      }, 3);

    });
  }

  downloadImage(data) {
    const blob = new Blob([data], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const now = new Date();
    const timestamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    a.href = url;
    a.download = `lumix_capture_${timestamp}.jpg`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }

  attempt(fn, callback, tries) {
    fn((err, res) => {
      if (err) {
        //Retry
        if (tries === 0) {
          return callback(err, res);
        } else {
          return this.attempt(fn, callback, tries - 1);
        }
      }
      return callback(err, res);
    });
  }

}

module.exports = Controller;

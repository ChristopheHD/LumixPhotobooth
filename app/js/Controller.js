'use strict';
require('./config');

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const Lumix = require('./Lumix');

const previewImage = document.querySelector('#preview');
const captureButton = document.querySelector('#captureButton');
const countdownElement = document.querySelector('#countdown');
const flashElement = document.querySelector('#flash');

const i18n = require('./i18n');
class Controller {
  constructor() {
    const camera = new Lumix();

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

    // Review Elements
    this.reviewScreen = document.getElementById('reviewScreen');
    this.reviewImage = document.getElementById('reviewImage');
    this.reviewControls = document.getElementById('reviewControls');
    this.printButton = document.getElementById('printButton');
    this.newPhotoButton = document.getElementById('newPhotoButton');
    this.reviewStatus = document.getElementById('reviewStatus');
    this.reviewImageUrl = null;
    this.currentPrintFilepath = null;
    this.isReviewActive = false;

    // Bolt optimization: Bind render once to avoid per-frame allocation
    this.render = this.render.bind(this);

    // IPC Events
    ipcRenderer.on('print-finished', (event, success, error) => {
      if (!success) {
        console.error('Print failed callback:', error);
      } else {
        console.log('Print successful callback.');
      }
      this.closeReviewScreen();
    });

    //Attach events
    captureButton.addEventListener('click', () => this.startCountdown());

    this.printButton.addEventListener('click', () => this.triggerPrint());
    this.newPhotoButton.addEventListener('click', () => this.closeReviewScreen());

    window.addEventListener('keydown', (e) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();

        if (this.isReviewActive) {
          const reviewSpaceKey = document.getElementById('reviewSpaceKey');
          if (reviewSpaceKey) reviewSpaceKey.classList.add('active');

          if (!this.printButton.disabled && !this.newPhotoButton.disabled) {
            this.closeReviewScreen();
          }
        } else {
          const spaceKey = document.getElementById('spaceKey');
          if (spaceKey) spaceKey.classList.add('active');
          this.startCountdown();
        }
      } else if (e.code === 'Enter') {
        if (this.isReviewActive && global.PRINT) {
          e.preventDefault();
          const enterKey = document.getElementById('enterKey');
          if (enterKey) enterKey.classList.add('active');

          if (!this.printButton.disabled) {
            this.triggerPrint();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        const spaceKey = document.getElementById('spaceKey');
        if (spaceKey) spaceKey.classList.remove('active');
        const reviewSpaceKey = document.getElementById('reviewSpaceKey');
        if (reviewSpaceKey) reviewSpaceKey.classList.remove('active');
      } else if (e.code === 'Enter') {
        const enterKey = document.getElementById('enterKey');
        if (enterKey) enterKey.classList.remove('active');
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

    let count = 5;
    if (this.captureButton) {
      this.captureButton.disabled = true;
      this.setButtonState(i18n.t('preparing'), true);
    }

    countdownElement.classList.remove('hidden');
    countdownElement.classList.remove('pulse-animation');
    void countdownElement.offsetWidth; // Force reflow
    countdownElement.classList.add('pulse-animation');
    countdownElement.textContent = count;

    const interval = setInterval(() => {
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

        // Bolt optimization: Use onload/onerror to apply backpressure to the render loop.
        // This drops intermediate frames if the UDP stream outpaces the browser's decode/render cycle,
        // preventing memory leaks, decoding backlogs, and CPU churn on constrained hardware.
        const releaseLock = () => {
          if (oldUrl) {
            URL.revokeObjectURL(oldUrl);
          }
          this.isUpdating = false;
          this.previewImage.onload = null;
          this.previewImage.onerror = null;
        };

        this.previewImage.onload = releaseLock;
        this.previewImage.onerror = releaseLock;

        this.previewImage.src = url;
        this.currentUrl = url;
      } catch (e) {
        console.error('Error updating preview image:', e);
        this.isUpdating = false;
      }
    }
  }

  capture() {
    this.captureButton.disabled = true;
    this.setButtonState(i18n.t('capturing'), true);

    this.camera.capture((err, ok)=>{
      if(err){
        this.captureButton.disabled = false;
        this.setButtonState(i18n.t('capture'), false);
        return;
      }

      // Attempt to download last photo taken
      this.attempt((cb) => {
        this.camera.getLastPhoto(cb);
      }, async (err, data)=>{

        this.captureButton.disabled = false;
        this.setButtonState(i18n.t('capture'), false);

        if(err){
          console.error('Failed to download last photo from camera:', JSON.stringify(err, null, 2));
          this.camera.startStream();
          return;
        }

        // Save photo
        console.log('Photo downloaded from camera, starting browser download...');
        const filepath = await this.downloadImage(data);

        if (filepath) {
          this.showReviewScreen(data, filepath);
        } else {
          this.camera.startStream();
        }
      }, 3);

    });
  }

  showReviewScreen(imgData, filepath) {
    this.isReviewActive = true;
    this.currentPrintFilepath = filepath;

    // Stop camera stream to focus on review
    this.camera.stopStream();

    const blob = new Blob([imgData], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    this.reviewImageUrl = url;
    this.reviewImage.src = url;

    this.reviewScreen.classList.remove('hidden');
    this.reviewStatus.classList.add('hidden');

    this.printButton.disabled = false;
    this.newPhotoButton.disabled = false;

    if (global.PRINT) {
      this.reviewControls.classList.remove('hidden');
    } else {
      this.reviewControls.classList.add('hidden');
      // If PRINT is false, show for 3 seconds then return
      setTimeout(() => {
        if (this.isReviewActive) {
          this.closeReviewScreen();
        }
      }, 3000);
    }
  }

  triggerPrint() {
    if (!this.currentPrintFilepath || this.printButton.disabled || !global.PRINT) return;

    this.printButton.disabled = true;
    this.newPhotoButton.disabled = true;
    this.reviewControls.classList.add('hidden');
    this.reviewStatus.classList.remove('hidden');

    ipcRenderer.send('print-image', this.currentPrintFilepath);
  }

  closeReviewScreen() {
    this.isReviewActive = false;
    this.reviewScreen.classList.add('hidden');

    if (this.reviewImageUrl) {
      URL.revokeObjectURL(this.reviewImageUrl);
      this.reviewImageUrl = null;
      this.reviewImage.src = '';
    }

    this.currentPrintFilepath = null;

    // Reset buttons state
    this.setButtonState(i18n.t('capture'), false);
    this.captureButton.disabled = false;

    // Restart stream
    this.camera.startStream();
  }

  async downloadImage(data) {
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

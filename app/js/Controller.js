'use strict';

const previewImage = document.querySelector('#preview');
const captureButton = document.querySelector('#captureButton');
const countdownElement = document.querySelector('#countdown');
const flashElement = document.querySelector('#flash');

class Controller {
  constructor() {
    window.api.cameraInit();

    // Display optimization
    this.previewImage = previewImage;
    this.currentUrl = null;
    this.isUpdating = false;

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

    // IPC Events
    window.api.onPrintFinished((success, error) => {
      if (!success) {
        console.error('Print failed callback:', error);
      } else {
        console.log('Print successful callback.');
      }
      this.closeReviewScreen();
    });

    window.api.onCameraPreview((imgData) => {
      this.displayImage(imgData);
    });

    //Attach events
    captureButton.addEventListener('click', () => this.startCountdown());

    this.printButton.addEventListener('click', () => this.triggerPrint());
    this.newPhotoButton.addEventListener('click', () => this.closeReviewScreen());

    window.addEventListener('keydown', async (e) => {
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
        if (this.isReviewActive) {
          e.preventDefault();
          const config = await window.api.getConfig();
          if (config.PRINT) {
            const enterKey = document.getElementById('enterKey');
            if (enterKey) enterKey.classList.add('active');

            if (!this.printButton.disabled) {
              this.triggerPrint();
            }
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
  }

  setButtonState(text, isLoading) {
    if (!this.captureButton) return;

    if (isLoading) {
      this.captureButton.innerHTML = `<div class="spinner"></div> ${text}`;
    } else {
      this.captureButton.textContent = text;
    }
  }

  async startCountdown() {
    if (this.isCountingDown || captureButton.disabled) return;
    this.isCountingDown = true;

    let count = 3;
    if (this.captureButton) {
      this.captureButton.disabled = true;
      this.setButtonState(await window.api.getTranslation('preparing'), true);
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

  displayImage(imgData) {
    if (imgData && !this.isUpdating) {
      this.isUpdating = true;

      try {
        const blob = new Blob([imgData], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);

        const oldUrl = this.currentUrl;

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

  async capture() {
    this.captureButton.disabled = true;
    this.setButtonState(await window.api.getTranslation('capturing'), true);

    try {
      const { filepath, data } = await window.api.cameraCapture();

      this.captureButton.disabled = false;
      this.setButtonState(await window.api.getTranslation('capture'), false);

      this.showReviewScreen(data, filepath);
    } catch (err) {
      console.error('Capture failed:', err);
      this.captureButton.disabled = false;
      this.setButtonState(await window.api.getTranslation('capture'), false);
    }
  }

  async showReviewScreen(imgData, filepath) {
    this.isReviewActive = true;
    this.currentPrintFilepath = filepath;

    window.api.cameraStopStream();

    const blob = new Blob([imgData], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    this.reviewImageUrl = url;
    this.reviewImage.src = url;

    this.reviewScreen.classList.remove('hidden');
    this.reviewStatus.classList.add('hidden');

    this.printButton.disabled = false;
    this.newPhotoButton.disabled = false;

    const config = await window.api.getConfig();
    if (config.PRINT) {
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

  async triggerPrint() {
    const config = await window.api.getConfig();
    if (!this.currentPrintFilepath || this.printButton.disabled || !config.PRINT) return;

    this.printButton.disabled = true;
    this.newPhotoButton.disabled = true;
    this.reviewControls.classList.add('hidden');
    this.reviewStatus.classList.remove('hidden');

    window.api.printImage(this.currentPrintFilepath);
  }

  async closeReviewScreen() {
    this.isReviewActive = false;
    this.reviewScreen.classList.add('hidden');

    if (this.reviewImageUrl) {
      URL.revokeObjectURL(this.reviewImageUrl);
      this.reviewImageUrl = null;
      this.reviewImage.src = '';
    }

    this.currentPrintFilepath = null;

    // Reset buttons state
    this.setButtonState(await window.api.getTranslation('capture'), false);
    this.captureButton.disabled = false;

    // Restart stream
    window.api.cameraStartStream();
  }
}

window.Controller = Controller;

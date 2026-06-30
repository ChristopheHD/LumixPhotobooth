'use strict';
require("./config");
var $ = require("jquery");
var Lumix = require("./Lumix");

var canvas = document.querySelector('#canvas');
var context = canvas.getContext('2d');

class Controller {
  constructor() {
    var camera = new Lumix();

    camera.initialize();
    camera.startStream();

    this.camera = camera;

    this.imageObj = new Image();

    // Elements
    this.captureButton = document.getElementById('captureButton');
    this.countdownElement = document.getElementById('countdown');
    this.flashElement = document.getElementById('flash');

    //Attach events
    if (this.captureButton) {
      this.captureButton.addEventListener('click', () => this.startCountdown());
    }

    this.render();

  }

  startCountdown() {
    if (this.isCountingDown) return;
    this.isCountingDown = true;

    var count = 3;
    if (this.captureButton) {
      this.captureButton.disabled = true;
      this.captureButton.textContent = "🎂 Preparing...";
    }

    if (this.countdownElement) {
      this.countdownElement.classList.remove('hidden');
      this.countdownElement.textContent = count;
    }

    var interval = setInterval(() => {
      count--;
      if (count > 0) {
        if (this.countdownElement) {
          this.countdownElement.textContent = count;
        }
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
    this.displayImage(this.camera.getPreviewImage());

    requestAnimationFrame(this.render.bind(this));
  }

  displayImage(imgData) {
    if(imgData){
      // console.log('Displaying image data, length:', imgData.length);
      this.imageObj.onload = function() {
        context.drawImage(this, 0, 0, this.width, this.height, 0, 0, canvas.width, canvas.height);
      };
      this.imageObj.src = "data:image/jpg;base64," + imgData;
    }
  }

  capture() {
    this.captureButton.disabled = true;
    this.captureButton.textContent = "🎂 Capturing...";

    this.camera.capture((err, ok)=>{
      if(err){
        this.captureButton.disabled = false;
        this.captureButton.textContent = "Capture";
        return;
      }

      // Attempt to download last photo taken
      this.attempt((cb)=>{
        this.camera.getLastPhoto(cb);
      }, (err, data)=>{

        this.captureButton.disabled = false;
        this.captureButton.textContent = "Capture";

        if(err){
          console.error("Failed to download last photo from camera:", err);
          this.camera.startStream();
          return;
        }

        // Save photo
        console.log("Photo downloaded from camera, starting browser download...");
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
    fn((err, res)=>{
      if(err){
        //Retry
        if(tries == 0){
          return callback(err, res);
        }else{
          return this.attempt(fn, callback, tries - 1);
        }
      }
      return callback(err, res);
    });
  }

}

module.exports = Controller;

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  wifiCheckInitial: () => ipcRenderer.invoke('wifi-check-initial'),
  wifiScan: () => ipcRenderer.invoke('wifi-scan'),
  wifiConnect: (ssid) => ipcRenderer.invoke('wifi-connect', ssid),

  cameraInit: () => ipcRenderer.invoke('camera-init'),
  cameraCapture: () => ipcRenderer.invoke('camera-capture'),
  cameraStopStream: () => ipcRenderer.invoke('camera-stop-stream'),
  cameraStartStream: () => ipcRenderer.invoke('camera-start-stream'),

  getConfig: () => ipcRenderer.invoke('get-config'),
  getTranslation: (key, options) => ipcRenderer.invoke('get-translation', key, options),

  printImage: (filepath) => ipcRenderer.send('print-image', filepath),

  onCameraPreview: (callback) => {
    // We get a Node.js Buffer over IPC, which comes across as a Uint8Array in the renderer
    const subscription = (event, imgData) => callback(imgData);
    ipcRenderer.on('camera-preview', subscription);
    return () => {
      ipcRenderer.removeListener('camera-preview', subscription);
    };
  },

  onPrintFinished: (callback) => {
    const subscription = (event, success, error) => callback(success, error);
    ipcRenderer.on('print-finished', subscription);
    return () => {
      ipcRenderer.removeListener('print-finished', subscription);
    };
  }
});

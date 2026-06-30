'use strict';
const dgram = require('dgram');

// This is for the live preview
class LumixServer {
  constructor() {
    this.imageData = null;
    this.socket = dgram.createSocket('udp4');
    this.count = 0;

    var self = this;
    this.socket.on('message', function (msg, rinfo) {
      self.messageHandler(msg, rinfo);
    });

    this.socket.on('listening', function () {
      console.log('UDP Server listening on port:', global.PORT);
    });

    this.socket.on('error', (err) => {
      console.error('UDP Server error:', err);
    });

    this.socket.bind(global.PORT);
  }

  messageHandler(msg, rinfo) {
    if (this.count % 100 === 0) {
      console.log('Received UDP packet from:', rinfo.address, 'length:', msg.length, 'total packets:', this.count);
    }
    //Get offset from header
    var offset = 144;
    for (var i = 0; i < 320; i++) {
      if (msg[i] == 0xFF && msg[i + 1] == 0xD8) {
        offset = i;
        break;
      }
    }

    var jpgData = Buffer.alloc(msg.length - offset);
    msg.copy(jpgData, 0, offset);

    this.imageData = jpgData.toString('base64');
    this.count++;

    // console.log(this.count);
  }
}

module.exports = LumixServer;

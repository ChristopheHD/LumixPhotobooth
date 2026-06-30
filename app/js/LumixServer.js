'use strict';
const dgram = require('dgram');

// This is for the live preview
class LumixServer {
  constructor() {
    this.imageData = null;
    this.socket = dgram.createSocket('udp4');
    this.count = 0;

    // Bolt optimization: Pre-allocate a buffer for image data to reduce GC pressure.
    // Standard Lumix preview images are around 640x480 or smaller, usually < 100KB.
    // 512KB is a safe upper bound.
    this.imageBuffer = Buffer.allocUnsafe(512 * 1024);
    this.imageLength = 0;

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
    //Get offset from header
    var offset = 144;
    for (var i = 0; i < 320; i++) {
      if (msg[i] === 0xFF && msg[i + 1] === 0xD8) {
        offset = i;
        break;
      }
    }

    // Bolt optimization: Avoid Buffer.alloc and .toString('base64') which are expensive.
    // Instead, copy into pre-allocated buffer and store the buffer itself.
    const jpgLength = msg.length - offset;
    if (jpgLength > this.imageBuffer.length) {
      // Emergency resize if image is unexpectedly large
      this.imageBuffer = Buffer.allocUnsafe(jpgLength + 64 * 1024);
    }

    msg.copy(this.imageBuffer, 0, offset);
    this.imageLength = jpgLength;

    // We store a slice. Note: Buffer.slice() in older Node (or subarray in newer)
    // doesn't copy the memory, it just creates a view.
    this.imageData = this.imageBuffer.subarray(0, this.imageLength);

    this.count++;
  }
}

module.exports = LumixServer;

'use strict';
const dgram = require('dgram');

const JPEG_MAGIC = Buffer.from([0xFF, 0xD8]);

// This is for the live preview
class LumixServer {
  constructor() {
    this.imageData = null;
    this.socket = dgram.createSocket('udp4');
    this.count = 0;

    // Bolt optimization: Use double buffering to prevent data corruption
    // without the overhead of Buffer.from() on every frame.
    const BUFFER_SIZE = 512 * 1024; // 512KB
    this.buffers = [
      Buffer.allocUnsafe(BUFFER_SIZE),
      Buffer.allocUnsafe(BUFFER_SIZE)
    ];
    this.activeBufferIndex = 0;
    this.imageLength = 0;

    const self = this;
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
    let offset = 144;

    // Bolt optimization: Use C++ backed Buffer.indexOf instead of V8 JS loop for high frequency UDP packet parsing
    const foundOffset = msg.indexOf(JPEG_MAGIC);
    if (foundOffset !== -1 && foundOffset < 320) {
      offset = foundOffset;
    }

    // Bolt optimization: Avoid Buffer.alloc and .toString('base64') which are expensive.
    // Instead, copy into the currently inactive buffer (double buffering).
    const jpgLength = msg.length - offset;
    const nextBufferIndex = (this.activeBufferIndex + 1) % 2;
    let targetBuffer = this.buffers[nextBufferIndex];

    if (jpgLength > targetBuffer.length) {
      // Emergency resize if image is unexpectedly large
      targetBuffer = Buffer.allocUnsafe(jpgLength + 64 * 1024);
      this.buffers[nextBufferIndex] = targetBuffer;
    }

    msg.copy(targetBuffer, 0, offset);
    this.imageLength = jpgLength;

    // Switch buffers: imageData now points to the newly filled buffer,
    // while the socket will write to the other one next time.
    this.imageData = targetBuffer.subarray(0, this.imageLength);
    this.activeBufferIndex = nextBufferIndex;

    this.count++;
  }
}

module.exports = LumixServer;

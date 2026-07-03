const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const fs = require('fs');

//Limit file rape
let writeCount = 0;
const writeAmount = 200;

server.on('message', function(msg, rinfo) {
  if(writeCount < writeAmount){
    //Get offset from header
    let offset = 144;
    for (let i = 0; i < 320; i++){
      if (msg[i] == 0xFF && msg[i+1] == 0xD8){
        offset = i;
        break;
      }
    }

    const jpgData = new Buffer(msg.length - offset);
    msg.copy(jpgData, 0, offset);

    fs.writeFile('./video/stream_' + writeCount + '.jpg',
      jpgData, function(err) {
      if(err) {
        return console.log(err);
      }
      console.log('The file was saved!');
    });

  }
    writeCount++;
});

server.on('listening', function() {
  const address = server.address();
  console.log('server listening', address);
});

server.bind(49473);





'use strict';

var http = require('http');
var parseString = require('xml2js').parseString;

var LumixServer = require('./LumixServer');

var lumixAddress = '192.168.54.1';
const deviceName = 'DMC-G7';
const deviceId = '4D454930-0100-1000-8000-F02765BACACE';

const init = '/cam.cgi?mode=accctrl&type=req_acc&value=' + deviceId + '&value2=' + deviceName;
const recmode = '/cam.cgi?mode=camcmd&value=recmode';
const playmode = '/cam.cgi?mode=camcmd&value=playmode';
const capture = '/cam.cgi?mode=camcmd&value=capture';
const capture_cancel = '/cam.cgi?mode=camcmd&value=capture_cancel';
const startstream = '/cam.cgi?mode=startstream&value=' + global.PORT;
const stopstream = '/cam.cgi?mode=stopstream';
const getstate = '/cam.cgi?mode=getstate';

const get_content_info = '/cam.cgi?mode=get_content_info';

const imageUrl = 'http://' + lumixAddress + ':50001/';

class Lumix {
  constructor() {
    this.server = new LumixServer();
    this.capturing = false;
    this.heartBeatCount = 0;
  }

  getPreviewImage() {
    return this.server.imageData;
  }

  getBinary(path, cb) {
    this.getRequest(path, function (err, res) {
      if (cb)
        cb(err, res);
    }, true);
  }

  getRequest(path, cb, bin) {
    try {
      var options = {
        host: lumixAddress,
        port: (bin ? 50001 : 80),
        path: path,
      };

      let callback = function (response) {
        if (response.statusCode !== 200) {
          console.log('Response Status:', response.statusCode, 'from:', options.path);
        }
        if (cb) {
          if (bin) {
            var binData = [];
            response.on('data', function (chunk) {
              binData.push(chunk);
            }).on('end', function () {
              var buffer = Buffer.concat(binData);
              cb(null, buffer);
            });
          }else {
            var textData = [];
            response.on('data', function (chunk) {
              textData.push(chunk);
            }).on('end', function () {
              var str = Buffer.concat(textData).toString('utf8');
              cb(null, str);
            });
          }
        }
      };

      var req = http.request(options, callback);
      req.on('error', function (err) {
        console.log('HTTP Request Failed for', options.path, ':', err.message);
        cb(err);
      });

      req.end();
    }catch (e) {
      console.log('Error in getRequest:', e);
      cb && cb('Get request failed');
    }
  }

  sendLumix(path, cb) {
    this.getRequest(path, function (err, str) {
      if (err) {
        console.error('Lumix Error for', path, ':', err);
      }
      if (cb) {
        if (err) {
          return cb(err, str);
        }

        try {
          parseString(str, function (err, result) {
            cb(err, result);
          });
        }catch (e) {
          console.log('Failed parsing: ', e.stack);
          cb('Failed parsing');
        }
      }
    });
  }

  initialize() {
    this.sendLumix(init);
    this.startHeartbeat();
  }

  startStream() {
    this.sendLumix(recmode, (err, result)=> {
      this.sendLumix(startstream);
    });
  }

  stopStream() {
    this.sendLumix(stopstream);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.isHeartbeatActive = true;

    // Bolt optimization: Use chained setTimeout instead of setInterval
    // to prevent network requests from piling up and causing CPU/socket lockups on slow connections.
    const runHeartbeat = () => {
      if (!this.isHeartbeatActive) return;

      if (!this.downloading && !this.capturing) {
        let pendingRequests = 2;
        const checkDone = () => {
          pendingRequests--;
          if (pendingRequests === 0) {
            this.timer = setTimeout(runHeartbeat, 1000);
          }
        };

        this.sendLumix(getstate, checkDone);
        this.sendLumix(recmode, checkDone);

        if (this.heartBeatCount > 60) {
          //send every once in a while
          pendingRequests++;
          this.sendLumix(init, checkDone);
          this.heartBeatCount = 0;
        }

        this.heartBeatCount++;
      } else {
        // If downloading or capturing, just check again in 1s
        this.timer = setTimeout(runHeartbeat, 1000);
      }
    };

    runHeartbeat();
  }

  stopHeartbeat() {
    this.isHeartbeatActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  captureBurst(callback, timeout){
    // capture_cancel
    let _this = this;
    if (_this.capturing) {
      if (callback) callback('Currently capturing');
      return;
    }

    _this.capturing = true;
    _this.sendLumix(recmode, function (err, result) {
      if (callback) {
        if (err) {
          _this.capturing = false;
          return callback(err);
        }

        //Run async
        _this.sendLumix(capture);

        //Stop capture
        setTimeout(function(){
          _this.sendLumix(capture_cancel);
          _this.capturing = false;
          callback(null, true);
        }, timeout);
      }else {
        _this.sendLumix(capture, function () {
          _this.capturing = false;
        });
      }
    });
  }

  capture(callback) {
    let _this = this;
    if (_this.capturing) {
      if (callback) callback('Currently capturing');
      return;
    }

    _this.capturing = true;
    _this.sendLumix(recmode, function (err, result) {
      if (callback) {
        if (err) {
          _this.capturing = false;
          return callback(err);
        }

        //Run async
        _this.sendLumix(capture);

        //Change this to set interval to check for 5 seconds
        var maxTime = 6000;
        var checkFrequency = 70;
        var sdFlag = false;

        var timeStart = Date.now();

        //check with timer instead of attempts here

        var checkImageCount = function () {
          _this.sendLumix(getstate, function (err, result) {
            if (err) {
              _this.capturing = false;
              return callback(err);
            }

            if (result.camrply.state && result.camrply.state[0] && result.camrply.state[0].sd_access) {
              var sdAccess = result.camrply.state[0].sd_access == 'on';

              if (sdFlag && !sdAccess) {
                //Done Writing
                _this.capturing = false;
                return callback(null, true);
              }else {
                sdFlag = sdAccess;
              }
            }

            if ((Date.now() - timeStart) > maxTime) {
              //Failed to take photo
              _this.capturing = false;
              return callback('Failed to take photo');
            }else {
              setTimeout(checkImageCount, checkFrequency);
            }
          });
        };

        checkImageCount();

      }else {
        _this.sendLumix(capture, function () {
          _this.capturing = false;
        });
      }
    });
  }

  getLastPhotoId(callback) {
    let _this = this;
    _this.downloading = true;
    _this.sendLumix(playmode, function (err, result) {
      if (err) {
        _this.downloading = false;
        return callback(err);
      }

      //Wait before getting content
      setTimeout(()=> {
        _this.sendLumix(get_content_info, function (err, result) {
          if (err) {
            _this.downloading = false;
            return callback(err);
          }

          var contentNumber = parseInt(result.camrply.total_content_number[0]);
          callback(null, contentNumber);
        });
      }, 500);
    });
  }

  getLastPhoto(callback) {
    let _this = this;
    _this.downloading = true;
    _this.sendLumix(playmode, function (err, result) {
      if (err) {
        _this.downloading = false;
        return callback(err);
      }

      setTimeout(() => {
        _this.sendLumix(get_content_info, function (err, result) {
          if (err) {
            _this.downloading = false;
            return callback(err);
          }

          var totalContentNumber = parseInt(result.camrply.total_content_number[0]);
          // Browse last content (index is 0-based in some implementations, but lumix.c uses total-1)
          _this.browseContent(totalContentNumber - 1, 1, (err, didl) => {
            if (err) {
              _this.downloading = false;
              return callback(err);
            }

            try {
              const item = didl['DIDL-Lite'].item[0];
              const resources = item.res;
              let selectedUrl = null;

              // Find resource matching preferred size
              const preferred = global.preferredImageSize || 'CAM_ORG';
              for (const res of resources) {
                const protocolInfo = res.$.protocolInfo;
                if (protocolInfo.includes('PANASONIC.COM_PN=' + preferred)) {
                  selectedUrl = res._;
                  break;
                }
              }

              // Fallback to first resource if preferred not found
              if (!selectedUrl && resources.length > 0) {
                selectedUrl = resources[0]._;
              }

              if (!selectedUrl) {
                _this.downloading = false;
                return callback('No image URL found in SOAP response');
              }

              // Parse URL to get path and port
              const urlObj = new URL(selectedUrl);
              const path = urlObj.pathname;
              // Port is usually 50001, already handled by getBinary if bin is true
              // but we should ideally use the port from the URL.
              // For simplicity, we just use the path as getBinary assumes 50001 for bin=true.

              _this.getBinary(path, function (err, result) {
                _this.downloading = false;
                return callback(err, result);
              });

            } catch (e) {
              console.error('Failed to parse DIDL-Lite:', e);
              _this.downloading = false;
              callback('Failed to parse discovery response');
            }
          });
        });
      }, 1000); // 1s wait after playmode
    });
  }

  browseContent(index, count, callback) {
    const soapMsg = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1" xmlns:pana="urn:schemas-panasonic-com:pana">
      <ObjectID>0</ObjectID>
      <BrowseFlag>BrowseDirectChildren</BrowseFlag>
      <Filter>*</Filter>
      <StartingIndex>${index}</StartingIndex>
      <RequestedCount>${count}</RequestedCount>
      <SortCriteria></SortCriteria>
      <pana:X_FromCP>LumixLink2.0</pana:X_FromCP>
    </u:Browse>
  </s:Body>
</s:Envelope>`;

    this.soapRequest('/Server0/CDS_control', 'urn:schemas-upnp-org:service:ContentDirectory:1#Browse', soapMsg, (err, result) => {
      if (err) return callback(err);

      try {
        // Result is nested XML inside <Result> tag
        const resultXml = result['s:Envelope']['s:Body'][0]['u:BrowseResponse'][0].Result[0];
        parseString(resultXml, { explicitArray: true }, callback);
      } catch (e) {
        callback('Failed to parse SOAP BrowseResponse');
      }
    });
  }

  soapRequest(path, action, body, cb) {
    try {
      const options = {
        host: lumixAddress,
        port: 60606, // Default for CDS_control
        path: path,
        method: 'POST',
        headers: {
          'SOAPAction': `"${action}"`,
          'Content-Type': 'text/xml; charset="utf-8"',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = http.request(options, (response) => {
        let data = [];
        response.on('data', (chunk) => data.push(chunk));
        response.on('end', () => {
          let str = Buffer.concat(data).toString('utf8');
          if (response.statusCode !== 200) {
            console.log('SOAP Response Status:', response.statusCode, 'Body:', str);
            return cb('SOAP error ' + response.statusCode);
          }
          parseString(str, cb);
        });
      });

      req.on('error', (err) => {
        console.log('SOAP Request Failed:', err.message);
        cb(err);
      });

      req.write(body);
      req.end();
    } catch (e) {
      cb(e);
    }
  }
}

module.exports = Lumix;

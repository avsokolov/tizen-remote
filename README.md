# Samsung smart tv 2016+ models remote control over Wi-Fi

## Instalation
```
npm install tizen-remote
```

## Usage

```
  const tv = require('tizen-remote');
  
  //basic initialisation
  let token;
  let mac;
  tv.onTokenUpdate(newToken => {
    //you can save it premanenty and use anytime later
    token = newToken;
  });
  tv.init({
    pairingName: 'MyServiceName', //name, displayed on tv while pairing request
    ip: '192.168.0.100',          //tv ip address (required)
  });
  
  //turn on tv and get device information
  tv.isOn()
    .then(on => {
      if (on) {
        return tv.getInfo();
      } else {
        console.log('can not remoutly turn tv on without mac address');
      }
    })
    .then(info => {
      if (info) {
        console.log(info);
        mac = info.device.wifiMac; //tv WiFi interface mac address (necessary to turn tv on)
      }
    })
    .catch(err => {
      console.log(err);
    });
    
  ...
  
  //initialisation with auth-token
  tv.init({
    pairingName: 'MyServiceName', //name, displayed on tv while pairing request
    ip: '192.168.0.100',          //tv ip address (required)
    mac: mac,
    authToken: token
  });
  
  ...
  //Open a YouTube video on tv
  const search = require('youtube-search');

  search('An awesome video', {
    maxResults: 1, 
    key: 'AIzaSyBMxXBwRtFjCRv-sb82ZXVpZuYHX26Z5oU', 
    type: 'video'
  }, res => openYoutube(res[0].id));
  
  function openYoutube(videoId) {
    tv.isOn()
      .then(on => {
        if (!on) {
          return tv.turnOn();
        }
      })
      .then(() => tv.getAppList())      
      .then(apps => {
        if (apps.youtube) {
          return tv.getAppInfo(apps.youtube.id)
        }
      })
      .then(youtube => {
        if (youtube) {
          if (youtube.running) {
            console.log('YouTube already opened');
          }
          
          return tv.openApp(youtube.id, videoId);
        } else {
          return tv.openURL(`https://www.youtube.com/watch?v=${videoId}`);
        }
      })
      .catch(err => console.log(err));
    }
```

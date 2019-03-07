# Samsung smart tv 2016+ models remote control over Wi-Fi

## Instalation
```
npm install tizen-remote
```

## Usage

```
  const tv = require('tizen-remote');
  const search = require('youtube-search');
  
  tv.init({
    pairingName: 'MyServiceName', //name, displayed on tv while pairing request
    ip: '192.168.0.100',          //tv ip address (required)
    mac: '00:00:00:00:00:00',     //tv mac address (optional, necessary to turn tv on)
    authToken: '34324324'         //service authentication token (optional). If it's not set, service will request it on first connection
  });
  
  ...
  //turn on tv and get device information
  tv.isOn()
    .then(on => {
      if (!on) {
        return tv.turnOn();
      }
    })
    .then(() => tv.getInfo())
    .then(console.log)
    .catch(err => {
      console.log(err);
      tv.turnOff();
    });

  ...
  //Open a YouTube video on tv
  search('An awesome video', {
    maxResults: 1, 
    key: 'AIzaSyBMxXBwRtFjCRv-sb82ZXVpZuYHX26Z5oU', 
    type: 'video'
  }, res => openYoutube(res[0].id));
  
  function openYoutube(videoId) {
    tv.getAppList()
      .then(apps => {
        if (apps.youtube) {
          return tv.getAppInfo(apps.youtube)
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

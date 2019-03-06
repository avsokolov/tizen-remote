# Samsung smart tv 2016+ models remote control over Wi-Fi

## Instalation
```
npm install tizen-remote
```

## Usage

```
  const tv = require('tizen-remote');
  
  tv.init({
    pairingName: 'MyServiceName', //name, displayed on tv while pairing request
    ip: '192.168.0.100',          //tv ip address (required)
    mac: '00:00:00:00:00:00',     //tv mac address (optional, necessary to turn tv on)
    authToken: '34324324'         //service authentication token (optional). If it's not set, service will request it on first connection
  });
  
  ...
  tv.isOn()
    .then(on => {
      if (!on) {
        return tv.turnOn();
      }
    })
    .then(() => tv.getInfo())
    .then(console.log)
    .then(() => tv.getAppList())
    .then(apps => {
      if (apps.youtube) {
        return tv.getAppInfo(apps.youtube)
      }
    })
    .then(youtube => {
      if (!youtube.runnig) {
        retunr tv.getAppInfo(youtube.id);
      }
    })
    .then(youtube => {
      if (youtube) {
        if (!youtube.running) {
          return tv.openApp(youtube.id);
        } else {
          console.log('Already opened');
        }
      } else {
        return tv.openURL('https://www.youtube.com/');
      }
    })
    .catch(err => {
      console.log(err);
      tv.turnOff();
    });
```

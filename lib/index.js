const {exec} = require('child_process');

const wol = require('wol');

const { SocketAdapter } = require('./socket-adapter');
const { request, delay } = require('./utils');
const { PING_TIMEOUT, COMMAND_TIMEOUT, COMMAND_DELAY } = require('./constants');

module.exports = class TizenRemote {
    constructor() {
        this.config = {
            ip: '',
            pairingName: 'SmartTvService'
        };
        this.resetState();
    }

    init(config) {
        this.config = Object.assign(this.config, config);
        this._ws = new SocketAdapter(this.config.ip, this.config.pairingName, this.config.authToken, this.config.logger);
        this.resetState();
        this._ws.on('disconnect', () => {
            this._state = false;
        });
        this._ws.on('connect', () => {
            this._state = true;
        });

        return this.isOn()
            .then(state => {
                this._state = state;

                if (state) {
                    return this._ws.connect();
                }
            })
            .then(() => {
                if (this._state) {
                    return this.getInfo();
                }
            });
    }

    onTokenUpdate(callback) {
        if (this._ws) {
            this._ws.on('tokenUpdate', callback);
        } else {
            throw new Error('Config si not provided');
        }
    }

    resetState() {
        if (this._ws) {
            this._ws.disconnect();
        }
        this._apps = null;
        this._info = null;
    }

    async getAppList() {
        if (!this._apps) {
            await this._requestApps();
        }

        return Object.keys(this._apps).reduce((apps, appId) => {
            apps[this._apps[appId].name.toLocaleLowerCase()] = this._apps[appId];
            return apps;
        }, {});
    }

    getAppInfo(appId) {
        return this.isOn()
            .then(status => {
                if (!status) {
                    throw new Error('Tv is off');
                }
            })
            .then(() => request(`http://${this.config.ip}:8001/api/v2/applications/${appId}`));
    }

    getInfo() {
        if (this._info) {
            return Promise.resolve(this._info);
        }

        return request(`http://${this.config.ip}:8001/api/v2/`)
            .then(response => {
                this._info = response;
                return response;
            });
    }

    async openApp(appId, args = null) {
        if (!this._apps) {
            await this._requestApps();
        }

        if (!this._apps[appId]) {
            throw new Error('App is not installed');
        }

        const request = {
            method: 'ms.channel.emit',
            params: {
                to: 'host',
                event: 'ed.apps.launch',
                data: {
                    action_type: this._apps[appId].appType === 2 ? 'DEEP_LINK' : 'NATIVE_LAUNCH',
                    appId: appId
                }
            }
        };

        if (args) {
            request.params.data.metaTag = args;
        }

        return new Promise((resolve, reject) => {
            this._ws.once('ed.apps.launch', () => resolve());
            this._ws._sendWS(request).catch(reject);
            setTimeout(() => reject('App launch timeout'), COMMAND_TIMEOUT);
        });
    }

    turnOn() {
        return this
            .isOn()
            .then(status => {
                if (status && this._state) {
                    //looks like it is ON
                    return Promise.resolve();
                }

                // Is TV is OFF but it still takes commands?
                if (status && !this._state) {
                    this._state = true;
                    return this.sendCmd('KEY_POWER');
                }

                this._state = status;

                if (!this.config.mac) {
                    throw new Error('Can not turn on TV without mac address');
                }

                return new Promise((resolve, reject) => {
                    // TV is OFF and we need to use WOL
                    wol.wake(this.config.mac, (error) => {
                        if (error) {
                            return reject('Failed to power on TV');
                        } else {
                            if (this.config.logger) {
                                this.config.logger.info('wake on lan success');
                            }
                            this._ws.connect().then(resolve).catch(reject);
                        }
                    });
                });
            });
    }

    turnOff() {
        if (this._state) {
            this._state = false;
            return this.isOn().then(status => {
                if (status) {
                    return this.sendCmd('KEY_POWER');
                }
            });
        }

        return Promise.resolve();
    }

    setChannel(channel) {
        if (isNaN(parseInt(channel))) {
            return Promise.reject('Invalid channel number');
        }

        const commands = channel.toString().split('').map(num => `KEY_${num}`);
        commands.push('KEY_ENTER');

        return this.sendCmd(commands);
    }

    sendCmd(commands) {
        if (!Array.isArray(commands)) { commands = [commands]; }

        if (!this.commandPromise) {
            this.commandPromise = Promise.resolve();
        }

        commands.forEach(command => {
            this.commandPromise = this.commandPromise
                .then(() => this._sendOneKey(command))
                .then(() => delay(COMMAND_DELAY));
        });

        return this.commandPromise;
    }

    openUrl(url) {
        return new Promise((resolve, reject) => {
            this._ws.once('ed.apps.launch', () => resolve());

            this._ws._sendWS({
               method : 'ms.channel.emit',
               params : {
                   event: 'ed.apps.launch',
                   to: 'host',
                   data: {
                       appId: 'org.tizen.browser',
                        action_type:'NATIVE_LAUNCH',
                        metaTag: url
                    }
                }
            }).catch(reject);

            setTimeout(() => reject('Browser launch timeout'), COMMAND_TIMEOUT);
        });
    }

    isOn() {
        return new Promise(resolve => {
            // Check if host is online
            exec(`ping -t 1 -c 1 ${this.config.ip}`, (error) => {
                // Resolve or show error
                resolve(!error);
            });

            // Close fast if no answer
            setTimeout(resolve.bind(null, false), PING_TIMEOUT);
        });
    }

    _requestApps() {
        return new Promise((resolve, reject) => {
            this._ws.once('ed.installedApp.get', (event) => {
                this._apps = event.data.data.reduce((apps, app, num) => {
                    apps[app.appId] = {
                        name: app.name,
                        id: app.appId,
                        appType: app.app_type,
                        isLocked: app.is_lock,
                        orderId: num
                    };

                    return apps;
                }, {});

                resolve();
            });


            this._ws._sendWS({
                method: 'ms.channel.emit',
                params: {
                    data: '',
                    to: 'host',
                    event: 'ed.installedApp.get'
                }
            }).catch(reject);
        });
    }

    _sendOneKey(key) {
        return this._ws._sendWS({
            method : 'ms.remote.control',
            params : {
                Cmd: 'Click',
                DataOfCmd: key,
                Option: false,
                TypeOfRemote: 'SendRemoteKey'
            }
        });
    }
};

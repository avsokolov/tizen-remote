const EventEmitter = require('events');
const WebSocket = require('ws');

const {WS_PORT, WS_CHECK_TIMEOUT, WS_CHECK_INTERVAL} = require('./constants');

class SocketAdater extends EventEmitter {
    constructor(ip, serviceName, token = null, logger = null) {
        super();
        this._ip = ip;
        this._serviceName = serviceName;
        this._token = token;
        this._logger = logger;

        this._ws = null;
        this._connectionPromise = null;

        this._pingTimeout = () => {
            if (!this._ws) return;

            if (this._logger) {
                this._logger.warn('Socket ping timeout. Closing socket...');
            }

            this._ws.close();
            this._ws = null;
            clearTimeout(this._pingTimer);
        };
    }

    connect() {
        if (this._ws && !this._connectionPromise) {
            return Promise.resolve();
        }

        if (!this._connectionPromise) {
            this._connectionPromise = new Promise(async (resolve, reject) => {
                const onConnectionError = (reason) => {
                    if (this._connectionPromise) {
                        this._connectionPromise = null;
                        clearTimeout(openTimer);
                        if (this._ws) {
                            this._ws.close();
                        }

                        reject(reason);
                    }
                };

                const openTimer = setTimeout(() => onConnectionError('Socket opening timeout'), WS_CHECK_TIMEOUT);

                // Start connection
                const name = Buffer.from(this._serviceName).toString('base64');
                let wsEndpoint = `wss://${this._ip}:${WS_PORT}/api/v2/channels/samsung.remote.control?name=${name}`;

                if (this._token) {
                    wsEndpoint += `&token=${this._token}`;
                }

                this._ws = new WebSocket(wsEndpoint, {
                    rejectUnauthorized: false
                });

                // When the socket has an error
                this._ws.on('error', onConnectionError);

                // When the socket is closed
                this._ws.on('close', () => {
                    if (this._ws) {
                        this._ws = null;
                        clearTimeout(this._pingTimer);
                        this.emit('disconnected');
                    }
                });

                // When the socket is open
                this._ws.on('message', data => {
                    // Parse response
                    const response = JSON.parse(data);

                    // We are connected
                    if (response.event === 'ms.channel.connect') {
                        this._clientId = response.data.id;
                        this.emit('connected', this._clientId);

                        // Save token if updated
                        if (response.data.token) {
                            this._token = response.data.token;
                            this.emit('tokenUpdate', this._token);
                        }

                        this._ping();
                        this._connectionPromise = null;

                        if (this._connectionPromise) {
                            this._connectionPromise = null;
                            clearTimeout(openTimer);
                            resolve();
                        }
                    } else {
                        this.emit(response.event, response);
                        // Other response
                        if (this._logger) {
                            this._logger.info('WS event:\n'+data);
                        }

                        if (this._connectionPromise) {
                            onConnectionError(error);
                        }
                    }
                });
            });
        }

        return this._connectionPromise;
    }

    disconnect() {
        if (this._ws) {
            this._ws.close();
            clearTimeout(this._pingTimer);
            clearTimeout(this._connectionTimer);
        }
    }

    _ping() {
        if (!this._ws) return;

        this._connectionTimer = setTimeout(this._pingTimeout, WS_CHECK_TIMEOUT);

        this.once('_ping', (event) => {
            if (event.from === this._clientId) {
                clearTimeout(this._connectionTimer);
                this._pingTimer = setTimeout(() => this._ping(), WS_CHECK_INTERVAL);
            }
        });

        this._sendWS({
            method:'ms.channel.emit',
            params: {
                event: '_ping',
                data: new Date().toISOString(),
                to: this._clientId
            }
        });
    }

    _sendWS(data) {
        return this.connect()
            .then(() => new Promise((resolve, reject) => {
                this._ws.send(JSON.stringify(data), error => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                })
            }));
    }
}

module.exports = {SocketAdapter: SocketAdater};

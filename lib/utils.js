/*
 * Copyright (c) New Cloud Technologies, Ltd., 2013-2019
 *
 * You can not use the contents of the file in any way without New Cloud Technologies, Ltd. written permission.
 * To obtain such a permit, you should contact New Cloud Technologies, Ltd. at http://ncloudtech.com/contact.html
 *
 */
const req = require('request');

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}

function request(url) {
    return new Promise((resolve, reject) => {
        req(url, (error, data, body) => {
            if (error) {
                reject(error);
                return;
            }

            if (!data) {
                reject('wrong response from TV');
                return;
            }

            if (data.statusCode !== 200) {
                reject('wrong response code from TV: ' + data.statusCode);
                return;
            }

            try {
                const response = JSON.parse(body);
                processResponse(response);
                resolve(response);
            } catch (err) {
                reject('error while parse response from tv: ' + err);
            }
        });
    });
}

function processResponse(response) {
    Object.keys(response).forEach(key => {
        if (typeof response[key] === 'string') {
            try {
                response[key] = JSON.parse(response[key]);
            } catch (ex) {}
        }

        if (typeof response[key] === 'object') {
            processResponse(response[key]);
        }
    });
}

module.exports = {request, delay};

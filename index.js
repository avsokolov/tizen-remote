const TizenRemote = require('./lib');

module.exports = {
    tv: new TizenRemote(),
    KEYS: require('./lib/keys')
} ;

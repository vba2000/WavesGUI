(function () {
    'use strict';

    /**
     * @return postmessageStorage
     */
    const factory = function () {

        class PostMessageStorage {

            /**
             * @type {Bus|null}
             */
            static storage = null;
            /**
             * @type {User}
             */
            user;
            /**
             * @type {Promise<any>}
             */
            readyPromise;

            /**
             * @return {Bus}
             * @private
             */
            static _getStorage() {
                if (!PostMessageStorage.storage) {
                    PostMessageStorage.storage = _getStorageApi();
                }

                return PostMessageStorage.storage;
            }

            /**
             * @param {string} key
             * @return {Promise<T | never>}
             */
            read(key) {
                return this.readyPromise
                    .then(() => JSON.parse(this._data[key]))
                    .catch(() => this._data[key]);
            }

            /**
             * @param {string} key
             * @param {any} value
             * @return {Promise<any | never>}
             */
            write(key, value) {
                const api = PostMessageStorage._getStorage();
                return this.readyPromise
                    .then(() => api.request('writeData', { [key]: value }))
                    .then((data) => {
                        return data;
                    })
                    .then(data => (this._data = data));
            }

            /**
             * @return {Promise<this | never>}
             */
            clear() {
                const api = PostMessageStorage._getStorage();
                return this.readyPromise
                    .then(() => api.dispatchEvent('clearData'));
            }

            /**
             * @return {PostMessageStorage}
             */
            init() {
                const api = PostMessageStorage._getStorage();

                this.readyPromise = new Promise((resolve) => {
                    api.registerRequestHandler('login', (user) => {
                        this._data = { user };
                        resolve();
                        this.user.loginByData(user)
                            .then(() => api.dispatchEvent('loginOk', { status: 'ok' }))
                            .catch(error => api.dispatchEvent('loginError', { status: 'error', error }));

                        return { status: 'ok' };
                    });
                });

                api.once('logout', () => this.user.logout());

                api.registerRequestHandler('demo', (settings) => {
                    return this.user.showDemo(settings);
                });

                api.on('changePair', (data) => {
                    this.user.setSetting('dex.assetIdPair', data);
                });

                api.on('changeList', (list) => {
                    this.user.setSetting('dex.watchlist.list', list);
                });

                api.on('changeFavorite', (favourite) => {
                    this.user.setSetting('dex.watchlist.favourite', favourite);
                });

                api.on('showOnlyFavorite', (canShow) => {
                    this.user.setSetting('dex.watchlist.showOnlyFavorite', canShow);
                });
            }

            /**
             * @param {User} user
             */
            setUser(user) {
                this.user = user;
            }

            _setUserSettings(settings) {
                if (!settings) {
                    return this.clear();
                }

                Object.entries(settings).forEach(([key, value]) => {
                    this.user.setSetting(key, value);
                });
            }

        }

        return new PostMessageStorage();
    };

    angular.module('app.utils').factory('postmessageStorage', factory);

    /**
     * @return {Bus}
     * @private
     */
    function _getStorageApi() {
        const { WindowAdapter, Bus, WindowProtocol } = require('@waves/waves-browser-bus');
        const opener = window.opener || window;
        const origin = opener.location.origin;
        const listen = new WindowProtocol(window, 'listen');
        const dispatch = new WindowProtocol(opener, 'dispatch');
        const adapter = new WindowAdapter([listen], [dispatch], {
            origins: origin,
            chanelId: 'tokenomika-client',
            availableChanelId: 'tokenomika-server'
        });

        return new Bus(adapter);
    }
})();


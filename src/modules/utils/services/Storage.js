(function () {
    'use strict';

    /**
     * @param {$q} $q
     * @param {app.utils} utils
     * @param {Migration} migration
     * @param {State} state
     * @param {storageSelect} storageSelect
     */
    const factory = function ($q, utils, migration, state, storageSelect) {

        const usedStorage = storageSelect();

        usedStorage.init();

        class Storage {

            onReady() {
                return Promise.resolve();
            }

            save(key, value) {
                return utils.when(usedStorage.write(key, value));
            }

            load(key) {
                return utils.when(usedStorage.read(key));
            }

            clear() {
                return utils.when(usedStorage.clear());
            }

            setUser(user) {
                usedStorage.setUser(user);
            }

        }

        return new Storage();
    };

    factory.$inject = ['$q', 'utils', 'migration', 'state', 'storageSelect'];

    angular.module('app.utils')
        .factory('storage', factory);
})();

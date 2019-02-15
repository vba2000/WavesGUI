(function () {
    'use strict';

    const { WindowAdapter, Bus } = require('@waves/waves-browser-bus');
    const adapter = new WindowAdapter(
        { win: window.opener || window, origin: location.origin },
        { win: window, origin: '*' }
    );

    const api = new Bus(adapter);
    const state = JSON.parse(localStorage.getItem('data')) || {
        user: {
            address: '3PCAB4sHXgvtu5NPoen6EXR5yaNbvsEA8Fj',
            publicKey: '2M25DqL2W4rGFLCFadgATboS8EPqyWAN3DjH12AH5Kdr',
            userType: 'wavesKeeper',
            settings: {
                dex: {
                    showOnlyFavorite: false,
                    assetIdPair: { amount: 'WAVES', price: '2xfiUGhV1pBafY4re5ddzaG5EnSthBhJoWMGKDpcUjAQ' },
                    watchlist: {
                        favourite: [],
                        list: [
                            'WAVES',
                            '2xfiUGhV1pBafY4re5ddzaG5EnSthBhJoWMGKDpcUjAQ'
                        ]
                    }
                }
            }
        }
    };

    function connect(user) {
        return api.request('login', user, 2000)
            .catch(() => {
                return new Promise((res) => setTimeout(() => res(connect(user)), 2000));
            });
    }

    api.once('loginOk', () => {
        state.isLogined = true;
        state.loginError = false;
    });

    api.once('loginError', () => {
        state.isLogined = false;
        state.loginError = true;
    });

    api.registerRequestHandler('writeData', (data) => {
        state.user = data.user;
        localStorage.setItem('data', JSON.stringify(state));
        return state;
    });

    window.changePair = () => {
        api.dispatchEvent('changePair',
            { amount: '9N6Gfy8QQQduVh8wHr8KHp7XrBAdgzQcQ2VstFJaBrp', price: 'WAVES' }
        );
    };

    window.setAssetsList = () => {
        api.dispatchEvent('changeList',
            [
                'WAVES',
                '9N6Gfy8QQQduVh8wHr8KHp7XrBAdgzQcQ2VstFJaBrp',
                '8LQW8f7P5d5PZM7GtZEBgaqRPGSzS3DfPuiXrURJ4AJS'
            ]
        );
    };

    window.setFavouriteList = () => {
        api.dispatchEvent('changeFavorite',
            [
                ['9N6Gfy8QQQduVh8wHr8KHp7XrBAdgzQcQ2VstFJaBrp', 'WAVES']
            ]
        );
    };

    let favourite = false;

    window.toggleFavourite = () => {
        favourite = !favourite;
        api.dispatchEvent('showOnlyFavorite', favourite
        );
    };

    window.showDemo = () => api.request('demo', state.user.settings);

    connect(state.user);
})();


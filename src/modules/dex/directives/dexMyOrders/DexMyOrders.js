(function () {
    'use strict';

    const entities = require('@waves/data-entities');
    const { SIGN_TYPE } = require('@waves/signature-adapter');
    const ds = require('data-service');

    /**
     * @param Base
     * @param {Waves} waves
     * @param {User} user
     * @param {IPollCreate} createPoll
     * @param {INotification} notification
     * @param {app.utils} utils
     * @param {$rootScope.Scope} $scope
     * @param {DexDataService} dexDataService
     * @param {ModalManager} modalManager
     * @param {PermissionManager} permissionManager,
     * @param {Ease} ease
     * @param {JQuery} $element
     * @return {DexMyOrders}
     */
    const controller = function (
        Base,
        waves,
        user,
        createPoll,
        notification,
        utils,
        $scope,
        dexDataService,
        modalManager,
        permissionManager,
        ease,
        $element
    ) {

        const R = require('ramda');
        const tsUtils = require('ts-utils');

        class DexMyOrders extends Base {

            constructor() {
                super();

                /**
                 * @type {{amount: string, price: string}}
                 * @private
                 */
                this._assetIdPair = null;

                /**
                 * @type {Array}
                 */
                this.orders = null;
                /**
                 * @type {boolean}
                 */
                this.isDemo = !user.address;
                /**
                 * @type {boolean}
                 */
                this.pending = !this.isDemo;
                /**
                 * @type {Object.<string, boolean>}
                 */
                this.shownOrderDetails = Object.create(null);
                /**
                 * @type {boolean}
                 */
                this.loadingError = false;

                this.syncSettings({
                    _assetIdPair: 'dex.assetIdPair'
                });

                this.headers = [
                    {
                        id: 'pair',
                        valuePath: 'item.pair',
                        search: true,
                        placeholder: 'directives.filter'
                    },
                    {
                        id: 'type',
                        title: { literal: 'directives.myOrders.type' },
                        valuePath: 'item.type',
                        sort: true
                    },
                    {
                        id: 'time',
                        title: { literal: 'directives.myOrders.time' },
                        valuePath: 'item.timestamp',
                        sort: true,
                        sortActive: true,
                        isAsc: false
                    },
                    {
                        id: 'price',
                        title: { literal: 'directives.myOrders.price' },
                        valuePath: 'item.price',
                        sort: true
                    },
                    {
                        id: 'amount',
                        title: { literal: 'directives.myOrders.amount' },
                        valuePath: 'item.amount',
                        sort: true
                    },
                    {
                        id: 'total',
                        title: { literal: 'directives.myOrders.total' },
                        valuePath: 'item.total',
                        sort: true
                    },
                    {
                        id: 'fee',
                        title: { literal: 'directives.myOrders.tableTitle.fee' },
                        valuePath: 'item.userFee',
                        sort: true
                    },
                    {
                        id: 'status',
                        title: { literal: 'directives.myOrders.status' },
                        valuePath: 'item.progress',
                        sort: true
                    },
                    {
                        id: 'controls',
                        templatePath: 'modules/dex/directives/dexMyOrders/header-control-cell.html',
                        scopeData: {
                            cancelAllOrdersClick: () => {
                                this.cancelAllOrders();
                            },
                            $ctrl: this
                        }
                    }
                ];

                if (!this.isDemo) {
                    const poll = createPoll(this, this._getOrders, 'orders', 1000, { $scope });

                    poll.ready.then(() => {
                        this.pending = false;
                    });

                    this.receive(dexDataService.createOrder, () => poll.restart());

                    this.poll = poll;
                }
            }

            static _getTransactionsByOrderIdHash(txList) {
                const uniqueList = R.uniqBy(R.prop('id'), txList);
                const transactionsByOrderHash = Object.create(null);
                uniqueList.forEach((tx) => {
                    ['order1', 'order2'].forEach((orderFieldName) => {
                        if (!transactionsByOrderHash[tx[orderFieldName].id]) {
                            transactionsByOrderHash[tx[orderFieldName].id] = [];
                        }
                        transactionsByOrderHash[tx[orderFieldName].id].push(DexMyOrders._remapTx(tx));
                    });
                });
                return transactionsByOrderHash;
            }

            static _remapTx(tx) {
                const fee = (tx, order) => order.orderType === 'sell' ? tx.sellMatcherFee : tx.buyMatcherFee;
                const emptyFee = new entities.Money(0, tx.fee.asset);
                const userFee = [tx.order1, tx.order2]
                    .filter((order) => order.sender === user.address)
                    .reduce((acc, order) => acc.add(fee(tx, order)), emptyFee);

                return { ...tx, userFee };
            }

            /**
             * @param {IOrder} order
             * @private
             */
            static _remapOrders(matcherPublicKey) {
                return order => {
                    const assetPair = order.assetPair;
                    const pair = `${assetPair.amountAsset.displayName} / ${assetPair.priceAsset.displayName}`;
                    const isNew = Date.now() < (order.timestamp.getTime() + 1000 * 8);
                    const percent = new BigNumber(order.progress * 100).dp(2).toFixed();
                    return waves.matcher.getCreateOrderFee({ ...order, matcherPublicKey })
                        .then(fee => ({ ...order, isNew, percent, pair, fee }));
                };
            }

            static _getFeeByType(type) {
                return function (tx) {
                    switch (type) {
                        case 'buy':
                            return tx.buyMatcherFee;
                        case 'sell':
                            return tx.sellMatcherFee;
                        default:
                            throw new Error('Wrong order type!');
                    }
                };
            }

            /**
             * @param {IOrder} order
             */
            setPair(order) {
                user.setSetting('dex.assetIdPair', {
                    amount: order.assetPair.amountAsset.id,
                    price: order.assetPair.priceAsset.id
                });
            }

            showDetails(order) {
                this.shownOrderDetails[order.id] = true;
            }

            hideDetails(order) {
                this.shownOrderDetails[order.id] = false;
            }

            toggleDetails(order) {
                this.shownOrderDetails[order.id] = !this.shownOrderDetails[order.id];
            }

            cancelAllOrders() {
                if (!permissionManager.isPermitted('CAN_CANCEL_ORDER')) {
                    const $notify = $element.find('.js-order-notification');
                    DexMyOrders._animateNotification($notify);
                    return null;
                }

                this.orders.filter(tsUtils.contains({ isActive: true })).forEach((order) => {
                    this.dropOrder(order);
                });
            }

            round(data) {
                return Math.round(Number(data));
            }

            /**
             * @param {IOrder} order
             * @return boolean
             */
            isSelected(order) {
                return this._assetIdPair.amount === order.amount.asset.id &&
                    this._assetIdPair.price === order.price.asset.id;
            }

            dropOrderGetSignData(order) {
                const { id } = order;
                const data = { id };
                const signable = ds.signature.getSignatureApi().makeSignable({
                    type: SIGN_TYPE.CANCEL_ORDER,
                    data
                });

                return utils.signMatcher(signable)
                    .then(signable => signable.getDataForApi());
            }

            /**
             * @param order
             */
            dropOrder(order) {

                if (!permissionManager.isPermitted('CAN_CANCEL_ORDER')) {
                    const $notify = $element.find('.js-order-notification');
                    DexMyOrders._animateNotification($notify);
                    return null;
                }

                const dataPromise = this.dropOrderGetSignData(order);

                dataPromise
                    .then((signedTxData) => ds.cancelOrder(signedTxData, order.amount.asset.id, order.price.asset.id))
                    .then(() => {
                        const canceledOrder = tsUtils.find(this.orders, { id: order.id });
                        canceledOrder.state = 'Canceled';
                        notification.info({
                            ns: 'app.dex',
                            title: { literal: 'directives.myOrders.notifications.isCanceled' }
                        });

                        if (this.poll) {
                            this.poll.restart();
                        }
                    })
                    .catch(e => {
                        const error = utils.parseError(e);
                        notification.error({
                            ns: 'app.dex',
                            title: { literal: 'directives.myOrders.notifications.somethingWentWrong' },
                            body: { literal: error && error.message || error }
                        });
                    });
            }

            /**
             * @returns {Promise}
             * @private
             */
            _getOrders() {
                return Promise.all([
                    this._getAllOrders(),
                    ds.fetch(ds.config.get('matcher'))
                ])
                    .then(([orders, matcherPublicKey]) => {
                        const remap = R.map(DexMyOrders._remapOrders(matcherPublicKey));

                        orders.sort(utils.comparators.process(a => a.timestamp).desc);
                        return Promise.all(remap(orders));
                    })
                    .then(result => {
                        const last = result.length ? result[result.length - 1] : null;

                        if (!last) {
                            return result;
                        }

                        return ds.api.transactions.getExchangeTxList({
                            sender: user.address,
                            timeStart: ds.utils.normalizeTime(last.timestamp.getTime())
                        }).then((txList) => {
                            const transactionsByOrderHash = DexMyOrders._getTransactionsByOrderIdHash(txList);
                            this.loadingError = false;
                            return result.map((order) => {
                                if (!transactionsByOrderHash[order.id]) {
                                    transactionsByOrderHash[order.id] = [];
                                }
                                // if (transactionsByOrderHash[order.id].length) {
                                //     order.fee = transactionsByOrderHash[order.id]
                                //         .map(DexMyOrders._getFeeByType(order.type))
                                //         .reduce((sum, fee) => sum.add(fee));
                                // }
                                order.exchange = transactionsByOrderHash[order.id];
                                return order;
                            });
                        }).catch(() => result);
                    })
                    .catch(() => {
                        this.loadingError = true;
                        $scope.$apply();
                    });
            }

            _getAllOrders() {
                return waves.matcher.getOrders().then(R.filter(R.whereEq({ isActive: true })));
            }

            static _animateNotification($element) {
                return utils.animate($element, { t: 100 }, {
                    duration: 1200,
                    step: function (tween) {
                        const progress = ease.bounceOut(tween / 100);
                        $element.css('transform', `translate(0, ${-100 + progress * 100}%)`);
                    }
                })
                    .then(() => utils.wait(700))
                    .then(() => {
                        return utils.animate($element, { t: 0 }, {
                            duration: 500,
                            step: function (tween) {
                                const progress = ease.linear(tween / 100);
                                $element.css('transform', `translate(0, ${(-((1 - progress) * 100))}%)`);
                            }
                        });
                    });
            }

        }

        return new DexMyOrders();
    };

    controller.$inject = [
        'Base',
        'waves',
        'user',
        'createPoll',
        'notification',
        'utils',
        '$scope',
        'dexDataService',
        'modalManager',
        'permissionManager',
        'ease',
        '$element'
    ];

    angular.module('app.dex').component('wDexMyOrders', {
        bindings: {},
        templateUrl: 'modules/dex/directives/dexMyOrders/myOrders.html',
        controller
    });
})();

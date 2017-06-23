/***
  注意 JS 代码的执行顺序是,先同步,后异步,最后setTimeout()/setInterval()回调.
***/
(function($) {
    'use strict';

    var cacheSize = 100, taskId = 0, times = 0;
    var is = function(obj, type) {   // 类型检测
            type = type.substr(0, 1).toUpperCase() + type.substr(1);
            return {}.toString.call(obj) == '[object ' + type + ']';
        };

    var lazyLoader = {
        // 缓存
        imageCache: {},
        // 缓存队列
        imageCacheQueue: [],
        // 加载栈, 从loadStack提取需要加载的task
        loadStack: [],
        // 加载队列, 将需要加载的task push到loadQueue中实现task的加载
        loadQueue: [],

        load: function(url, isImmediate, timeout, callback) {
            is(timeout, 'function') && (callback = timeout);
            if (!is(timeout, 'number') || timeout === 0) {
                // 模式超时时间
                timeout = 4000;
            }
            if (!this._isCached(url, callback)) {
                this.loadStack.push({
                    id: taskId++,
                    url: url,
                    callback: callback,
                    isImmediate: !!isImmediate,  // 是否立即执行
                    timeout: timeout,
                    failureTimes: 0
                });
                this._load(isImmediate);
            }
        },

        _load: function(isImmediate) {
            var loadQueueLen = this.loadQueue.length;
            if (this.loadStack.length > 0 && (loadQueueLen <= 4 || isImmediate)) {
                if (isImmediate && loadQueueLen >= 4) {
                    this._handleLoadQueueMax(isImmediate, loadQueueLen);
                }

                // 从加载栈尾部获取任务
                var task = this.loadStack.pop();
                var loadPromise = this._createDeffered(task);
                loadPromise
                    .always($.proxy(this._offImageEvent, this))
                    .done($.proxy(this._deferredDone, this))
                    .fail($.proxy(this._deferredFail, this))
                    .always($.proxy(this._nextLoad, this));

                // 将任务添加到加载队列尾部
                this.loadQueue.push(task);
                this._loadImage(task);
            }
        },

        _isCached: function(url, callback) {
            if (this.imageCache[url]) {
                var image;
                for (var i = 0, len = this.imageCacheQueue.length; i < len; i++) {
                    image = this.imageCacheQueue[i];
                    if(image.src === url) {
                        this.imageCacheQueue.splice(i, 1);
                        this.imageCacheQueue.push(image);
                        break;
                    }
                }
                if (is(callback, 'function')) {
                    callback.call(null, image);
                }
                return true;
            }
            return false;
        },

        /*
         * 如果当前任务需要立即执行且加载队列已满,则中断加载队列中最早的一个非立即执行任务
         * 如果加载队列都是立即执行的任务,则中断加载队列中第一个立即执行任务
        */
        _handleLoadQueueMax: function(loadQueueLen) {
            var hasInterrupt = false;
            for(var i = 0; i < loadQueueLen; i++) {
                var _task = this.loadQueue[i];
                if(!_task.isImmediate && _task.loadDeferred.state() === 'pending') {
                    _task.loadDeferred.reject(_task, true);
                    hasInterrupt = true;
                    break;
                }
            }
            if(!hasInterrupt) {
                var _task = this.loadQueue[0];
                if(_task.loadDeferred.state() === 'pending') {
                    _task.loadDeferred.reject(_task, true);
                }
            }
        },

        /*
         * 创建一个 deferred 对象,用于管理 image.onload 和 image.onerror 事件回调函数
        */
        _createDeffered: function(task) {
            var loadDeferred = $.Deferred(function(loadDeferred) {
                setTimeout(function() {
                    if(loadDeferred.state() === 'pending') {
                        loadDeferred.reject(task);
                    }
                }, task.timeout);
            });
            task.loadDeferred = loadDeferred;
            return loadDeferred.promise();
        },

        _offImageEvent: function(task) {
            task.image.onload = null;
            task.image.onerror = null;
        },

        _deferredDone: function(task) {
            if (!this._isCached(task.url, task.callback)) {

                // 超出缓存数量 清除最早缓存的数据
                if (this.imageCacheQueue.length > cacheSize) {
                    var cachedImage = this.imageCacheQueue.shift();
                    delete this.imageCache[cachedImage.src];
                    cachedImage = null;
                }

                // 加载成功则缓存
                this.imageCache[task.url] = task.image;
                this.imageCacheQueue.push(task.image);

                if (is(task.callback, 'function')) {
                    task.callback.call(null, task.image);
                }
            }
        },

        _deferredFail: function(task, isInterrupt) {
            task.image = null;

            // 被中断的任务放在当前任务的后一位
            if(isInterrupt) {
                this.loadStack.splice(this.loadStack.length - 2, 0, task);
            } else {
                // 失败四次以上,则放弃该任务,否则将该任务至于加载栈的头部
                if (task.failureTimes++ < 4) {
                    this.loadStack.unshift(task);
                }
            }
        },

        _nextLoad: function(task) {
            // 从加载队列中移除当前的task, 不论加载成功还是失败
            for (var i = 0; i < this.loadQueue.length; i++) {
                if (task.id === this.loadQueue[i].id) {
                    this.loadQueue.splice(i, 1);
                }
            }
            // 加载下一个
            this._load();
        },

        _loadImage: function(task) {
            var image = new Image();
            task.image = image;
            image.onload = function() {
                if(task.loadDeferred.state() !== 'rejected') {
                    task.loadDeferred.resolve(task);
                }
            };
            image.onerror = function() {
                if(task.loadDeferred.state() !== 'rejected') {
                    task.loadDeferred.reject(task);
                }
            };
            image.src = task.url;
        }
    };

    $.lazyLoader = function(url, isImmediate, timeout, callback) {
        lazyLoader.load(url, isImmediate, timeout, callback);
    };
})(jQuery);
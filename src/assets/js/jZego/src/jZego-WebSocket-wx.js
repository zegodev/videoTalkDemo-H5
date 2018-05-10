export default function ZegoWebSocket(url, protocol) {
    this.url = url;
    this.protocol = protocol || null;
    this.readyState = 3;

    this._websocket = wx.connectSocket({
        url: url,
    });

    if (this._websocket) {
        this.readyState = 0;

        var _this = this;
        this._websocket.onOpen(function(e) {
            _this.readyState = _this._websocket.readyState;
            if (typeof _this.onopen === "function") {
                _this.onopen();

                _this._websocket.onClose(function(e) {
                    _this.readyState = _this._websocket.readyState;
                    if (typeof _this.onclose === "function") {
                        _this.onclose(e);
                    }
                });

                _this._websocket.onMessage(function(data) {
                    if (typeof _this.onmessage === "function") {
                        _this.onmessage(data);
                    }
                });
            }
        });

        this._websocket.onError(function(e) {
            _this.readyState = _this._websocket.readyState;
            if (typeof _this.onerror === "function") {
                _this.onerror(e);
            }
        });
    }
}

ZegoWebSocket.prototype.onopen = function(e) {}

ZegoWebSocket.prototype.onerror = function(e) {}

ZegoWebSocket.prototype.onclose = function(e) {}

ZegoWebSocket.prototype.onmessage = function(e) {}

ZegoWebSocket.prototype.send = function (msg) {
    this._websocket && this._websocket.send({
        data: msg
    });
};


ZegoWebSocket.prototype.close = function() {
    this._websocket && this._websocket.close();
};

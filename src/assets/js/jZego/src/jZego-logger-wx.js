/**
   ZegoLogger
*/

// import ZegoWebSocket from './jZego-WebSocket-wx.js';

var ENUM_LOG_LEVEL = { debug: 0, info: 1, warn: 2, error: 3, report: 99, disable: 100 };
var ENUM_REMOTE_TYPE = {disable:0, websocket: 1, https: 2};

export default function ZegoLogger() {
    this.logSeq = 0;
    this.logLevel = ENUM_LOG_LEVEL.disable;
    this.logRemoteLevel = ENUM_LOG_LEVEL.disable;
    this.websocket = null;
    this.url = "";
    this.appid = 0;
    this.sessionid = "0";
    this.roomid = "";
    this.userid = "";
    this.userName = "";
    this.logCache = [];
    this.logCacheSend = [];
    this.logCacheMax = 100;
    this.logType = ENUM_REMOTE_TYPE.disable;
    this.logUploadTimer = null;
    this.logUploadInterval = 1000 * 10;
    this.version = "";
}

ZegoLogger.prototype.setLogLevel = function(logLevel) {
    this.logLevel = logLevel;
    if (this.logLevel < ENUM_LOG_LEVEL.debug ||
        this.logLevel > ENUM_LOG_LEVEL.report) {
        this.logLevel = ENUM_LOG_LEVEL.disable;
    }
};

ZegoLogger.prototype.setRemoteLogLevel = function(logLevel) {
    this.logRemoteLevel = logLevel;
    if (this.logRemoteLevel < ENUM_LOG_LEVEL.debug ||
        this.logRemoteLevel > ENUM_LOG_LEVEL.report) {
        this.logRemoteLevel = ENUM_LOG_LEVEL.disable;
    }
};

ZegoLogger.prototype.setSessionInfo = function(appid, roomid, sessionid, userid, userName, version) {
    this.appid = appid;
    this.roomid = roomid;
    this.sessionid = sessionid;
    this.userid = userid;
    this.userName = userName;
    this.version = version;
};


ZegoLogger.prototype.openLogServer = function(url) {
    if (url.indexOf("wss:") == 0) {
        this.logType = ENUM_REMOTE_TYPE.websocket;
        openWebSocketLogServer(this, url);
    }
    else if (url.indexOf("https:") == 0) {
        this.logType = ENUM_REMOTE_TYPE.https;
        openHttpsLogServer(this, url);
    }
    else {
        this.logType = ENUM_REMOTE_TYPE.disable;
    }
};


ZegoLogger.prototype.stopLogServer = function() {
    if (this.logType == ENUM_REMOTE_TYPE.websocket) {
        stopWebSocketServer(this);
    }
    else if (this.logType == ENUM_LOG_LEVEL.https) {
        //send last data
        SendHttpsLog(this);
        stopHttpsServer(this);
    }

    this.logType = ENUM_REMOTE_TYPE.disable;
};


ZegoLogger.prototype.RemoteLog = function(level, log, force) {

    if (this.url == "") {
        return;
    }

    if (this.logType == ENUM_REMOTE_TYPE.websocket) {
        RemoteWebSocketLog(this, level, log);
    }
    else if (this.logType == ENUM_REMOTE_TYPE.https) {
        RemoteHttpsLog(this, level, log, force);
    }
};

ZegoLogger.prototype.log = function(level, log) {

    if (this.logLevel !== ENUM_LOG_LEVEL.disable &&
        this.logLevel <= level) {
        this.logCache.push(log);
        while (this.logCache.length > this.logCacheMax) {
            this.logCache.shift();
        }
    }

    if (this.logRemoteLevel !== ENUM_LOG_LEVEL.disable &&
        this.logRemoteLevel <= level) {
        this.RemoteLog(level, log);
    }
};

ZegoLogger.prototype.debug = function() {
    // var log = logParamList(this, "debug").concat([].slice.call(arguments)).concat(logParamListEnd(this));
    var log = logParamList(this, "debug", ''.concat([].slice.call(arguments)));
    if (this.logLevel !== ENUM_LOG_LEVEL.disable &&
        this.logLevel <= ENUM_LOG_LEVEL.debug) {
        console.debug.apply(console, log);
    }

    this.log(ENUM_LOG_LEVEL.debug, log);
};

ZegoLogger.prototype.info = function() {
    // var log = logParamList(this, "info").concat([].slice.call(arguments)).concat(logParamListEnd(this));
    var log = logParamList(this, "info", ''.concat([].slice.call(arguments)));
    if (this.logLevel !== ENUM_LOG_LEVEL.disable &&
        this.logLevel <= ENUM_LOG_LEVEL.info) {
        console.info.apply(console, log);
    }

    this.log(ENUM_LOG_LEVEL.info, log);
};

ZegoLogger.prototype.warn = function() {
    // var log = logParamList(this, "warn").concat([].slice.call(arguments)).concat(logParamListEnd(this));
    var log = logParamList(this, "warn", ''.concat([].slice.call(arguments)));
    if (this.logLevel !== ENUM_LOG_LEVEL.disable &&
        this.logLevel <= ENUM_LOG_LEVEL.warn) {
        console.warn.apply(console, log);
    }

    this.log(ENUM_LOG_LEVEL.warn, log);
};

ZegoLogger.prototype.error = function() {
    // var log = logParamList(this, "error").concat([].slice.call(arguments)).concat(logParamListEnd(this));
    var log = logParamList(this, "error", ''.concat([].slice.call(arguments)));
    if (this.logLevel !== ENUM_LOG_LEVEL.disable &&
        this.logLevel <= ENUM_LOG_LEVEL.error) {
        console.error.apply(console, log);
    }

    this.log(ENUM_LOG_LEVEL.error, log);
};

ZegoLogger.prototype.report = function(reportInfo) {
    // var log = logParamList(this, "report").concat([].slice.call(arguments)).concat(logParamListEnd(this));
    /*
    var log = logParamList(this, "report", ''.concat([].slice.call(arguments)));
    if (this.logLevel !== ENUM_LOG_LEVEL.disable &&
        this.logLevel <= ENUM_LOG_LEVEL.report) {
        console.info.apply(console, log);
    }

    this.log(ENUM_LOG_LEVEL.report, log);
    */

    var log = logReportParamList(this, "report", reportInfo);
    if (this.logLevel !== ENUM_LOG_LEVEL.disable &&
        this.logLevel <= ENUM_LOG_LEVEL.report) {
        console.debug.apply(console, log);
    }

    // this.log(ENUM_LOG_LEVEL.report, log);
    
    //report 立即上报
    this.RemoteLog(ENUM_LOG_LEVEL.report, log, true);
};

var D = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'];

function logReportParamList(_this, level, logInfo) {
    
    var t = new Date();
    var stringTime = (1900 + t.getYear()) + "/";
    stringTime += (D[t.getMonth()+1] || t.getMonth()+1) + "/";
    stringTime += (D[t.getDate()] || t.getDate()) + " ";
    stringTime += (D[t.getHours()] || t.getHours()) + ":";
    stringTime += (D[t.getMinutes()] || t.getMinutes()) + ":";
    stringTime += (D[t.getSeconds()] || t.getSeconds());
    stringTime += "." + t.getTime() % 1000;

    logInfo["time"] = stringTime;
    logInfo["level"] = level;
    
    if (BUILD_WEBRTC) {
        logInfo["console"] = "rtc";
    }

    if (BUILD_WX) {
        logInfo["console"] = "xcx";
    }
    
    logInfo["appid"] = _this.appid;
    logInfo["roomid"] = _this.roomid;
    logInfo["userid"] = _this.userid;
    logInfo["id_name"] = _this.userid;
    logInfo["userName"] = _this.userName;
    logInfo["sessionid"] = _this.sessionid;
    logInfo["version"] = _this.version;
    
    return [JSON.stringify(logInfo)];
}

function logParamList(_this, level, logInfo) {

    var t = new Date();
    var stringTime = (1900 + t.getYear()) + "/";
    stringTime += (D[t.getMonth()+1] || t.getMonth()+1) + "/";
    stringTime += (D[t.getDate()] || t.getDate()) + " ";
    stringTime += (D[t.getHours()] || t.getHours()) + ":";
    stringTime += (D[t.getMinutes()] || t.getMinutes()) + ":";
    stringTime += (D[t.getSeconds()] || t.getSeconds());
    stringTime += "." + t.getTime() % 1000;

    //get first space from logInfo
    var action = logInfo.substr(0, logInfo.indexOf(' '));
    if (action.length == 0) {
        action = logInfo;
    }

    var content = logInfo.substr(logInfo.indexOf(' ') + 1);
    if (content.length == 0) {
        content = "";
    }

    var s = {
        "time": stringTime,
        "level": level,
        "action": action,
        "content": content, 
        "appid": _this.appid,
        "roomid": _this.roomid,
        "userid": _this.userid,
        "userName": _this.userName,
        "sessionid": _this.sessionid
    };

    return [JSON.stringify(s)];
}

//helper function
function openWebSocketLogServer(_this, url) {
    if (_this.url != url) {
        _this.url = url;
        stopWebSocketServer(_this);
        if (!url) return;
        if (BUILD_WEBRTC) {
            _this.websocket = new WebSocket(url);
        }
        
        if (BUILD_WX) {
            _this.websocket = new ZegoWebSocket(url);
        }
        
        _this.websocket.onopen = function(evt) {

        };
        _this.websocket.onclose = function(evt) {

        };
        _this.websocket.onmessage = function(evt) {

        };
        _this.websocket.onerror = function(evt) {
            console.log('ws发生错误！');
        };
    }
}

function openHttpsLogServer(_this, url) {
    _this.url = url;
    if (!url) {
        return;
    }

    stopHttpsServer(_this);

    //start timer
    if (!_this.logUploadTimer) {
        _this.logUploadTimer = setInterval(function() {
            SendHttpsLog(_this);
        }, _this.logUploadInterval);
    }
}

function stopWebSocketServer(_this) {
    if (_this.websocket) {
        _this.websocket.onclose = null;
        _this.websocket.onerror = null;
        _this.websocket.close();
        _this.websocket = null;
    }
}

function stopHttpsServer(_this) {
    //stop timer
    if (_this.logUploadTimer) {
        clearInterval(_this.logUploadTimer);
        _this.logUploadTimer = null;
    }
}


function RemoteWebSocketLog(_this, level, log) {
    if (_this.websocket == null || _this.websocket.readyState == 2 || _this.websocket.readyState == 3) {
        var url = _this.url;
        _this.url = "";
        _this.openLogServer(url);
        if (_this.logCacheSend.length < _this.logCacheMax) {
            _this.logCacheSend.push(log);
        }
    }
    else if (_this.websocket.readyState == 0) {
        if (_this.logCacheSend.length < _this.logCacheMax) {
            _this.logCacheSend.push(log);
        }
    }
    else if (_this.websocket.readyState == 1) {
        if (_this.logCacheSend > 0) {
            var logBefore = "";
            for (var i = 0; i < _this.logCacheSend.length; i++) {
                logBefore = logBefore + _this.logCacheSend[i] + "\n";
            }
            log = logBefore + log;
            _this.logCacheSend = [];
        }
        _this.websocket.send(log);
    }
    else {
        //console.log("wrong socket state:"+this.websocket.ready_state)
        if (_this.logCacheSend.length < _this.logCacheMax) {
            _this.logCacheSend.push(log);
        }
    }
}

function RemoteHttpsLog(_this, level, log, force) {
    _this.logCacheSend.push(log);
    if (_this.logCacheSend.length >= _this.logCacheMax || force === true) {
        SendHttpsLog(_this);
    }
}

function SendHttpsLog(_this) {
    if (_this.logCacheSend.length == 0) {
        return;
    }

    var uploadData = "";
    for (var i = 0; i < _this.logCacheSend.length; i++) {
        uploadData = uploadData + _this.logCacheSend[i] + "\n";
    }

    //console.log("url " + _this.url);
    //console.log(uploadData);

    if (BUILD_WX) {
        wx.request({
            url: _this.url,
            data: uploadData,
            method: "POST",
            success: function(res) {
                //console.log(res.data);
                //check time interval
                if (res.data.length == 0) {
                    return;
                }
    
                var interval = res.data.interval;
                if (typeof interval === "number" && _this.logUploadInterval !== interval) {
                    _this.timeInterval = interval;
                    openHttpsLogServer(_this, _this.url);
                }
            },
            fail: function(res) {
                console.log("send failed " + res.statusCode);
            }
        });
    }
    
    if (BUILD_WEBRTC) {
        
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4) {
                if (xmlhttp.status == 200) {
                    if (xmlhttp.responseText.length == 0) {
                        return;
                    }

                    try {
                        var json = JSON.parse(xmlhttp.responseText);
                        var interval = json.interval;
                        if (typeof interval === "number" && _this.logUploadInterval !== interval) {
                            _this.timeInterval = interval;
                            openHttpsLogServer(_this, _this.url);
                        }
                    }
                    catch (e) {
                        console.log("send result failed " + e);
                    }
                    
                }
                else {
                    console.log("send failed " + xmlhttp.status);
                }
            }
        };

        xmlhttp.open("POST", _this.url, true);
        xmlhttp.send(uploadData);
    }

    _this.logCacheSend = [];
}
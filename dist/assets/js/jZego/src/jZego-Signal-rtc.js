/**
 *  ZegoSignal
 */

import LinkedList from './LinkedList.js';

import {
    getSeq
} from "./jZego-extern-rtc.js";

var WEBRTC_PROTO_VERSION = "1.0.1"; //协议版本号

var SEND_MSG_TIMEOUT = 1;
var SEND_MSG_RESET = 2;

var MAX_TRY_HEARTBEAT_COUNT = 5;
var MAX_TRY_CONNECT_COUNT = 3;

var ENUM_CONNECT_STATE = {disconnect: 0, connecting: 1, connected: 2};

export default function ZegoSignal(logger) {
    this.logger = logger;
    
    this.sendDataMap = {};
    this.sendDataList = new LinkedList();
    this.sendDataCheckOnceCount = 100;

    this.signalSeq = 0;

    this.pushCallback = {};

    this.sessionInfos = {};

    //tryheartbeat
    this.tryHeartbeatCount = 0;
    // this.heartbeatTimer = null;
    this.heartbeatInterval = 10 * 1000;
    
    this.sendDataTimeout = 5 * 1000; //发送消息超时
    this.sendDataDropTimeout = 10 * 1000; //丢弃过期消息的超时时间

    this.tryConnectCount = 0;
    this.tryConnectTimer = null;
    this.tryConnectInterval = 3000;

    this.state = ENUM_CONNECT_STATE.disconnect;

    //token
    this.tokenType = 0;

    this.browser = getBrowserAndVersion();
    this.platform = navigator.platform;
}

/*
 *    "zs.ssi.0": "ZegoSignal.setSessionInfo"
 */
ZegoSignal.prototype.setSessionInfo = function(appid, userid) {
    this.logger.debug("zs.ssi.0 call");
    
    this.appid = appid.toString();
    this.userid = userid;
    // this.server = serverUrl;
};

ZegoSignal.prototype.onDisconnect = function(server) {};
ZegoSignal.prototype.onUpdateHeartBeartInterval = function(interval) {};

/*
 *    "zs.cs.0": "ZegoSignal.connectServer"
 */
//rtc信令连接
ZegoSignal.prototype.connectServer = function(token, serverUrl, result) {
    this.token = token;
    this.state = ENUM_CONNECT_STATE.connecting;
    this.connectCallback = result;
    this.server = serverUrl;

    if (!this.websocket || this.websocket.readyState !== 1) {
        this.logger.debug("zs.cs.0 need new websocket");

        try {
            if (this.websocket) {
                this.logger.info("zs.cs.0 close error websocket");
                this.websocket.onclose = null;
                this.websocket.onerror = null;
                this.websocket.close();
                this.websocket = null;
            }

            //connect websocket
            this.websocket = new WebSocket(this.server);
            var _this = this;
            this.websocket.onopen = function() {
                _this.tryConnectCount = 0;

                //reset connect timer
                resetConnectTimer(_this);

                //register onMessage
                _this.logger.info("zs.cs.0 websocket open call");
                bindWebSocketHandle(_this);

                //update token
                updateToken(_this);

                _this.state = ENUM_CONNECT_STATE.connected;
            };
        }
        catch (e) {
            this.logger.error("zs.cs.0 websocket error " + e);
        }
    }
    else {
        //websocket is already connect
        resetConnectTimer(_this);
        this.state = ENUM_CONNECT_STATE.connected;
    }

    resetConnectTimer(_this);
    _this.tryConnectTimer = setTimeout(function() {
        startConnectTimer(_this, result);
    }, _this.tryConnectInterval);
};

/*
 *    "zs.ds.0": "ZegoSignal.disconnectServer"
 */
//rtc信令断开连接
ZegoSignal.prototype.disconnectServer = function() {
    this.logger.debug('zs.ds.0 call');
    this.server = null;
    this.connectCallback = null;

    resetCheckMessage(this);
    resetConnectTimer(this);

    if (this.websocket) {
        this.websocket.onclose = null;
        this.websocket.onerror = null;
        this.websocket.close();
        this.websocket = null;
    }

    this.token = "";
    this.sessionInfos = {};
    this.tokenType = 0;    

    this.tryHeartbeatCount = 0;
    
    this.tryConnectCount = 0;
    
    this.state = ENUM_CONNECT_STATE.disconnect;
};

ZegoSignal.prototype.isServerConnected = function() {
    if (this.websocket && this.websocket.readyState === 1) {
        return true;
    }

    return false;
};

/*
 *    "zs.cs.1": "ZegoSignal.createSession"
 */
ZegoSignal.prototype.createSession = function(seq, type, streamId, success, error) {
    this.logger.debug("zs.cs.1 call: ", streamId);

    var cmd = "CreateSessionReq";
    var body = {
        'type': type,
        'stream_id': streamId,
        'platform': this.platform,
        'browser': this.browser.name,
        'version': this.browser.version,
        'app_id': this.appid,
    };

    //publish
    if (type == 0) {
        body['negotiate_mode'] = 0;
    }
    else {
        body['negotiate_mode'] = 1;
    }
    
    sendMessageWithCallback(this, cmd, seq, 0, body, success, error);
};

/*
 *    "zs.smd.0": "ZegoSignal.sendMediaDesc"
 */
//type 0: offer  1: answer
ZegoSignal.prototype.sendMediaDesc = function(seq, sessionId, type, desc, success, error) {
    this.logger.debug("zs.smd.0 call: ", sessionId);

    var cmd = "MediaDescReq";
    var body = {
        'type': type,
        'sdp': desc.sdp,
    };

    if (desc.width != undefined) {
        body['width'] = desc.width;
    }

    if (desc.height != undefined) {
        body['height'] = desc.height;
    }

    if (desc.framerate != undefined) {
        body['framerate'] = desc.frameRate;
    }

    if (desc.video_min_kpbs != undefined) {
        body['video_min_kpbs'] = desc.video_min_kpbs;
    }

    if (desc.video_max_kpbs != undefined) {
        body['video_max_kpbs'] = desc.video_max_kpbs;
    }

    if (desc.audio_kpbs != undefined) {
        body['audio_kpbs'] = desc.audio_kpbs;
    }

    sendMessageWithCallback(this, cmd, seq, sessionId, body, success, error);
};

/*
 *    "zs.sci.0": "ZegoSignal.sendCandidateInfo"
 */
ZegoSignal.prototype.sendCandidateInfo = function(seq, sessionId, candidateList, success, error) {
    this.logger.debug("zs.sci.0 call: ", sessionId);

    var cmd = "CandidateInfoReq";
    var dataList = [];
    for (var i = 0; i < candidateList.length; i++) {
        var info = {
            'candidate': candidateList[i].candidate,
            'sdpMid': candidateList[i].sdpMid,
            'sdpMLineIndex': candidateList[i].sdpMLineIndex
        };

        dataList.push(info);
    }
    
    var body = {
        'infos': dataList
    };

    sendMessageWithCallback(this, cmd, seq, sessionId, body, success, error);
};

/*
 *    "zs.scs.0": "ZegoSignal.sendCloseSession"
 */
ZegoSignal.prototype.sendCloseSession = function(seq, sessionId, reason, success, error) {
    this.logger.debug("zs.scs.0 call: ", sessionId);

    var cmd = "CloseSessionReq";
    var body = {
        'reason': reason
    };

    removeSession(this, sessionId);

    sendMessageWithCallback(this, cmd, seq, sessionId, body, success, error);
};

/*
 *    "zs.smda.0": "ZegoSignal.sendMediaDescAck"
 */
ZegoSignal.prototype.sendMediaDescAck = function(seq, sessionId, result) {
    this.logger.debug("zs.smda.0 call: ", sessionId);

    var cmd = "MediaDescAck";
    var body = {
        'result': result
    };

    sendMessage(this, cmd, seq, sessionId, body);
};

/*
 *    "zs.scia.0": "ZegoSignal.sendCandidateInfoAck"
 */
ZegoSignal.prototype.sendCandidateInfoAck = function(seq, sessionId, result) {
    this.logger.debug("zs.scia.0 call: ", sessionId);

    var cmd = "CandidateInfoAck";
    var body = {
        'result': result
    };

    sendMessage(this, cmd, seq, sessionId, body);
};

/*
 *    "zs.scsa.0": "ZegoSignal.sendCloseSessionAck"
 */
ZegoSignal.prototype.sendCloseSessionAck = function(seq, sessionId, result) {
    this.logger.debug("zs.scsa.0 call: ", sessionId);

    var cmd = "CloseSessionAck";
    var body = {
        'result': result
    };

    sendMessage(this, cmd, seq, sessionId, body);
};

/*
 *    "zs.ssra.0": "ZegoSignal.sendResetSessionAck"
 */
ZegoSignal.prototype.sendResetSessionAck = function(seq, sessionId, result) {
    this.logger.debug("zs.ssra.0 call: ", sessionId);

    var cmd = "SessionResetAck";
    var body = {
        'result': result
    };

    sendMessage(this, cmd, seq, sessionId, body);
};

/*
 *    "zs.rpc.0": "ZegoSignal.registerPushCallback"
 */
ZegoSignal.prototype.registerPushCallback = function(cmd, sessionId, callback, object) {
    //this.logger.debug("zs.rpc.0 call: ", cmd);

    if (callback && (typeof callback === 'function'))
    {
        this.logger.debug("zs.rpc.0 setcallback");
        this.pushCallback[cmd + sessionId] = {callback: callback, object: object};
    }
};

/*
 *    "zs.upc.0": "ZegoSignal.unregisterPushCallback"
 */
ZegoSignal.prototype.unregisterPushCallback = function(cmd, sessionId) {
    //this.logger.info("zs.urpc.0 call: ", cmd);

    delete this.pushCallback[cmd + sessionId];
};

/*
 *    "zs.cmt.0": "ZegoSignal.checkMessageTimeout"
 */
ZegoSignal.prototype.checkMessageTimeout = function() {
    
    var head = this.sendDataList.getFirst();
    var timestamp = Date.parse(new Date());
    var checkCount = 0;
    var timeoutMsgCount = 0;
    var dropMsgCount = 0;

    //_this.logger.debug('zs.cmt.0 call ' + timestamp);

    while (head != null) {
        if ((head._data.time + this.sendDataTimeout) > timestamp) {
            break;
        }

        delete this.sendDataMap[head._data.seq];
        this.sendDataList.remove(head);
        ++timeoutMsgCount;

        if (head._data.error == null || 
            (this.sendDataDropTimeout > 0 &&
                (head._data.time + this.sendDataDropTimeout) < timestamp)) {
            ++dropMsgCount;
        }
        else {
            if (head._data.error)
                head._data.error(SEND_MSG_TIMEOUT, head._data.seq);
        }

        ++checkCount;
        if (checkCount >= this.sendDataCheckOnceCount) {
            break;
        }

        head = this.sendDataList.getFirst();
    }

    // _this.sendDataCheckTimer = setTimeout(function() {
    //     checkMessageTimeout(_this);
    // }, _this.sendDataCheckInterval);

    if (timeoutMsgCount != 0 || dropMsgCount != 0) {
        this.logger.debug("zs.cmt.0 call success, state: timeout=", timeoutMsgCount, " drop=", dropMsgCount);
    }
};

/*
 *    "zs.shb.0": "ZegoSignal.signalHeartbeat"
 */
ZegoSignal.prototype.sendHeartbeat = function() {
    this.logger.debug("zs.shb.0 call");

    if (Object.keys(this.sessionInfos).length == 0) {
        this.logger.info("zs.shb.0 no need to heartbeat");
        return;
    }

    if (++this.tryHeartbeatCont > MAX_TRY_HEARTBEAT_COUNT) {
        this.logger.error("zs.shb.0 heartbeat try limit");

        disconnectCallback(this);
        return;
    }

    var sessionIdList = [];
    for (var sessionId in this.sessionInfos) {
        sessionIdList.push(parseInt(sessionId));
    }

    var body = {
        'session_ids': sessionIdList
    };

    var _this = this;
    sendMessageWithCallback(this, "ClientHBReq", getSeq(), 0, body, function(seq, sessionId, data) {
        if (_this.heartbeatInterval != data.hb_interval) {
            _this.heartbeatInterval = data.hb_interval;

            _this.onUpdateHeartBeartInterval(data.hb_interval);
        }

        _this.tryHeartbeatCount = 0;
    }, function(err, seq) {
        _this.tryHeartbeatCount += 1;
    });
};

/*
 *    "zs.qr.0": "ZegoSignal.QualityReport"
 */
ZegoSignal.prototype.QualityReport = function(seq, sessionId, qualityStat, success, error) {
    this.logger.debug("zs.qr.0 call");

    var cmd = "QualityReportReq";
    var body = {
        streams: [qualityStat]
    };

    sendMessageWithCallback(this, cmd, seq, sessionId, body, success, error);
};

/*
 *    "zs.bsh.0": "ZegoSignal.bindWebSocketHandle"
 */
function bindWebSocketHandle(_this) {
    _this.websocket.onmessage = function(e) {
        var msg = JSON.parse(e.data);
        _this.logger.debug("zs.bsh.0 signmsg= ", msg.header.cmd);

        if (msg.header.appid !== _this.appid || msg.header.user_id !== _this.userid) {
            _this.logger.info("zs.bsh.0 check header failed");
            return;
        }

        handleServerPush(_this, msg);
    };

    _this.websocket.onclose = function(e) {
        _this.logger.info("zs.bsh.0 close msg = " + JSON.stringify(e));

        if (_this.state != ENUM_CONNECT_STATE.disconnect) {
            //try connect
            resetConnectTimer(_this);
            startConnectTimer(_this, null);

            //all request timeout
            resetCheckMessage(_this);
        }
    };

    _this.websocket.onerror = function(e) {
        _this.logger.info("zs.bsh.0 msg = " + JSON.stringify(e));
    };
}

function handleServerPush(_this, msg) {
    switch (msg.header.cmd) {
    case 'LoginRsp':
        handleRespondData(_this, "LoginReq", msg);
        break;
    case 'CreateSessionRsp':
        handleRespondData(_this, "CreateSessionReq", msg);
        if (msg.body.result === 0)
            addSession(_this, msg.header.session_id, msg.body.session_token);
        break;
    case 'MediaDescRsp':
        handleRespondData(_this, "MediaDescReq", msg);
        break;
    case 'CandidateInfoRsp':
        handleRespondData(_this, "CandidateInfoReq", msg);
        break;
    case 'CloseSessionRsp':
        handleRespondData(_this, "CloseSessionReq", msg);
        removeSession(_this, msg.header.session_id);
        break;
    case 'ClientHBRsp':
        handleRespondData(_this, "ClientHBReq", msg);
        break;
    case 'MediaDescPush':
        handlePushData(_this, msg);
        break;
    case 'CandidateInfoPush':
        handlePushData(_this, msg);
        break;
    case 'CloseSessionPush':
        handlePushData(_this, msg);
        removeSession(_this, msg.header.session_id);
        break;
    case 'QualityReportRsp':
        handleRespondData(_this, "QualityReportReq", msg);
        break;
    case 'SessionResetPush':
        handlePushResetSessionData(_this, msg);
        break;
    }
}

/*
 *    "zs.hrd.0": "ZegoSignal.handleRespondData"
 */
function handleRespondData(_this, cmd, msg) {
    _this.logger.debug("zs.hrd.0 call");

    //callback
    var sendDataNode = _this.sendDataMap[msg.header.seq];
    if (sendDataNode == null) {
        _this.logger.debug("zs.hrd.0 cannot find data");
        return;
    }

    var sendData = sendDataNode._data;
    if (sendData.cmd !== cmd) {
        _this.logger.error("sz.hrd.0 command is not match");
    }
    else {
        if (sendData.success) {
            sendData.success(msg.header.seq, msg.header.session_id, msg.body);
        }
    }
    
    delete _this.sendDataMap[msg.header.seq];
    _this.sendDataList.remove(sendDataNode);
}

/*
 *    "zs.hpd.0": "ZegoSignal.handlePushData"
 */
function handlePushData(_this, msg) {
    _this.logger.debug("zs.hpd.0 call " + msg.header.cmd + " session " + msg.header.session_id);

    var callbackData = _this.pushCallback[msg.header.cmd + msg.header.session_id];
    if (callbackData == null) {
        _this.logger.info("zs.hpd.0 no callbackData " + msg.header.cmd + " session: " + msg.header.session_id);
        return;
    }

    if (callbackData.callback) {
        callbackData.callback(callbackData.object, msg.header.seq, msg.header.session_id, msg.body);
    }
}

/*
 *    "zs.hprsd.0": "ZegoSignal.handlePushResetSessionData"
 */
function handlePushResetSessionData(_this, msg) {
    _this.logger.debug("zs.hprsd.0 call ");

    var sessionList = [];
    if (msg.body.cResetType == 0) {
        sessionList = Object.keys(_this.sessionInfos);
    }
    else if (msg.body.cResetType == 1) {
        for (var i = 0; i < msg.body.session_ids.length; i++) {
            sessionList.push(msg.body.session_ids[i]);
        }
    }

    //send ack
    _this.sendResetSessionAck(msg.header.seq, 0, 0);

    if (sessionList.length == 0) {
        _this.logger.info("zs.hprsd.0 no session to callback");
        return;
    }

    for (var j = 0; j < sessionList.length; j++) {
        var callbackData = _this.pushCallback[msg.header.cmd + sessionList[j]];
        if (callbackData == null) {
            _this.logger.info("zs.hprsd.0 no callbackData " + sessionList[j]);
        }
        else {
            if (callbackData.callback) {
                callbackData.callback(callbackData.object, msg.header.seq, sessionList[j], msg.body);
            }
        }
    }
}
/*
 *    "zs.sm.0": "ZegoSignal.sendMessage"
 */
function sendMessage(_this, cmd, seq, sessionId, body) {
    _this.logger.debug("zs.sm.0 call " + cmd);

    if (!_this.websocket || _this.websocket.readyState !== 1) {
        _this.logger.error("zs.sm.0 connect not establish");
        return;
    }

    var header = getHeader(_this, cmd, seq, sessionId);
    var data = {
        'header': header,
        'body': body
    };

    var dataBuffer = JSON.stringify(data);
    _this.websocket.send(dataBuffer);

    _this.logger.debug('zs.sm.0 success');
}

/*
 *    "zs.smwc.0": "ZegoSignal.sendMessageWithCallback"
 */
function sendMessageWithCallback(_this, cmd, seq, sessionId, body, success, error) {
    _this.logger.debug("zs.smwc.0 call " + cmd);

    if (!_this.websocket || _this.websocket.readyState !== 1) {
        _this.logger.error("zs.smwc.0 connect not establish");
        if (error) {
            error(SEND_MSG_TIMEOUT, seq);
        }

        return;
    }

    var header = getHeader(_this, cmd, seq, sessionId);
    var data = {
        'header': header,
        'body': body
    };

    if (success == undefined) {
        success = null;
    }

    if (error == undefined) {
        error = null;
    }

    var cmdData = {
        // data: data,
        seq: seq,
        deleted: false,
        cmd: cmd,
        time: Date.parse(new Date()),
        success: success,
        error: error,
    };

    var cmdDataNode = _this.sendDataList.push(cmdData);
    _this.sendDataMap[cmdData.seq] = cmdDataNode;

    var dataBuffer = JSON.stringify(data);
    _this.websocket.send(dataBuffer);

    _this.logger.debug('zs.smwc.0 success');
}

function getHeader(_this, cmd, seq, sessionId) {
    _this.globalHeader = {
        'version': WEBRTC_PROTO_VERSION,
        'cmd': cmd,
        'appid': _this.appid,
        'seq': seq,
        'user_id': _this.userid,
        'session_id': sessionId
    };

    return _this.globalHeader;
}



/*
 *    "zs.rcm.0": "ZegoSignal.resetCheckMessage"
 */
function resetCheckMessage(_this) {
    _this.logger.debug("zs.rcm.0 call");

    // clearTimeout(_this.sendDataCheckTimer);
    // _this.sendDataCheckTimer = null;

    var head = _this.sendDataList.getFirst();
    while (head != null) {
        _this.sendDataList.remove(head);

        if (head._data.error)
            head._data.error(SEND_MSG_RESET, head._data.seq);

        head = _this.sendDataList.getFirst();
    }

    _this.sendDataMap = {};
}

/*
 *    "zs.as.0": "ZegoSignal.addSession"
 */
function addSession(_this, sessionId, token) {
    _this.logger.info("zs.as.0 call");

    for (var _sessionId in _this.sessionInfos) {
        if (_sessionId === sessionId) {
            _this.sessionInfos[sessionId].token = token;
            return;
        }
    }

    _this.sessionInfos[sessionId] = {
        token: token
    };
}

/*
 *    "zs.rs.0": "ZegoSignal.removeSession"
 */
function removeSession(_this, sessionId){
    _this.logger.info("zs.rs.0 call");

    if (_this.sessionInfos[sessionId]) {
        delete _this.sessionInfos[sessionId];
    }
}

/*
 *    "zs.ut.0": "ZegoSignal.updateToken"
 */
function updateToken(_this) {
    _this.logger.info("zs.ut.0 call");

    var cmd = "LoginReq";
    var body = {
        'token': _this.token,
        'tokenType': _this.tokenType
    };

    if (Object.keys(_this.sessionInfos).length != 0) {
        var sessions = [];
        for (var sessionId in _this.sessionInfos) {
            var session_id = parseInt(sessionId);
            sessions.push({
                session_id: session_id,
                session_token: _this.sessionInfos[session_id].token
            });
        }

        body["sessions"] = sessions;
    }

    sendMessageWithCallback(_this, cmd, getSeq(), 0, body, function(seq, session_id, data) {
        if (data.result == 0) {
            _this.token = data.token;
            _this.tokenType = data.tokenType;
            
            var tokenInfo = {
                report: data.report,
                report_interval: data.report_interval_ms
            };

            if (_this.connectCallback != null) {
                _this.connectCallback(0, _this.server, tokenInfo);
                _this.connectCallback = null;
            }
        }
        else {
            var errorTokenInfo = {
                error: data.strError
            };
            
            if (_this.connectCallback != null) {
                _this.connectCallback(data.result, _this.server, errorTokenInfo);
                _this.connectCallback = null;
            }
        }
    }, function(err, seq) {
        if (_this.connectCallback != null) {
            _this.connectCallback(-1, _this.server, undefined);
            _this.connectCallback = null;
        }
    });
}

/*
 *    "zs.rct.0": "ZegoSignal.resetConnectTimer"
 */
function resetConnectTimer(_this) {
    _this.logger.info("zs.rct.0 call");
    clearTimeout(_this.tryConnectTimer);
    _this.tryConnectTimer = null;
    // _this.tryConnectCount = 0;
}

/*
 *    "zs.sct.0": "ZegoSignal.startConnectTimer"
 */
function startConnectTimer(_this, callback) {
    _this.logger.info("zs.sct.0 call");

    if (_this.tryConnectCount > MAX_TRY_CONNECT_COUNT) {
        _this.logger.error("zs.sct.0 beyond max limit");
        
        disconnectCallback(_this);
        return;
    }

    if (!_this.websocket || _this.websocket.readyState !== 1) {
        _this.tryConnectCount += 1;
        _this.connectServer(_this.token, _this.server, callback);
    }
    else {
        //already connect
        resetConnectTimer(_this);
    }
}

/*
 *    "zs.dc.0": "ZegoSignal.disconnectCallback"
 */
function disconnectCallback(_this) {
    // for (var sessionId in _this.sessionInfos) {
    //     var callbackData = _this.pushCallback["WebSocketDisconnect"+ sessionId];
    //     if (callbackData == null) {
    //         _this.logger.error("zs.dc.0 no callbackData");
    //         return;
    //     }
        
    //     if (callbackData.callback) {
    //         callbackData.callback(callbackData.object, parseInt(sessionId));
    //     }
    // }   

    if (_this.connectCallback) {
        _this.connectCallback(-1, _this.server, undefined);
        _this.connectCallback = null;
    }

    var server = _this.server;
    _this.disconnectServer();
    _this.onDisconnect(server);
}

///////////////////////////////////////////
function getBrowserAndVersion() {
    var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*([\d\.]+)/i) || []; 
    if(/trident/i.test(M[1])) {
        tem=/\brv[ :]+([\d\.]+)/g.exec(ua) || []; 
        return {name:'IE',version:(tem[1]||'')};
    }   
    if(M[1]==='Chrome'){
        tem=ua.match(/\bOPR|Edge\/([\d\.]+)/);
        if(tem!=null)   {return {name:'Opera', version:tem[1]};}
    }   
    M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
    if((tem=ua.match(/version\/([\d+\.]+)/i))!=null) {M.splice(1,1,tem[1]);}
    
    return {
        name: M[0],
        version: M[1]
    };
}

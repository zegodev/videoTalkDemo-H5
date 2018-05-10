/**
 * ZegoStreamCenter
 */


import {
    playErrorList,
    ENUM_PLAY_STATE_UPDATE,
    publishErrorList,
    ENUM_PUBLISH_STATE_UPDATE
} from "./jZego-extern-rtc.js";


import ZegoPlay from './jZego-Play-rtc.js';
import ZegoPublish from './jZego-Publish-rtc';
import ZegoSignal from './jZego-Signal-rtc';
import ZegoDataReport from "./jZego-datareport";
import ZegoPreview from "./jZego-Preview-rtc";

export default function ZegoStreamCenter(logger) {
    this.playerList = {};
    this.publisherList = {};
        
    this.logger = logger;
    this.dataReport = new ZegoDataReport(this.logger);

    //由streamcenter统一管理每个signal的心跳逻辑
    this.heartbeatTimer = null;
    this.heartbeatInterval = 10 * 1000;

    //质量回调时间间隔,默认3s
    this.qualityTimerInterval = 3 * 1000;

    this.maxRetryCount = 5;

    this.previewVideoList = [];

    this.signalList = {};
}

var ENUM_SIGNAL_STATE = {disconnected: 0, connecting: 1, connected: 2};

ZegoStreamCenter.prototype.onSignalDisconnected = function (server) {};

/*
 *    "zsc.qmc.0": "ZegoStreamCenter.setQualityMonitorCycle"
 */
ZegoStreamCenter.prototype.setQualityMonitorCycle = function (timeInMs) {
    this.logger.debug("zsc.qmc.0 timeInterval " + timeInMs);

    this.qualityTimerInterval = timeInMs;
};

/*
 *    "zsc.ssi.0": "ZegoStreamCenter.setSessionInfo"
 */
ZegoStreamCenter.prototype.setSessionInfo = function (appid, userid, token) {
    this.logger.debug("zsc.ssi.0 called");
    
    // this.signal.setSessionInfo(appid, userid, serverUrl);
    this.appid = appid;
    this.userid = userid;
    this.token = token;
};

ZegoStreamCenter.prototype.onPlayStateUpdate = function (type, streamid, error) {};
ZegoStreamCenter.prototype.onPlayQualityUpdate = function (streamid, streamQuality) {};

ZegoStreamCenter.prototype.onPublishStateUpdate = function (type, streamid, error) {};
ZegoStreamCenter.prototype.onPublishQualityUpdate = function (streamid, streamQuality) {};

ZegoStreamCenter.prototype.onVideoSizeChanged = function (streamid, videoWidth, videoHeight) {};

/*
 *    "zsc.uhb.0": "ZegoStreamCenter.onUpdateHeartBeartIntervalHandle"
 */
ZegoStreamCenter.prototype.onUpdateHeartBeartIntervalHandle = function(interval) {
    if (interval != this.heartbeatInterval) {
        this.logger.debug("zsc.uhb.0 update " + interval);
        
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimerd);
            this.heartbeatTimer = null;
        }

        startSignalHeartbeat(this);
        this.heartbeatInterval = interval;
    }
};

ZegoStreamCenter.prototype.enumDevices = function (devicesList, error) {
    return ZegoPreview.enumDevices(devicesList, error);
};

/*
 *    "zsc.em.0": "ZegoStreamCenter.enableMicrophone"
 */
ZegoStreamCenter.prototype.enableMicrophone = function (localVideo, enable) {
    var preview = checkPreivew(this, localVideo);
    if (!preview) {
        this.logger.info("zsc.em.0 no preview");
        return false;
    }

    return preview.enableMicrophone(enable);
};

/*
 *    "zsc.ec.0": "ZegoStreamCenter.enableCamera"
 */
ZegoStreamCenter.prototype.enableCamera = function (localVideo, enable) {
    var preview = checkPreivew(this, localVideo);
    if (!preview) {
        this.logger.info("zsc.ec.0 no preview");
        return false;
    }

    return preview.enableCamera(enable);
};

/*
 *    "zsc.sp.0": "ZegoStreamCenter.startPreview"
 */
ZegoStreamCenter.prototype.startPreview = function (localVideo, mediaStreamConstraints, success, error) {
    if (!localVideo) {
        this.logger.info("zsc.sp.0 localVideo null");
        return false;
    }

    var preview = checkPreivew(this, localVideo);
    if (preview) {
        this.logger.info("zsc.sp.0 localvideo alredy exist");
        return true;
    }

    preview = new ZegoPreview(this.logger);
    this.previewVideoList.push(preview);
    preview.startPreview(localVideo, mediaStreamConstraints, success, error);

    this.logger.debug("zsc.sp.0 call success");
    return true;
};

/*
 *    "zsc.sp.1": "ZegoStreamCenter.stopPreview"
 */
ZegoStreamCenter.prototype.stopPreview = function (localVideo) {
    if (!localVideo) {
        this.logger.info("zsc.sp.0 localVideo null");
        return false;
    }

    for (var streamid in this.publisherList) {
        if (this.publisherList[streamid].localVideo === localVideo) {
            this.publisherList[streamid].localVideo = null;
        }
    }

    var preview = checkPreivew(this, localVideo);
    if (!preview) {
        this.logger.info("zsc.sp.0 no preview");
        return false;
    }

    preview.stopPreview();
    removePreview(this, preview);

    return true;
};

/*
 *    "zsc.pss.0": "ZegoStreamCenter.setPublishStateStart"
 */
ZegoStreamCenter.prototype.setPublishStateStart = function (streamid, localVideo) {

    var publish = this.publisherList[streamid];
    if (publish) {
        this.logger.error("zsc.pss.0 publisher already exist");
        return false;
    }

    var publisher = new ZegoPublish(this.logger, null, this.dataReport, this.qualityTimerInterval);
    publisher.onPublishStateUpdate = this.onPublishStateUpdate.bind(this);
    publisher.onPublishQualityUpdate = this.onPublishQualityUpdate.bind(this);

    this.publisherList[streamid] = {
        localVideo: localVideo,
        publisher: publisher,
        serverUrls: [],
        retryCount: 0
    };

    this.dataReport.eventStart(publisher.reportSeq, "GetSignalUrl");

    return true;
};

/*
 *    "zsc.sps.0": "ZegoStreamCenter.startPublishingStream"
 */
ZegoStreamCenter.prototype.startPublishingStream = function (streamid, serverUrls) {
    this.logger.debug("zsc.sps.0 call");
    var publish = this.publisherList[streamid];
    if (!publish) {
        this.logger.info("zsc.sps.0 publisher don't exist");
        return false;
    }

    var publisher = publish.publisher;
    this.dataReport.eventEndWithMsg(publisher.reportSeq, "GetSignalUrl", {
        urls: serverUrls
    });
    
    if (serverUrls.length == 0) {
        this.onPublishStateUpdate(ENUM_PUBLISH_STATE_UPDATE.error, streamid, publishErrorList.DISPATCH_ERROR);

        this.logger.info("zsc.sps.0 server don't have signal url");
        return false;
    }
    
    var serverUrl = serverUrls[0];
    for (var i = 1; i < serverUrls.length; i ++) {
        publish.serverUrls.push(serverUrls[i]);
    }

    return connectPublishServer(this, streamid, serverUrl);
};

/*
 *    "zsc.sps.0.1": "ZegoStreamCenter.stopPublishingStream"
 */
ZegoStreamCenter.prototype.stopPublishingStream = function(streamid) {
    var publish = this.publisherList[streamid];
    if (!publish) {
        this.logger.info("zsc.sps.0.1 publisher don't exist");
        return;
    }

    if (publish.publisher) {
        publish.publisher.stopPublish();
        delete publish.publisher;
    }
        
    //update signal
    removeStreamFromSignal(this, true, streamid);
    stopSignalHeartbeat(this);
    
    delete this.publisherList[streamid];
    
    this.logger.debug("zsc.sps.0.1 call success");
};

/*
 *    "zsc.pss.1": "ZegoStreamCenter.setPlayStateStart"
 */
ZegoStreamCenter.prototype.setPlayStateStart = function (streamid, remoteVideo, audioOutput) {
    var play = this.playerList[streamid];
    if (play) {
        this.logger.info("zsc.pss.1 player already exist");
        return false;
    }

    var player = new ZegoPlay(this.logger, null, this.dataReport, this.qualityTimerInterval);
    player.onPlayStateUpdate = this.onPlayStateUpdate.bind(this);
    player.onPlayQualityUpdate = this.onPlayQualityUpdate.bind(this);
    player.onVideoSizeChanged = this.onVideoSizeChanged.bind(this);
    
    this.playerList[streamid] = {
        player: player,
        remoteVideo: remoteVideo,
        audioOutput: audioOutput,
        // signal: signal,
        serverUrls: [],
        retryCount: 0
    };

    this.dataReport.eventStart(player.reportSeq, "GetSignalUrl");

    return true;
};

/*
 *    "zsc.psao.1": "ZegoStreamCenter.setPlayStreamAudioOutput"
 */
ZegoStreamCenter.prototype.setPlayStreamAudioOutput = function (streamid, audioOutput) {
    if (audioOutput != undefined && audioOutput.length != 0) {
        this.logger.debug("zsc.psao.1 device " + audioOutput);
        var play = this.playerList[streamid];
        if (!play) {
            this.logger.info("zsc.psao.1 play don't exist");
            return false;
        }

        if (!play.player) {
            this.logger.info("zsc.psao.1 player don't exist");
            return false;
        }

        return play.player.setAudioDestination(audioOutput);
    }

    return false;
};

/*
 *    "zsc.psao.0": "ZegoStreamCenter.setPublishStreamAudioOutput"
 */
ZegoStreamCenter.prototype.setPublishStreamAudioOutput = function (localVideo, audioOutput) {
    if (audioOutput != undefined && audioOutput.length != 0 && localVideo) {
        this.logger.debug("zsc.psao.0 device " + audioOutput);

        var preview = checkPreivew(this, localVideo);
        if (preview) {
            preview.setAudioDestination(audioOutput);
        }
        else {
            this.logger.info("zsc.psao.0 no preview");
        }
    }

    return false;
};

/*
 *    "zsc.sps.1": "ZegoStreamCenter.startPlayingStream"
 */
ZegoStreamCenter.prototype.startPlayingStream = function (streamid, serverUrls) {
    this.logger.debug("zsc.sps.1 start play called");
    var play = this.playerList[streamid];
    if (!play) {
        this.logger.info("zsc.sps.1 player don't exist");
        return false;
    }

    var player = play.player;
    this.dataReport.eventEndWithMsg(player.reportSeq, "GetSignalUrl", {
        urls: serverUrls
    });

    if (serverUrls.length == 0) {
        this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.error, streamid, playErrorList.DISPATCH_ERROR);

        this.logger.info("zsc.sps.1 server don't have signal url");
        return false;
    }
    
    var serverUrl = serverUrls[0];
    for (var i = 1; i < serverUrls.length; i ++) {
        play.serverUrls.push(serverUrls[i]);
    }

    return connectPlayServer(this, streamid, serverUrl);
};

/*
 *    "zsc.sps.1.1": "ZegoStreamCenter.stopPlayingStream"
 */
ZegoStreamCenter.prototype.stopPlayingStream = function (streamid) {
    var player = this.playerList[streamid];
    if (!player) {
        this.logger.info("zsc.sps.1.1 player don't exist");
        return;
    }

    if (player.player) {
        player.player.stopPlay();
        delete player.player;
    }
    
    //update signal
    removeStreamFromSignal(this, false, streamid);
    stopSignalHeartbeat(this);
    
    delete this.playerList[streamid];

    this.logger.debug("zsc.sps.1.1 call success");
};

ZegoStreamCenter.prototype.reset = function() {

    for (var publishStreamId in this.publisherList) {
        if (this.publisherList[publishStreamId].publisher) {
            this.publisherList[publishStreamId].publisher.stopPublish();
        }
    }

    for (var playStreamId in this.playerList) {
        if (this.playerList[playStreamId].player) {
            this.playerList[playStreamId].player.stopPlay();
        }
    }
    
    for (var serverUrl in this.signalList) {
        if (this.signalList[serverUrl].signal) {
            this.signalList[serverUrl].signal.disconnectServer();
        }
    }

    this.playerList = {};
    this.publisherList = {};
    this.signalList = {};

    stopSignalHeartbeat(this);
};

ZegoStreamCenter.prototype.checkMessageTimeout = function() {
    for (var serverUrl in this.signalList) {
        if (this.signalList[serverUrl].signal) {
            this.signalList[serverUrl].signal.checkMessageTimeout();
        }
    }
};

/*
 *    "zsc.od.0": "ZegoStreamCenter.onDisconnectHandle"
 */
ZegoStreamCenter.prototype.onDisconnectHandle = function(server) {
    this.logger.info("zsc.od.0 call");

    if (this.signalList[server]) {
        var signalInfo = this.signalList[server];

        for (var i = 0; i < signalInfo.publishConnectedList.length; i++) {
            var publish = this.publisherList[signalInfo.publishConnectedList[i]];
            if (publish && publish.publisher) {
                publish.publisher.onDisconnect();
            }
        }

        for (i = 0; i < signalInfo.playConnectedList.length; i++) {
            var play = this.playerList[signalInfo.playConnectedList[i]];
            if (play && play.player) {
                play.player.onDisconnect();
            }
        }

        delete this.signalList[server];

        stopSignalHeartbeat();
    }
};

/*
 *    "zsc.crss.0": "ZegoStreamCenter.connetWithReuseSignalServer"
 */
function connetWithReuseSignalServer(_this, streamId, isPublish, serverUrl, success, error) {
    _this.logger.debug("zsc.crss.0 begin " + serverUrl);
    
    var signalInfo = null;
    if (_this.signalList[serverUrl]) {
        signalInfo = _this.signalList[serverUrl];
        //already connected
        if (signalInfo.state == ENUM_SIGNAL_STATE.connected) {
            _this.logger.debug("zsc.crss.0 already connected " + serverUrl + " streamId: " + streamId);
            if (isPublish) {
                signalInfo.publishConnectedList.push(streamId);
            }
            else {
                signalInfo.playConnectedList.push(streamId);
            }
            
            success(streamId, signalInfo);
        }
        //isConnecting
        else if (signalInfo.state == ENUM_SIGNAL_STATE.connecting) {
            _this.logger.debug("zsc.crss.0 signal is connecting " + serverUrl + " streamId: " + streamId);
            updateWaitingList(_this, signalInfo, isPublish, streamId, success, error);
        }
    }
    else {
        //no connect
        _this.logger.debug("zsc.crss.0 new signal " + serverUrl + " streamId: " + streamId);
        
        var signal = new ZegoSignal(_this.logger);
        signal.setSessionInfo(_this.appid, _this.userid);
        signal.onUpdateHeartBeartInterval = _this.onUpdateHeartBeartIntervalHandle.bind(_this);
        signal.onDisconnect = _this.onDisconnectHandle.bind(_this);

        _this.signalList[serverUrl] = {
            signal: signal,
            state: ENUM_SIGNAL_STATE.connecting,
            publishWaitingList: [],
            playWaitingList: [],
            publishConnectedList: [],
            playConnectedList: [],
            tokenInfo: null
        };

        updateWaitingList(_this, _this.signalList[serverUrl], isPublish, streamId, success, error);

        signal.connectServer(_this.token, serverUrl, function(result, server, tokenInfo) {
            signalInfo = _this.signalList[serverUrl];

            var i = 0;
            var publishCallback;
            var playCallback;
            if (result != 0) {
                //connected failed, notify and delete
                _this.logger.debug("zsc.crss.0 connect failed " + server);

                for (i = 0; i < signalInfo.publishWaitingList.length; i++) {
                    publishCallback = signalInfo.publishWaitingList[i];
                    if (publishCallback.error) {
                        publishCallback.error(publishCallback.streamId, result);
                    }
                }

                for (i = 0; i < signalInfo.playWaitingList.length; i++) {
                    playCallback = signalInfo.playWaitingList[i];
                    if (playCallback.error) {
                        playCallback.error(playCallback.streamId, result);
                    }
                }

                delete _this.signalList[serverUrl];
            }
            else {
                //connected success, notify and update state
                _this.logger.debug("zsc.crss.0 connected success " + server);
                
                signalInfo.state = ENUM_SIGNAL_STATE.connected;
                signalInfo.tokenInfo = tokenInfo;

                for (i = 0; i < signalInfo.publishWaitingList.length; i++) {
                    publishCallback = signalInfo.publishWaitingList[i];
                    if (publishCallback.success) {
                        publishCallback.success(publishCallback.streamId, signalInfo);
                    }

                    signalInfo.publishConnectedList.push(publishCallback.streamId);
                }

                for (i = 0; i < signalInfo.playWaitingList.length; i++) {
                    playCallback = signalInfo.playWaitingList[i];
                    if (playCallback.success) {
                        playCallback.success(playCallback.streamId, signalInfo);
                    }

                    signalInfo.playConnectedList.push(playCallback.streamId);
                }

                signalInfo.publishWaitingList = [];
                signalInfo.playWaitingList = [];
            }
        });
    }
}

function updateWaitingList(_this, signalInfo, isPublish, streamId, success, error) {
    if (isPublish) {
        signalInfo.publishWaitingList.push({
            streamId: streamId,
            success: success,
            error: error
        });
    }
    else {
        signalInfo.playWaitingList.push({
            streamId: streamId,
            success: success,
            error: error
        });
    }
}

/*
 *    "zsc.rsfs.0": "ZegoStreamCenter.removeStreamFromSignal"
 */
function removeStreamFromSignal(_this, isPublish, streamId) {

    var deleteSignal = [];
    for (var serverUrl in _this.signalList) {
        var signalInfo = _this.signalList[serverUrl];
        if (isPublish) {
            for (var i = 0; i < signalInfo.publishConnectedList.length; i++) {
                if (signalInfo.publishConnectedList[i] === streamId) {
                    _this.logger.debug("zsc.rsfs.0 found from publish");
                    signalInfo.publishConnectedList.splice(i, 1);
                    break;
                }
            }
        }
        else {
            for (var j = 0; j < signalInfo.playConnectedList.length; j++) {
                if (signalInfo.playConnectedList[j] === streamId) {
                    _this.logger.debug("zsc.rsfs.0 found from play");
                    signalInfo.playConnectedList.splice(j, 1);
                    break;
                }
            }
        }

        if (signalInfo.publishConnectedList.length == 0 && signalInfo.playConnectedList.length == 0) {
            signalInfo.signal.disconnectServer();
            deleteSignal.push(serverUrl);
        }
    }
    
    for (var k = 0; k < deleteSignal.length; k++) {
        delete _this.signalList[deleteSignal[k]];
    }
}
/*
 *    "zsc.cps.0": "ZegoStreamCenter.connectPublishServer"
 */
function connectPublishServer(_this, streamId, serverUrl) {
    var publish = _this.publisherList[streamId];
    if (!publish) {
        _this.logger.info("zsc.cps.0 publisher don't exist");
        return false;
    }

    _this.dataReport.eventStart(publish.publisher.reportSeq, "ConnectServer");
    connetWithReuseSignalServer(_this, streamId, true, serverUrl, function(streamid, signalInfo) {
        //check streamid exist
        var checkPublish = _this.publisherList[streamid];
        if (!checkPublish) {
            _this.logger.info("zsc.cps.0 after connect publisher don't exist");
            return;
        }

        var checkPublisher = checkPublish.publisher;
        if (!checkPublisher) {
            _this.logger.info("zsc.cps.1 check publisher don't exist");
            return;
        }

        _this.dataReport.eventEndWithMsg(checkPublisher.reportSeq, "ConnectServer", {
            result: 0,
            server: serverUrl
        });

        var tokenInfo = signalInfo.tokenInfo;
        _this.logger.info("zsc.cps.0 update token success");

        if (tokenInfo && tokenInfo.report) {
            checkPublisher.qualityUpload = tokenInfo.report;
            checkPublisher.qualityUploadInterval = tokenInfo.report_interval;
        }

        checkPublisher.signal = signalInfo.signal;
        
        checkPublish.retryCount = 0;
        publishStream(_this, streamid);

        getTokenSuccess(_this);
        startSignalHeartbeat(_this);

    }, function(streamid, result) {
        _this.logger.error("zsc.cps.0 update token failed " + result);

        //check streamid exist
        var checkPublish = _this.publisherList[streamid];
        if (!checkPublish) {
            _this.logger.info("zsc.cps.0 after connect publisher don't exist");
            return;
        }

        if (shouldRetry(_this, checkPublish, result)) {
            _this.logger.info("zsc.cps.1 retry connect");

            var retryServerUrl = checkPublish.serverUrls[0];
            checkPublish.serverUrls.splice(0, 1);

            checkPublish.retryCount += 1;
            connectPublishServer(_this, streamid, retryServerUrl);
        }
        else {
            _this.onPublishStateUpdate(ENUM_PUBLISH_STATE_UPDATE.error, streamid, publishErrorList.TOKEN_ERROR);
        }
    });
    
    return true;
}

/*
 *    "zsc.cps.1": "ZegoStreamCenter.connectPlayServer"
 */
function connectPlayServer(_this, streamId, serverUrl) {
    var play = _this.playerList[streamId];
    if (!play) {
        _this.logger.info("zsc.cps.1 player don't exist");
        return false;
    }

    _this.dataReport.eventStart(play.player.reportSeq, "ConnectServer");
    connetWithReuseSignalServer(_this, streamId, false, serverUrl, function(streamid, signalInfo) {
        //check streamid exist
        var checkPlay = _this.playerList[streamid];
        if (!checkPlay) {
            _this.logger.info("zsc.cps.1 after connect player don't exist");
            return;
        }

        var checkPlayer = checkPlay.player;
        if (!checkPlayer) {
            _this.logger.info("zsc.cps.1 checkplayer don't exist");
            return;
        }

        _this.dataReport.eventEndWithMsg(checkPlayer.reportSeq, "ConnectServer", {
            result: 0,
            server: serverUrl
        });

        var tokenInfo = signalInfo.tokenInfo;
        _this.logger.info("zsc.cps.1 update token success");

        if (tokenInfo && tokenInfo.report) {
            checkPlayer.qualityUpload = tokenInfo.report;
            checkPlayer.qualityUploadInterval = tokenInfo.report_interval;
        }
            
        checkPlayer.signal = signalInfo.signal;
        
        checkPlay.retryCount = 0;
        playStream(_this, streamid);

        getTokenSuccess(_this);
        startSignalHeartbeat(_this);
    }, function(streamid, result) {
        var checkPlay = _this.playerList[streamid];
        if (!checkPlay) {
            _this.logger.info("zsc.cps.1 after connect player don't exist");
            return;
        }

        if (shouldRetry(_this, checkPlay, result)) {
            _this.logger.info("zsc.cps.1 retry connect");

            var retryServerUrl = checkPlay.serverUrls[0];
            checkPlay.serverUrls.splice(0, 1);

            checkPlay.retryCount += 1;
            connectPlayServer(_this, streamid, retryServerUrl);
        }
        else {
            _this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.error, streamid, playErrorList.TOKEN_ERROR);
        }

    });

    return true;
}

/*
 *    "zsc.ps.0": "ZegoStreamCenter.publishStream"
 */
function publishStream(_this, streamid) {
    var publisher = _this.publisherList[streamid].publisher;
    if (!publisher) {
        _this.logger.info("zsc.ps.0 publisher don't exist");
        return;
    }

    var localStream = null;
    var videoInfo = null;
    var preview = checkPreivew(_this, _this.publisherList[streamid].localVideo);
    if (preview) {
        localStream = preview.localStream;
        videoInfo = preview.videoInfo;
    }

    if (!localStream) {
        _this.logger.info("zsc.ps.0 no localStream");
    }

    _this.logger.debug("zsc.ps.0 call success");
    publisher.startPublish(streamid, localStream, videoInfo);
}

/*
 *    "zsc.ps.1": "ZegoStreamCenter.playStream"
 */
function playStream(_this, streamid) {
    var player = _this.playerList[streamid].player;
    if (!player) {
        _this.logger.info("zsc.ps.1 player don't exist");
        return;
    }

    _this.logger.debug("zsc.ps.1 call success");
    player.startPlay(streamid, _this.playerList[streamid].remoteVideo, _this.playerList[streamid].audioOutput);
}

function checkPreivew(_this, localVideo) {
    for (var i = 0; i < _this.previewVideoList.length; i++) {
        if (_this.previewVideoList[i].localVideo === localVideo) {
            return _this.previewVideoList[i];
        }
    }

    return null;
}

function removePreview(_this, preview) {
    for (var i = 0; i < _this.previewVideoList.length; i++) {
        if (_this.previewVideoList[i] === preview) {
            _this.previewVideoList.splice(i, 1);
            break;
        }
    }
}

/*
 *    "zsc.gts.0": "ZegoStreamCenter.getTokenSuccess"
 */
function getTokenSuccess(_this) {
    _this.logger.debug("zsc.gts.0 call");
}

function shouldRetry(_this, stream, errorCode) {
    if (stream.serverUrls.length == 0) {
        return false;
    }

    if (stream.retryCount >= _this.maxRetryCount) {
        return false;
    }

    if (errorCode != 3) {
        return false;
    }
    
    return true;
}

/*
 *    "zsc.ssh.0": "ZegoStreamCenter.startSignalHeartbeat"
 */
function startSignalHeartbeat(_this) {

    if (_this.heartbeatTimer) {
        clearTimeout(_this.heartbeatTimer);
        _this.heartbeatTimer = null;
    }

    if (!_this.heartbeatTimer) {

        _this.logger.debug("zsc.ssh.0 start");
        
        _this.heartbeatTimer = setTimeout(function() {
            checkSignalHeartbeat(_this);
        }, _this.heartbeatInterval);
    }
}

/*
 *    "zsc.ssh.1": "ZegoStreamCenter.stopSignalHeartbeat"
 */
function stopSignalHeartbeat(_this) {
    _this.logger.debug("zsc.ssh.1 call");

    if (_this.heartbeatTimer && _this.signalList.length == 0) {

        _this.logger.info("zsc.ssh.1 stop");

        clearTimeout(_this.heartbeatTimer);

        _this.heartbeatTimer = null;
    }
}

function checkSignalHeartbeat(_this) {

    for (var streamUrl in _this.signalList) {
        if (_this.signalList[streamUrl].signal) {
            _this.signalList[streamUrl].signal.sendHeartbeat();
        }
    }

    startSignalHeartbeat(_this);
}
/**
 *  ZegoPlay
 */

import "./adapter.js";

import {
    playErrorList,
    ENUM_PLAY_STATE_UPDATE,
    ENUM_RETRY_STATE,
    getSeq
} from "./jZego-extern-rtc.js";

var ENUM_PLAY_STATE = {
    start: 0,
    waitingSessionRsp: 1,
    waitingServerOffer: 2,
    waitingAnswerRsp: 3,
    waitingServerICE: 4,
    connecting: 5,
    playing: 6,
    stop: 7
};

export default function ZegoPlay(logger, signal, dataReport, qualityTimeInterval) {
    this.logger = logger;
    this.signal = signal;
    this.state = ENUM_PLAY_STATE.stop;

    this.waitingICETimeInterval = 5000;
    this.waitingOfferTimeInterval = 5000;
    this.candidateInfo = [];
    
    this.waitICETimer = null;
    this.waitingOfferTimer = null;

    this.qualityTimer = null;
    this.qualityTimeInterval = qualityTimeInterval;
    this.playQualityList = [];
    this.maxQualityListCount = 10;
    this.lastPlayStats = {};

    this.dataReport = dataReport;
    this.reportSeq = getSeq();
    this.dataReport.newReport(this.reportSeq);

    this.videoSizeCallback = false;

    this.qualityUpload = false;
    this.qualityUploadInterval = 30 * 1000;
    this.qualityUploadLastTime = 0;

    //retry
    this.maxRetryCount = 3;
    this.currentRetryCount = 0;
    this.retryState = ENUM_RETRY_STATE.didNotStart;
    this.waitingServerTimerInterval = 3 * 1000;
    this.waitingServerTimer = null;
}

/*
 *    "zp.sad.1": "ZegoPlay.setAudioDestination"
 */
ZegoPlay.prototype.setAudioDestination = function (audioOutput) {
    if (!this.remoteVideo) {
        this.logger.info("zp.sad.1 no remoteVideo");
        return false;
    }

    if (this.remoteVideo.sinkId !== 'undefined') {
        var _this = this;
        this.remoteVideo.setSinkId(audioOutput).then(function() {
            _this.logger.info("zp.sad.1 success device: " + audioOutput);
            // _this.audioOutput = audioOutput;
        }).catch(function(error) {
            _this.logger.info("zp.sad.1 " + error.name);
        });
        return true;
    }
    else {
        this.logger.error("zp.sad.1 browser does not suppport");
        return false;
    }
};

/*
 *    "zp.sp.1": "ZegoPlay.startPlay"
 */
ZegoPlay.prototype.startPlay = function (streamId, remoteVideo, audioOutput) {
    this.logger.debug("zp.sp.1 called ", streamId);

    if (!streamId) {
        this.logger.debug("zp.sp.1 streamId is null");
        return;
    }

    this.streamId = streamId;
    this.remoteVideo = remoteVideo;
    this.audioOutput = audioOutput;

    //create session
    this.sessionSeq = getSeq();
    var _this = this;
    this.dataReport.eventStart(this.reportSeq, "CreateSession");
    this.signal.createSession(this.sessionSeq, 1, streamId, function (seq, sessionId, data) {
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "CreateSession", {
            sessionId: data.session_id
        });

        if (_this.sessionSeq != seq) {
            _this.logger.error("zp.sp.1 seq is not match.");
            return;
        }

        if (data.result !== 0) {
            _this.logger.error("zp.sp.1 create error");
            playStateUpdateError(_this, playErrorList.CREATE_SESSION_ERROR);
        }
        else {
            _this.sessionId = data.session_id;
            onCreatePlaySessionSuccess(_this, data);
        }
        
    }, function (err, seq) {
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "CreateSession", {
            error: err
        });
        
        playStateUpdateError(_this, playErrorList.SEND_SESSION_TIMEOUT);
    });

    this.state = ENUM_PLAY_STATE.waitingSessionRsp;
    this.logger.debug("zp.sp.1 called success");
};

ZegoPlay.prototype.onPlayStateUpdate = function (type, streamId, error) {};

ZegoPlay.prototype.onPlayQualityUpdate = function (streamId, quality) {};

ZegoPlay.prototype.onVideoSizeChanged = function (streamId, videoWidth, videoHeight) {};

/*
 *    "zp.sp.1.1": "ZegoPlay.stopPlay"
 */
ZegoPlay.prototype.stopPlay = function () {
    this.logger.debug("zp.sp.1.1 called");

    //send to server
    if (this.sessionId) {
        this.signal.sendCloseSession(getSeq(), this.sessionId, 0);
    }
    
    this.dataReport.eventEndWithMsg(this.reportSeq, "PlayState", {
        "state": this.state
    });

    this.dataReport.addEvent(this.reportSeq, "StopPlay");

    this.dataReport.addMsgExt(this.reportSeq, {
        "stream": this.streamId,
        "sessionId": this.sessionId
    });
    
    this.dataReport.uploadReport(this.reportSeq, "RTCPlayStream");

    resetPlay(this);
};

/*
 *    "zp.od.1": "ZegoPlay.onDisconnect"
 */
ZegoPlay.prototype.onDisconnect = function() {
    this.logger.info("zp.od.1 call");

    // if (this.sessionId !== sessionId) {
    //     this.logger.info("zp.od.1 session is not same");
    //     return;
    // }

    this.logger.info("zp.od.1 websocket disconnect");
    this.dataReport.addEvent(this.reportSeq, "OnDisconnect");
    
    playStateUpdateError(this, playErrorList.WEBSOCKET_ERROR);
};

//////////////////////////////////////////////////////////////////////////////////////////////
// create session result
/*
 *    "zp.ops.1": "ZegoPlay.onCreatePlaySessionSuccess"
 */
function onCreatePlaySessionSuccess(_this, data) {
    _this.logger.debug("zp.ops.1 success");

    var urls = [];
    if (data.turn_server != undefined && data.turn_server.length != 0) {
        urls.push(data.turn_server);
    }
    if (data.stun_server != undefined && data.stun_server.length != 0) {
        urls.push(data.stun_server);
    }

    var configuration = {
        iceServers: [{
            urls: urls,
            username: data.turn_username,
            credential: data.turn_auth_key
        }]
    };

    _this.logger.info("zp.ops.1 username: " + data.turn_username);
    _this.logger.info("zp.ops.1 credential: " + data.turn_auth_key);

    _this.peerConnection = new RTCPeerConnection(configuration);
    _this.peerConnection.onicecandidate = function (e) {
        onIceCandidate(_this, e);
    };

    _this.peerConnection.onconnectionstatechange = function (e) {
        onConnectionStateChange(_this, e);
    };

    _this.peerConnection.oniceconnectionstatechange = function (e) {
        onIceConnectionStateChange(_this, e);
    };

    _this.peerConnection.onaddstream = function (e) {
        onGotRemoteStream(_this, e);
    };

    // _this.peerConnection.ontrack = function(e) {
    //     onGotRemoteStream(_this, e);
    // };

    _this.remoteVideo.onresize = function() {
        _this.logger.debug("zp.ops.1 " + _this.remoteVideo.videoWidth + " X " + _this.remoteVideo.videoHeight);
        if (!_this.videoSizeCallback) {
            _this.logger.debug("zp.ops.1 onresize callback");
            
            _this.onVideoSizeChanged(_this.streamId, _this.remoteVideo.videoWidth, _this.remoteVideo.videoHeight);
            _this.videoSizeCallback = true;
        }
    };

    //register callback
    _this.signal.registerPushCallback("MediaDescPush", _this.sessionId, onRecvMediaDesc, _this);
    _this.signal.registerPushCallback("CandidateInfoPush", _this.sessionId, onRecvCandidateInfo, _this);
    _this.signal.registerPushCallback("CloseSessionPush", _this.sessionId, onRecvCloseSession, _this);
    // _this.signal.registerPushCallback("WebSocketDisconnect", _this.sessionId, onDisconnect, _this);
    _this.signal.registerPushCallback("SessionResetPush", _this.sessionId, onRecvResetSession, _this);

    _this.state = ENUM_PLAY_STATE.waitingServerOffer;

    //setTimer
    _this.waitingOfferTimer = setTimeout(function() {
        if (_this.state == ENUM_PLAY_STATE.waitingServerOffer) {
            _this.logger.error("zp.ops.1 waiting server timeout");
            playStateUpdateError(_this, playErrorList.SERVER_MEDIA_DESC_TIMEOUT);
        }
    }, _this.waitingOfferTimeInterval);

    _this.logger.debug("zp.ops.1 call success");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push offer (setRemoteDescription)
/*
 *    "zp.orm.1": "ZegoPlay.onRecvMediaDesc"
 */
function onRecvMediaDesc(_this, seq, sessionId, data) {
    _this.logger.debug("zp.orm.1 received ", data);

    if (_this.state != ENUM_PLAY_STATE.waitingServerOffer) {
        _this.logger.info("zp.orm.1 current state " + _this.state + " not allowed");
        return;
    }

    if (_this.waitingOfferTimer != null) {
        clearTimeout(_this.waitingOfferTimer);
        _this.waitingOfferTimer = null;
    }

    _this.dataReport.addEvent(_this.reportSeq, "RecvMediaDesc");
    
    _this.signal.sendMediaDescAck(seq, _this.sessionId, 0);

    var offerDescription = {
        type: "offer",
        sdp: data.sdp
    };

    //setRemoteDescritpion
    _this.dataReport.eventStart(_this.reportSeq, "SetRemoteDescription");
    _this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription)).then(function() {
        _this.dataReport.eventEnd(_this.reportSeq, "SetRemoteDescription");
        
        onSetRemoteDescriptionSuccess(_this);
    }, function(error) {
        _this.logger.error("zp.orm.1 set remote error " + error.toString());

        _this.dataReport.eventEndWithMsg(_this.reportSeq, "SetRemoteDescription", {
            error: error.toString()
        });

        playStateUpdateError(_this, playErrorList.SET_REMOTE_DESC_ERROR);
    });

    _this.logger.debug("zp.orm.1 call success");
}

/*
 *    "zp.ord.1": "ZegoPlay.onSetRemoteDescriptionSuccess"
 */
function onSetRemoteDescriptionSuccess(_this) {
    _this.logger.debug("zp.ord.1 called");

    //create answer
    _this.dataReport.eventStart(_this.reportSeq, "CreateAnswer");
    _this.peerConnection.createAnswer().then(function(desc) {
        _this.dataReport.eventEnd(_this.reportSeq, "CreateAnswer");
        
        onCreateAnswerSuccess(_this, desc);
    }, function(error) {
        _this.logger.error("zp.ord.1 failed: " + error.toString());
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "CreateAnswer", {
            error: error.toString()
        });
        
        playStateUpdateError(_this, playErrorList.CREATE_ANSWER_ERROR);
    });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// create answer result
/*
 *    "zp.oca.1": "ZegoPlay.onCreateAnswerSuccess"
 */
function onCreateAnswerSuccess(_this, desc) {
    _this.logger.debug("zp.oca.1 desc: ", desc.sdp);

    _this.dataReport.eventStart(_this.reportSeq, "SetLocalDescription");
    _this.peerConnection.setLocalDescription(desc).then(
        function () {
            _this.dataReport.eventEnd(_this.reportSeq, "SetLocalDescription");
            
            onSetLocalDescriptionSuccess(_this, desc);
        },
        function (error) {
            _this.logger.error("zp.oca.1 set error " + error.toString());
            _this.dataReport.eventEnd(_this.reportSeq, "SetLocalDescription", {
                error: error.toString()
            });
            
            playStateUpdateError(_this, playErrorList.SET_LOCAL_DESC_ERROR);
        }
    );
}

//////////////////////////////////////////////////////////////////////////////////////////////
// setLocalDescription result
/*
 *    "zp.osd.1": "ZegoPlay.onSetLocalDescriptionSuccess"
 */
function onSetLocalDescriptionSuccess(_this, desc) {
    _this.logger.debug("zp.osd.1 success");

    var mediaDescription = {
        sdp: desc.sdp
    };

    _this.answerSeq = getSeq();
    _this.dataReport.eventStart(_this.reportSeq, "SendMediaDesc");
    _this.signal.sendMediaDesc(_this.answerSeq, _this.sessionId, 1, mediaDescription, function (seq, sessionId, data) {
        if (_this.answerSeq != seq || _this.sessionId != sessionId) {
            _this.logger.error("zp.osd.1 seq or sessionId is not equal " + _this.answerSeq + " " + seq, + " " + _this.sessionId + " " + sessionId);
            return;
        }

        _this.logger.debug("zp.osd.1 send success");

        _this.dataReport.eventEnd(_this.reportSeq, "SendMediaDesc");
        
        _this.state = ENUM_PLAY_STATE.waitingServerICE;

        //send candidate
        sendCandidateInfo(_this, _this.candidateInfo);
        _this.candidateInfo = [];

        //setTimer
        _this.waitICETimer = setTimeout(function() {
            if (_this.state == ENUM_PLAY_STATE.waitingServerICE) {
                _this.logger.error("zp.osd.1 waiting timeout");
                playStateUpdateError(_this, playErrorList.SERVER_CANDIDATE_TIMEOUT);
            }
        }, _this.waitingICETimeInterval);
        
    }, function (err, seq) {
        _this.logger.error("zp.osd.1 failed to send " + err);
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "SendMediaDesc", {
            error: err
        });
        
        playStateUpdateError(_this, playErrorList.SEND_MEDIA_DESC_TIMEOUT);
    });

    _this.state = ENUM_PLAY_STATE.waitingAnswerRsp;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// send candidate Info
/*
 *    "zp.sci.1": "ZegoPlay.sendCandidateInfo"
 */
function sendCandidateInfo(_this, candidateInfo) {
    _this.logger.debug("zp.sci.1 called");
    
    _this.dataReport.eventStart(_this.reportSeq, "SendIceCandidate");
    _this.signal.sendCandidateInfo(getSeq(), _this.sessionId, candidateInfo, function(seq, sessionId, data) {
        _this.logger.debug("zp.sci.1 send success");
        _this.dataReport.eventEnd(_this.reportSeq, "SendIceCandidate");
    }, function(err, seq) {
        _this.logger.error("zp.sci.1 failed to send: " + err.toString());
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "SendIceCandidate", {
            error: err
        });
        
        playStateUpdateError(_this, playErrorList.SEND_CANDIDATE_ERROR);
    });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// onIceCandidate callback
/*
 *    "zp.oic.1": "ZegoPlay.onIceCandidate"
 */
function onIceCandidate(_this, event) {
    _this.logger.info("zp.oic.1 called");

    //send candidate to other peer
    if (event.candidate == undefined) {
        return;
    }

    _this.logger.debug("zp.oic.1 event: " + event.candidate.candidate);

    if (_this.state != ENUM_PLAY_STATE.waitingICE) {
        //save candidate Info
        _this.logger.debug("zp.oic.1 cached");

        _this.candidateInfo.push({
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
        });
    }
    else {
        _this.logger.debug("zp.oic.1 send");
        
        var candidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
        };

        sendCandidateInfo(_this, [candidate]);
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push ICE (addIceCandidate)
/*
 *    "zp.orci.1": "ZegoPlay.onRecvCandidateInfo"
 */
function onRecvCandidateInfo(_this, seq, sessionId, data) {
    _this.logger.debug("zp.orci.1 received ");
    if (_this.state != ENUM_PLAY_STATE.waitingServerICE) {
        _this.logger.info("zp.orci.1 current state " + _this.state + " not allowed");
        return;
    }

    if (_this.waitICETimer != null) {
        clearTimeout(_this.waitICETimer);
        _this.waitICETimer = null;
    }

    _this.dataReport.addEvent(_this.reportSeq, "RecvIceCandidate");
    
    _this.signal.sendCandidateInfoAck(seq, _this.sessionId, 0);

    for (var i = 0; i < data.infos.length; i ++) {
        var ice = {
            sdpMid: data.infos[i].sdpMid,
            sdpMLineIndex: data.infos[i].sdpMLineIndex,
            candidate: data.infos[i].candidate
        };

        _this.logger.debug("zp.orci.1 candidate " + ice.candidate);

        _this.peerConnection.addIceCandidate(new RTCIceCandidate(ice)).then(function() {
            _this.logger.debug("zp.orci.1 add success");
        }, function(error) {
            _this.logger.error("zp.orci.1 add error " + error.toString());
            playStateUpdateError(_this, playErrorList.SERVER_CANDIDATE_ERROR);
        });
    }

    _this.state = ENUM_PLAY_STATE.connecting;

    _this.logger.debug("zp.orci.1 call success");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push closeSession
/*
 *    "zp.orcs.1": "ZegoPlay.onRecvCloseSession"
 */
function onRecvCloseSession(_this, seq, sessionId, data) {
    _this.logger.info("zp.orcs.1 reason: " + data.reason);

    _this.dataReport.addEvent(_this.reportSeq, "RecvCloseSession");
    
    _this.signal.sendCloseSessionAck(seq, _this.sessionId, 0);
    playStateUpdateError(_this, playErrorList.SESSION_CLOSED);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push resetSession
/*
 *    "zp.orrs.1": "ZegoPlay.onRecvResetSession"
 */
function onRecvResetSession(_this, seq, sessionId, data) {
    _this.logger.info("zp.orrs.1 received ");

    if (sessionId != _this.sessionId) {
        _this.logger.info("zp.orrs.1 cannot find session");
        return;
    }

    _this.dataReport.addEvent(_this.reportSeq, "RecvResetSession");

    //check should retry
    if (shouldRetryPlay(_this)) {
        startRetryPlay(_this);
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// retry play
/*
 *    "zp.srp.1.0": "ZegoPlay.shouldRetryPlay"
 */
function shouldRetryPlay(_this) {
    if (_this.retryState == ENUM_RETRY_STATE.didNotStart && _this.state != ENUM_PLAY_STATE.playing) {
        _this.logger.info("zp.srp.1.0 connection didn't success");
        return false;
    }
    
    if (_this.retryState == ENUM_RETRY_STATE.retrying) {
        _this.logger.info("zp.srp.0.0 already retrying");
        return false;
    }

    if (_this.currentRetryCount > _this.maxRetryCount) {
        _this.logger.info("zp.srp.1.0 beyond max");
        return false;
    }

    _this.logger.debug("zp.srp.1.0 call success");
    return true;
}

/*
 *    "zp.srp.1": "ZegoPlay.startRetryPlay"
 */
function startRetryPlay(_this) {
    _this.logger.debug("zp.srp.0 call");

    var streamId = _this.streamId;
    var remoteVideo = _this.remoteVideo;
    var audioOutput = _this.audioOutput;

    resetPlay(_this);

    tryStartPlay(_this, streamId, remoteVideo, audioOutput);
}

/*
 *    "zp.tsp.1": "ZegoPublish.tryStartPlay"
 */
function tryStartPlay(_this, streamId, remoteVideo, audioOputput) {

    _this.logger.debug("zp.tsp.1 call");
    
    clearTryPlayTimer(_this);

    _this.streamId = streamId;
    _this.remoteVideo = remoteVideo;
    _this.audioOutput = audioOputput;
    
    if (_this.currentRetryCount > _this.maxRetryCount) {
        _this.logger.info("zp.tsp.1 beyond max limit");
        //callback error
        playStateUpdateError(_this, playErrorList.WEBSOCKET_ERROR);
        return;
    }

    _this.retryState = ENUM_RETRY_STATE.retrying;
    _this.currentRetryCount += 1;

    if (_this.signal.isServerConnected()) {
        _this.logger.debug("zp.tsp.1 signal connected");

        _this.startPlay(streamId, _this.remoteVideo, _this.audioOputput);
    }
    else {
        //setTimer
        _this.logger.debug("zp.tsp.1 signal server not connected");
        
        _this.waitingAnswerTimer = setTimeout(function() {
            tryStartPlay(_this, streamId, _this.remoteVideo, _this.audioOputput);
        }, _this.waitingAnswerTimeInterval);
    }
}

function clearTryPlayTimer(_this) {
    if (_this.waitingServerTimer != null) {
        clearTimeout(_this.waitingServerTimer);
        _this.waitingServerTimer = null;
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// onIceStateChange callback
/*
 *    "zp.ocs.1": "ZegoPlay.onConnectionStateChange"
 */
function onConnectionStateChange(_this, event) {
    _this.logger.info("zp.oisc.1 called");
}

/*
 *    "zp.oics.1": "ZegoPlay.onIceConnectionStateChange"
 */
function onIceConnectionStateChange(_this, event) {

    if (_this.state == ENUM_PLAY_STATE.stop || _this.peerConnection == null) {
        return;
    }
    
    _this.logger.info("zp.oisc.1  stateChanged " + _this.peerConnection.iceConnectionState);

    if (_this.peerConnection.iceConnectionState === "connected") {
        _this.dataReport.addEvent(_this.reportSeq, "IceConnected");

        if (_this.state != ENUM_PLAY_STATE.playing) {
            _this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.start, _this.streamId);
        }

        _this.state = ENUM_PLAY_STATE.playing;
        if (_this.retryState != ENUM_RETRY_STATE.didNotStart) {
            _this.retryState = ENUM_RETRY_STATE.finished;
            _this.currentRetryCount = 0;
        }

        //play started
        _this.dataReport.eventStart(_this.reportSeq, "PlayState");

        //start quality timeInterval
        setPlayQualityTimer(_this);
    }
    else if (_this.peerConnection.iceConnectionState === "closed") {
        _this.dataReport.addEvent(_this.reportSeq, "IceClosed");

        checkPlayConnectionFailedState(_this, _this.peerConnection.iceConnectionState);
    }
    else if (_this.peerConnection.iceConnectionState === "failed") {
        _this.dataReport.addEvent(_this.reportSeq, "IceFailed");

        checkPlayConnectionFailedState(_this, _this.peerConnection.iceConnectionState);
    }
}

function checkPlayConnectionFailedState(_this, connectionState) {
    var state = null;
    if (connectionState == "failed") {
        state = playErrorList.MEDIA_CONNECTION_FAILED;
    }
    else if (connectionState == "closed") {
        state = playErrorList.MEDIA_CONNECTION_CLOSED;
    }

    if (state == null) {
        return;
    }

    if (_this.state != ENUM_PLAY_STATE.publishing && _this.retryState == ENUM_PLAY_STATE.didNotStart) {
        _this.logger.info("zp.oics.1  state " + _this.state + " retryState "+ _this.retryState + " connectionState " + connectionState);

        playStateUpdateError(_this, state);
    }
    else {
        if (shouldRetryPlay(_this)) {
            _this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.retry, _this.streamId);
    
            startRetryPlay(_this);
        }
        else {
            playStateUpdateError(_this, state);
        }
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// onGotRemoteStream callback
/*
 *    "zp.ogrs.1": "ZegoPlay.onGotRemoteStream"
 */
function onGotRemoteStream(_this, event) {
    _this.logger.info("zp.ogrs.0 called " + event.stream);
    if (!_this.remoteVideo) {
        _this.logger.info("zp.ogrs.0 no remoteVideo");
        return;
    }

    _this.remoteVideo.srcObject = event.stream;

    if (_this.audioOputput) {
        _this.setAudioDestination(_this.audioOputput);
    }

    _this.dataReport.addEvent(_this.reportSeq, "GetRemoteStream");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// quality timer
/*
 *    "zp.spq.1": "ZegoPlay.setPlayQualityTimer"
 */
function setPlayQualityTimer(_this) {
    if (_this.qualityTimer != null) {
        return;
    }

    _this.logger.debug("zp.spq.1 startTimer");
    
    clearPlayQualityTimer(_this);
    
    _this.qualityTimer = setInterval(function() {

        if (_this.peerConnection) {
            _this.peerConnection.getStats(null).then(function(results) {
                getPlayStats(_this, results);
            }, function(error) {
                _this.logger.info("zp.spq.1 getStats error " + error.toString());
            });
        }

    }, _this.qualityTimeInterval);

    _this.lastPlayStats = {
        time: 0,
        audioBytesReceived: 0,
        videoBytesReceived: 0,
        framesDecoded: 0,
        framesReceived: 0,
        framesDropped: 0
    };
}

/*
 *    "zp.gps.1": "ZegoPlay.getPlayStats"
 */
function getPlayStats(_this, results) {
    if (results == undefined) {
        return;
    }

    var playData = {};
    var time = _this.lastPlayStats.time;
    results.forEach(function(result) {
        if ((result.type == "inbound-rtp" || (result.type == "ssrc" && result.bytesReceived != undefined)) && (result.mediaType == "audio" || result.id.indexOf("AudioStream") >= 0)) {
            //audio
            if (time != 0) {
                playData.audioBitrate = 8 * (result.bytesReceived - _this.lastPlayStats.audioBytesReceived) / (result.timestamp - time);
            }

            if (playData.audioBitrate < 0) {
                playData.audioBitrate = 0;
            }
        
            playData.audioFractionLost = result.fractionLost;

            _this.lastPlayStats.audioBytesReceived = result.bytesReceived;
            _this.lastPlayStats.time = result.timestamp;
        }
        else if ((result.type == "inbound-rtp" || (result.type == "ssrc" && result.bytesReceived != undefined)) && (result.mediaType == "video" || result.id.indexOf("VideoStream") >= 0)) {
            //video
            if (time != 0) {
                playData.videoBitrate = 8 * (result.bytesReceived - _this.lastPlayStats.videoBytesReceived) / (result.timestamp - time);
                playData.videoFPS = 1000 * (result.framesDecoded - _this.lastPlayStats.framesDecoded) / (result.timestamp - time);
            }
            
            if (playData.videoBitrate < 0) {
                playData.videoBitrate = 0;
            }

            if (playData.videoFPS < 0) {
                playData.videoFPS = 0;
            }

            playData.jitter = result.jitter;
            playData.nackCount = result.nackCount;
            playData.pliCount = result.pliCount;
            playData.sliCount = result.sliCount;
            playData.videoFractionLost = result.fractionLost;
            
            _this.lastPlayStats.videoBytesReceived = result.bytesReceived;
            _this.lastPlayStats.framesDecoded = result.framesDecoded;
            _this.lastPlayStats.time = result.timestamp;
        }
        else if (result.type == "track" && (result.kind == "video" || result.id.indexOf("video") >= 0)) {
            playData.frameHeight = result.frameHeight;
            playData.frameWidth = result.frameWidth;

            if (time != 0) {
                playData.videoTransferFPS = 1000 * (result.framesReceived - _this.lastPlayStats.framesReceived) / (result.timestamp - time);
                playData.framesDropped = result.framesDropped - _this.lastPlayStats.framesDropped;
            }
            
            if (playData.videoTransferFPS < 0) {
                playData.videoTransferFPS = 0;
            }

            if (playData.framesDropped < 0) {
                playData.framesDropped = 0;
            }
            
            _this.lastPlayStats.framesReceived = result.framesReceived;
            _this.lastPlayStats.framesDropped = result.framesDropped;
        }
        else if (result.type == "candidate-pair") {
            if (result.totalRoundTripTime != undefined) {
                playData.totalRoundTripTime = result.totalRoundTripTime;
            }
            
            if (result.currentRoundTripTime != undefined) {
                playData.currentRoundTripTime = result.currentRoundTripTime;
            }
        }
    });

    // _this.logger.debug("zp.gps.1 audio: " + playData.audioBitrate + " video: " + playData.videoBitrate + 
    // " FPS: " + playData.videoFPS + " transfer: " + playData.videoTransferFPS);

    uploadPlayQuality(_this, playData);
    
    if (time != 0) {
        _this.onPlayQualityUpdate(_this.streamId, playData);
    }
}

function clearPlayQualityTimer(_this) {
    if (_this.qualityTimer != null) {
        clearInterval(_this.qualityTimer);
        _this.qualityTimer = null;
    }

    _this.lastPlayStats = {};
}

/*
 *    "zp.upq.1": "ZegoPlay.uploadPlayQuality"
 */
function uploadPlayQuality(_this, playData) {
    if (!_this.qualityUpload) {
        return;
    }

    var timeStamp = Date.parse(new Date());
    if (_this.qualityUploadLastTime == 0 || timeStamp - _this.qualityUploadLastTime >= _this.qualityUploadInterval) {
        _this.logger.debug("zp.upq.1 upload");

        playData["stream_type"] = "play";
        playData["stream_id"] = _this.streamId;
        playData["timeStamp"] = timeStamp / 1000;

        _this.signal.QualityReport(getSeq(), _this.sessionId, playData, function(seq, sessionId, data) {
            if (data.report !== undefined) {
                _this.qualityUpload = data.report;
                _this.qualityUploadInterval = data.report_interval_ms;
            }
        }, function(err, seq) {
            _this.logger.info("zp.upq.1 upload failed " + err);
        });

        _this.qualityUploadLastTime = timeStamp;
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// error function
function shouldSendCloseSession(_this, errorCode) {
    if (_this.state != ENUM_PLAY_STATE_UPDATE.stop && _this.state != ENUM_PLAY_STATE.waitingSessionRsp) {
        return true;
    }

    return false;
}

function playStateUpdateError(_this, errorCode) {
    if (_this.sessionId != 0 && shouldSendCloseSession(_this, errorCode)) {
        _this.signal.sendCloseSession(getSeq(), _this.sessionId, 1);
    }

    _this.state = ENUM_PLAY_STATE.stop;
    _this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.error, _this.streamId, errorCode);
    
    resetPlay(_this);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// reset function
/*
 *    "zp.rp.1": "ZegoPlay.resetPlay"
 */
function resetPlay(_this) {
    _this.logger.info("zp.rp.1 call");

    _this.streamId = null;
    _this.state = ENUM_PLAY_STATE.stop;

    if (_this.peerConnection != undefined) {
        _this.peerConnection.close();
        _this.peerConnection = null;
    }

    if (_this.waitingOfferTimer != null) {
        clearTimeout(_this.waitingOfferTimer);
        _this.waitingOfferTimer = null;
    }

    if (_this.waitICETimer != null) {
        clearTimeout(_this.waitICETimer);
        _this.waitICETimer = null;
    }

    clearPlayQualityTimer(_this);

    if (_this.remoteVideo) {
        _this.remoteVideo.srcObject = null;
        _this.remoteVideo = null;
    }

    _this.audioOputput = null;
    
    if (_this.signal) {
        _this.signal.unregisterPushCallback("MediaDescPush", _this.sessionId);
        _this.signal.unregisterPushCallback("CandidateInfoPush", _this.sessionId);
        _this.signal.unregisterPushCallback("CloseSessionPush", _this.sessionId);
        // _this.signal.unregisterPushCallback('WebSocketDisconnect', _this.sessionId);
    }
    
    // _this.sessionId = 0;
    _this.sessionSeq = 0;
    _this.answerSeq = 0;
    

    _this.videoSizeCallback = false;

    _this.currentRetryCount = 0;
    _this.retryState = ENUM_RETRY_STATE.didNotStart;
    clearTryPlayTimer(_this);
}
/**
 * ZegoPublish
 */

import adapter from "./adapter.js";

import {
    publishErrorList,
    ENUM_PUBLISH_STATE_UPDATE,
    ENUM_RETRY_STATE,
    getSeq,
} from "./jZego-extern-rtc.js";

var ENUM_PUBLISH_STATE = {
    start: 0,
    waitingSessionRsp: 1, //等待Session回包
    waitingOffserRsp: 2, //等待offser回包
    waitingServerAnswer: 3, //等待server answer
    waitingServerICE: 4, //等待candidate
    connecting: 5, //等待candidate连接
    publishing: 6, //开始推流
    stop: 7
};


export default function ZegoPublish(logger, signal, dataReport, qualityTimeInterval) {
    this.logger = logger;
    this.signal = signal;
    this.state = ENUM_PUBLISH_STATE.Stop;

    this.sessionId = 0;

    // this.localVideo = null;
    // this.localStream = null;
    
    this.waitingICETimeInterval = 5000;
    this.waitingAnswerTimeInterval = 5000;
    this.candidateInfo = [];

    this.waitingICETimer = null;
    this.waitingAnswerTimer = null;

    this.qualityTimer = null;
    this.qualityTimeInterval = qualityTimeInterval;
    this.publishQualityList = [];
    this.maxQualityListCount = 10;
    this.lastPublishStats = {};
    
    this.reportSeq = getSeq();
    this.dataReport = dataReport;
    this.dataReport.newReport(this.reportSeq);

    //quality signal
    this.qualityUpload = false;
    this.qualityUploadInterval = 30 * 1000;
    this.qualityUploadLastTime = 0;

    //retry
    this.maxRetryCount = 3;
    this.currentRetryCount = 0;
    this.retryState = ENUM_RETRY_STATE.didNotStart;
    this.waitingServerTimerInterval = 3 * 1000;
    this.waitingServerTimer = null;

    this.videoInfo = {
        width: 0,
        height: 0,
        frameRate: 0,
        bitRate: 0
    };
}

/*
 *    "zp.sp.0": "ZegoPublish.startPublish"
 */
ZegoPublish.prototype.startPublish = function (streamId, localStream, videoInfo) {
    this.logger.debug("zp.sp.0 called");

    if (!streamId) {
        this.logger.debug("zp.sp.0 streamId is null");
        return;
    }
    
    this.streamId = streamId;
    this.localStream = localStream;
    if (videoInfo) {
        this.videoInfo = videoInfo;
    }

    //send to server
    this.sessionSeq = getSeq();
    var _this = this;
    this.dataReport.eventStart(this.reportSeq, "CreateSession");
    this.signal.createSession(this.sessionSeq, 0, streamId, function (seq, sessionId, data) {
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "CreateSession", {
            sessionId: data.session_id
        });
        
        if (_this.sessionSeq != seq) {
            _this.logger.error("zp.sp.0 seq is not match.");
            return;
        }

        if (data.result !== 0) {
            _this.logger.info("zp.sp.0 create session failed " + data.result);

            publishStateUpdateError(_this, publishErrorList.CREATE_SESSION_ERROR);
        } else {
            _this.sessionId = data.session_id;
            _this.logger.debug("zp.sp.0 create session success " + _this.sessionId);
            
            onCreatePublishSessionSuccess(_this, data);
        }
    }, function (err, seq) {
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "CreateSession", {
            error: err
        });
        
        publishStateUpdateError(_this, publishErrorList.SEND_SESSION_TIMEOUT);
    });

    this.state = ENUM_PUBLISH_STATE.waitingSessionRsp;
    this.logger.debug("zp.sp.0 called success");
};

/*
 *    "zp.sp.0.1": "ZegoPublish.stopPublish"
 */
ZegoPublish.prototype.stopPublish = function () {
    this.logger.debug("zp.sp.0.1 called");
    
    //close session
    if (this.sessionId) {
        this.signal.sendCloseSession(getSeq(), this.sessionId, 0);
    }

    this.dataReport.eventEndWithMsg(this.reportSeq, "PublishState", {
        "state": this.state
    });

    this.dataReport.addEvent(this.reportSeq, "StopPublish");

    this.dataReport.addMsgExt(this.reportSeq, {
        "stream": this.streamId,
        "sessionId": this.sessionId
    });

    this.dataReport.uploadReport(this.reportSeq, "RTCPublishStream");
        
    resetPublish(this);
};


ZegoPublish.prototype.onPublishStateUpdate = function (type, streamId, error) {};

ZegoPublish.prototype.onPublishQualityUpdate = function (streamId, quality) {};

/*
 *    "zp.od.0": "ZegoPublish.onDisconnect"
 */
ZegoPublish.prototype.onDisconnect = function () {
    this.logger.info("zp.od.0 call");

    // if (this.sessionId !== sessionId) {
    //     this.logger.info("zp.od.0 session is not same");
    //     return;
    // }

    this.logger.info("zp.od.0 websocket disconnect");
    this.dataReport.addEvent(this.reportSeq, "OnDisconnect");

    publishStateUpdateError(this, publishErrorList.WEBSOCKET_ERROR);
};

//////////////////////////////////////////////////////////////////////////////////////////////
// create session result
/*
 *    "zp.ops.0": "ZegoPublish.onCreatePublishSessionSuccess"
 */
function onCreatePublishSessionSuccess(_this, data) {
    //create offer
    _this.logger.debug("zp.ops.0 called");
    // _this.state = ENUM_PUBLISH_STATE.Start;

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

    _this.logger.info("zp.ops.0 username: " + data.turn_username);
    _this.logger.info("zp.ops.0 credential: " + data.turn_auth_key);

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

    if (_this.localStream) {
        _this.localStream.getTracks().forEach(
            function (track) {
                _this.peerConnection.addTrack(track, _this.localStream);
            }
        );

        var videoTracks = _this.localStream.getVideoTracks();
        var audioTracks = _this.localStream.getAudioTracks();
        if (videoTracks.length > 0)
            _this.logger.info("zp.ops.0 video device: " + videoTracks[0].lable);
        if (audioTracks.length > 0)
            _this.logger.info("zp.ops.0 audio device: " + audioTracks[0].lable);

    }

    var offerOptions = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
    };

    //create offer
    _this.dataReport.eventStart(_this.reportSeq, "CreateOffer");
    _this.peerConnection.createOffer(offerOptions).then(
        function (desc) {
            _this.dataReport.eventEnd(_this.reportSeq, "CreateOffer");
            
            onCreateOfferSuccess(_this, desc);
        },
        function (error) {
            _this.dataReport.eventEndWithMsg(_this.reportSeq, "CreateOffer", {
                error: error.toString()
            });
            
            _this.logger.error("zp.ops.0 create offer error " + error.toString());
            publishStateUpdateError(_this, publishErrorList.CREATE_OFFER_ERROR);
        }
    );

    //register callback
    _this.signal.registerPushCallback("CandidateInfoPush", _this.sessionId, onRecvCandidateInfo, _this);
    _this.signal.registerPushCallback("CloseSessionPush", _this.sessionId, onRecvCloseSession, _this);
    _this.signal.registerPushCallback("MediaDescPush", _this.sessionId, onRecvMediaDescription, _this);
    // _this.signal.registerPushCallback("WebSocketDisconnect", _this.sessionId, onDisconnect, _this);
    _this.signal.registerPushCallback("SessionResetPush", _this.sessionId, onRecvResetSession, _this);
    
    _this.logger.debug("zp.ops.0 call success");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// create offer result
/*
 *    "zp.oco.0": "ZegoPublish.onCreateOfferSuccess"
 */
function onCreateOfferSuccess(_this, desc) {
    //_this.logger.debug("zp.oco.0 success. before desc: " + desc.sdp);
    
    //change bandwidth
    if (_this.videoInfo.bitRate != 0)
        desc.sdp = updateBandwidthRestriction(desc.sdp, _this.videoInfo.bitRate);

    _this.logger.debug("zp.oco.0 success. desc: " + desc.sdp);

    _this.dataReport.eventStart(_this.reportSeq, "SetLocalDescription");
    _this.peerConnection.setLocalDescription(desc).then(
        function () {
            _this.dataReport.eventEnd(_this.reportSeq, "SetLocalDescription");
            
            onSetLocalDescriptionSuccess(_this, desc);
        },
        function (error) {
            _this.dataReport.eventEndWithMsg(_this.reportSeq, "SetLocalDescription", {
                error: error.toString()
            });

            _this.logger.error("zp.oco.0 error " + error.toString());
            publishStateUpdateError(_this, publishErrorList.SET_LOCAL_DESC_ERROR);
        }
    );
}

function updateBandwidthRestriction(sdp, bandwidth) {
    var modifier = 'AS';
    if (adapter.browserDetails.browser === 'firefox') {
        bandwidth = (bandwidth >>> 0) * 1000;
        modifier = 'TIAS';
    }
    if (sdp.indexOf('b=' + modifier + ':') === -1) {
        // insert b= after c= line.
        sdp = sdp.replace(/c=IN (.*)\r\n/,
            'c=IN $1\r\nb=' + modifier + ':' + bandwidth + '\r\n');
    } 
    else {
        sdp = sdp.replace(new RegExp('b=' + modifier + ':.*\r\n'),
            'b=' + modifier + ':' + bandwidth + '\r\n');
    }

    return sdp;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// setLocalDescription result
/*
 *    "zp.osd.0": "ZegoPublish.onSetLocalDescriptionSuccess"
 */
function onSetLocalDescriptionSuccess(_this, desc) {
    _this.logger.debug("zp.osd.0 success");

    //send offer to other peer
    var mediaDescription = {
        sdp: desc.sdp,
        width: _this.videoInfo.width,
        height: _this.videoInfo.height,
        frameRate: _this.videoInfo.frameRate,
        video_min_kpbs: _this.videoInfo.bitRate,
        video_max_kpbs: _this.videoInfo.bitRate,
        audio_kpbs: 48
    };

    _this.offerSeq = getSeq();
    _this.dataReport.eventStart(_this.reportSeq, "SendMediaDesc");
    _this.signal.sendMediaDesc(_this.offerSeq, _this.sessionId, 0, mediaDescription, function (seq, sessionId, data) {
        if (_this.offerSeq != seq || _this.sessionId != sessionId) {
            _this.logger.error("zp.osd.0 seq or sessionId is not equal");
            return;
        }

        _this.logger.debug("zp.osd.0 send success");
        _this.dataReport.eventEnd(_this.reportSeq, "SendMediaDesc");
        
        //set timer for waiting
        _this.waitingAnswerTimer = setTimeout(function () {
            if (_this.state == ENUM_PUBLISH_STATE.waitingServerAnswer) {
                _this.logger.error("zp.osd.0 waiting timeout");
                publishStateUpdateError(_this, publishErrorList.SERVER_MEDIA_DESC_TIMEOUT);
            }
        }, _this.waitingAnswerTimeInterval);

        _this.state = ENUM_PUBLISH_STATE.waitingServerAnswer;

    }, function (err, seq) {
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "SendMediaDesc", {
            error: err
        });
        
        publishStateUpdateError(_this, publishErrorList.SEND_MEDIA_DESC_TIMEOUT);
    });

    _this.state = ENUM_PUBLISH_STATE.waitingOffserRsp;
    _this.logger.debug("zp.osd.0 call success");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push SDP (setRemoteDesription)
/*
 *    "zp.ormd.0": "ZegoPublish.onRecvMediaDescription"
 */
function onRecvMediaDescription(_this, seq, sessionId, data) {
    _this.logger.debug("zp.ormd.0 received");
    if (_this.state != ENUM_PUBLISH_STATE.waitingServerAnswer) {
        _this.logger.info("zp.ormd.0 current state " + _this.state + " not allowed");
        return;
    }

    //clear timer
    if (_this.waitingAnswerTimer != null) {
        clearTimeout(_this.waitingAnswerTimer);
        _this.waitingAnswerTimer = null;
    }

    _this.dataReport.addEvent(_this.reportSeq, "RecvMediaDesc");
    
    _this.signal.sendMediaDescAck(seq, _this.sessionId, 0);

    //not answer
    if (data.type == 1) {
        onGetRemoteOfferSucceses(_this, data.sdp);
    } else {
        //server send error
        publishStateUpdateError(_this, publishErrorList.SERVER_MEDIA_DESC_ERROR);
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push offer (setRemoteDescription)
/*
 *    "zp.oro.0": "ZegoPublish.onGetRemoteOfferSucceses"
 */
function onGetRemoteOfferSucceses(_this, desc) {
    _this.logger.debug("zp.oro.0 received");

    var answerDescription = {
        type: "answer",
        sdp: desc
    };

    _this.dataReport.eventStart(_this.reportSeq, "SetRemoteDescription");
    
    _this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerDescription)).then(function () {
        _this.logger.debug("zp.oro.0 set success");
        _this.dataReport.eventEnd(_this.reportSeq, "SetRemoteDescription");
    }, function (error) {
        _this.logger.error("zp.oro.0 failed: " + error.toString());
        _this.dataReport.eventEndWithMsg(_this.reportSeq, "SetRemoteDescription", {
            error: error.toString()
        });
        
        publishStateUpdateError(_this, publishErrorList.SET_REMOTE_DESC_ERROR);
    });

    sendCandidateInfo(_this, _this.candidateInfo);
    _this.candidateInfo = [];

    _this.state = ENUM_PUBLISH_STATE.waitingServerICE;

    //setTimer
    _this.waitingICETimer = setTimeout(function () {
        if (_this.state == ENUM_PUBLISH_STATE.waitingServerICE) {
            _this.logger.error("zp.orod.0 waiting server timeout");
            publishStateUpdateError(_this, publishErrorList.SERVER_CANDIDATE_TIMEOUT);
        }
    }, _this.waitingICETimeInterval);

    _this.logger.debug("zp.oro.0 call success");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// send candidate Info
/*
 *    "zp.sci.0": "ZegoPublish.sendCandidateInfo"
 */
function sendCandidateInfo(_this, candidateInfo) {
    _this.logger.debug("zp.sci.0 called");
    
    _this.dataReport.eventStart(_this.reportSeq, "SendIceCandidate");
    _this.signal.sendCandidateInfo(getSeq(), _this.sessionId, candidateInfo, function (seq, sessionId, data) {
        _this.logger.debug("zp.sci.0 send success");
        _this.dataReport.eventEnd(_this.reportSeq, "SendIceCandidate");
    }, function (err, seq) {
        _this.logger.error("zp.sci.0 failed to send: " + err.toString());

        _this.dataReport.eventEndWithMsg(_this.reportSeq, "SendIceCandidate", {
            error: err
        });

        publishStateUpdateError(_this, publishErrorList.SEND_CANDIDATE_TIMEOUT);
    });
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push ICE (addICECandidate)
/*
 *    "zp.oci.0": "ZegoPublish.onRecvCandidateInfo"
 */
function onRecvCandidateInfo(_this, seq, sessionId, data) {
    _this.logger.debug("zp.oci.0 received " + data.infos.length);
    if (_this.state != ENUM_PUBLISH_STATE.waitingServerICE) {
        _this.logger.info("zp.oci.0 current state " + _this.state + " not allowed");
        return;
    }

    if (_this.waitingICETimer != null) {
        clearTimeout(_this.waitingICETimer);
        _this.waitingICETimer = null;
    }

    _this.dataReport.addEvent(_this.reportSeq, "RecvIceCandidate");

    _this.signal.sendCandidateInfoAck(seq, _this.sessionId, 0);

    for (var i = 0; i < data.infos.length; i++) {
        var ice = {
            sdpMid: data.infos[i].sdpMid,
            sdpMLineIndex: data.infos[i].sdpMLineIndex,
            candidate: data.infos[i].candidate
        };

        _this.logger.debug("zp.orci.0 candidate " + ice.candidate);

        _this.peerConnection.addIceCandidate(new RTCIceCandidate(ice)).then(function () {
            _this.logger.debug("zp.oci.0 add success");
        }, function (error) {
            _this.logger.error("zp.oci.0 add error " + error.toString());
            publishStateUpdateError(_this, publishErrorList.SERVER_CANDIDATE_ERROR);
        });
    }

    _this.state = ENUM_PUBLISH_STATE.connecting;

    _this.dataReport.eventStart(_this.reportSeq, "IceConnected");
}

//////////////////////////////////////////////////////////////////////////////////////////////
// onIceCandidate callback
/*
 *    "zp.oic.0": "ZegoPublish.onIceCandidate"
 */
function onIceCandidate(_this, event) {

    if (event.candidate == undefined) {
        return;
    }

    _this.logger.info("zp.oic.0 " + event.candidate.candidate);

    if (_this.state != ENUM_PUBLISH_STATE.waitingICE) {
        //save candidate Info

        _this.candidateInfo.push({
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
        });
    } else {
        var candidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
        };

        sendCandidateInfo(_this, [candidate]);
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push closeSession
/*
 *    "zp.orcs.0": "ZegoPublish.onRecvCloseSession"
 */
function onRecvCloseSession(_this, seq, sessionId, data) {
    _this.logger.info("zp.orcs.0 reason: " + data.reason);

    _this.dataReport.addEvent(_this.reportSeq, "RecvCloseSession");
    
    _this.signal.sendCloseSessionAck(seq, _this.sessionId, 0);
    publishStateUpdateError(_this, publishErrorList.SESSION_CLOSED);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// server push resetSession
/*
 *    "zp.orrs.0": "ZegoPublish.onRecvResetSession"
 */
function onRecvResetSession(_this, seq, sessionId, data) {
    _this.logger.info("zp.orrs.0 received ");

    if (sessionId != _this.sessionId) {
        _this.logger.info("zp.orrs.0 cannot find session");
        return;
    }

    _this.dataReport.addEvent(_this.reportSeq, "RecvResetSession");

    //check should retry
    if (shouldRetryPublish(_this)) {        
        startRetryPublish(_this);
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// retry publish
/*
 *    "zp.srp.0.0": "ZegoPublish.shouldRetryPublish"
 */
function shouldRetryPublish(_this) {
    if (_this.retryState == ENUM_RETRY_STATE.didNotStart && _this.state != ENUM_PUBLISH_STATE.publishing) {
        _this.logger.info("zp.srp.0.0 connection didn't success");
        return false;
    }
    
    if (_this.retryState == ENUM_RETRY_STATE.retrying) {
        _this.logger.info("zp.srp.0.0 already retrying");
        return false;
    }
    
    if (_this.currentRetryCount > _this.maxRetryCount) {
        _this.logger.info("zp.srp.0.0 beyond max");
        return false;
    }

    _this.logger.debug("zp.srp.1.0 call success");
    return true;
}

/*
 *    "zp.srp.0": "ZegoPublish.startRetryPublish"
 */
function startRetryPublish(_this) {
    _this.logger.debug("zp.srp.0 call");

    var streamId = _this.streamId;
    if (!streamId) {
        _this.logger.info("zp.srp.0 no streamid");
        return;
    }

    resetPublish(_this);

    tryStartPublish(_this, streamId);
}

/*
 *    "zp.tsp.0": "ZegoPublish.tryStartPublish"
 */
function tryStartPublish(_this, streamId) {

    _this.logger.debug("zp.tsp.0 call");
    
    clearTryPublishTimer(_this);

    _this.streamId = streamId;
    if (_this.currentRetryCount > _this.maxRetryCount) {
        _this.logger.info("zp.tsp.0 beyond max limit");
        //callback error
        publishStateUpdateError(_this, publishErrorList.WEBSOCKET_ERROR);
        return;
    }

    _this.retryState = ENUM_RETRY_STATE.retrying;
    _this.currentRetryCount += 1;

    if (_this.signal.isServerConnected()) {
        _this.logger.debug("zp.tsp.0 signal connected");

        _this.startPublish(streamId);
    }
    else {
        //setTimer
        _this.logger.debug("zp.tsp.0 signal server not connected");
        
        _this.waitingAnswerTimer = setTimeout(function() {
            tryStartPublish(_this, streamId);
        }, _this.waitingAnswerTimeInterval);
    }
}

function clearTryPublishTimer(_this) {
    if (_this.waitingServerTimer != null) {
        clearTimeout(_this.waitingServerTimer);
        _this.waitingServerTimer = null;
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// onIceStateChange callback
/*
 *    "zp.ocs.0": "ZegoPublish.onConnectionStateChange"
 */
function onConnectionStateChange(_this, event) {
    _this.logger.info("zp.ocs.0 called");
}

/*
 *    "zp.oics.0": "ZegoPublish.onIceConnectionStateChange"
 */
function onIceConnectionStateChange(_this, event) {

    if (_this.state == ENUM_PUBLISH_STATE.stop || _this.peerConnection == null) {
        return;
    }

    _this.logger.info("zp.oics.0 stateChanged " + _this.peerConnection.iceConnectionState);

    if (_this.peerConnection.iceConnectionState === "connected") {

        _this.logger.info("zp.oics.0 connected state " + _this.state);

        _this.dataReport.eventEnd(_this.reportSeq, "IceConnected");
        
        if (_this.state != ENUM_PUBLISH_STATE.publishing) {
            _this.onPublishStateUpdate(ENUM_PUBLISH_STATE_UPDATE.start, _this.streamId);
        }

        _this.state = ENUM_PUBLISH_STATE.publishing;
        if (_this.retryState != ENUM_RETRY_STATE.didNotStart) {
            _this.retryState = ENUM_RETRY_STATE.finished;
            _this.currentRetryCount = 0;
        }
        
        //publish started
        _this.dataReport.eventStart(_this.reportSeq, "PublishState");
        
        //start quality timeInterval
        setPublishQualityTimer(_this);
    }
    else if (_this.peerConnection.iceConnectionState === "closed") {

        _this.dataReport.addEvent(_this.reportSeq, "IceClosed");
        
        checkPublishConnectionFailedState(_this, _this.peerConnection.iceConnectionState);
        
    }
    else if (_this.peerConnection.iceConnectionState === "failed") {
        _this.dataReport.addEvent(_this.reportSeq, "IceFailed");
        
        checkPublishConnectionFailedState(_this, _this.peerConnection.iceConnectionState);
    }
}

function checkPublishConnectionFailedState(_this, connectionState) {
    var state = null;
    if (connectionState == "failed") {
        state = publishErrorList.MEDIA_CONNECTION_FAILED;
    }
    else if (connectionState == "closed") {
        state = publishErrorList.MEDIA_CONNECTION_CLOSED;
    }

    if (state == null) {
        return;
    }

    if (_this.state != ENUM_PUBLISH_STATE.publishing && _this.retryState == ENUM_PUBLISH_STATE.didNotStart) {
        _this.logger.info("zp.oics.0  state " + _this.state + " retryState "+ _this.retryState + " connectionState " + connectionState);

        publishStateUpdateError(_this, state);
    }
    else {
        if (shouldRetryPublish(_this)) {
            _this.onPublishStateUpdate(ENUM_PUBLISH_STATE_UPDATE.retry, _this.streamId);
    
            startRetryPublish(_this);
        }
        else {
            publishStateUpdateError(_this, state);
        }
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// quality timer
/*
 *    "zp.spq.0": "ZegoPublish.setPublishQualityTimer"
 */
function setPublishQualityTimer(_this) {
    if (_this.qualityTimer != null) {
        return;
    }

    _this.logger.debug("zp.spq.0 called");
    
    clearPublishQualityTimer(_this);
    
    _this.qualityTimer = setInterval(function() {

        if (_this.peerConnection) {
            _this.peerConnection.getStats(null).then(function(results) {
                getPublishStats(_this, results);
            }, function(error) {
                _this.logger.info("zp.spq.0 getStats error " + error.toString());
            });
        }
        
    }, _this.qualityTimeInterval);

    _this.lastPublishStats = {
        time: 0,
        audioBytesSent: 0,
        videoBytesSent: 0,
        framesEncoded: 0,
        framesSent: 0
    };

    _this.qualitySeq = getSeq();
    _this.qualityCount = 0;
    _this.dataReport.newReport(_this.qualitySeq);
}

/*
 *    "zp.gps.0": "ZegoPublish.getPublishStats"
 */
function getPublishStats(_this, results) {
    if (results == undefined) {
        return;
    }

    var publishData = {};
    var time = _this.lastPublishStats.time;
    results.forEach(function(result) {
        if ((result.type == "outbound-rtp" || (result.type == "ssrc" && result.bytesSent != undefined)) && result.mediaType == "audio") {
            //audio
            if (time != 0) {
                publishData.audioBitrate = 8 * (result.bytesSent - _this.lastPublishStats.audioBytesSent) / (result.timestamp - time);
            }
            
            if (publishData.audioBitrate < 0) {
                publishData.audioBitrate = 0;
            }
            
            _this.lastPublishStats.audioBytesSent = result.bytesSent;
            _this.lastPublishStats.time = result.timestamp;
        }
        else if ((result.type == "outbound-rtp" || (result.type == "ssrc" && result.bytesSent != undefined)) && result.mediaType == "video") {
            //video
            if (time != 0) {
                publishData.videoBitrate = 8 * (result.bytesSent - _this.lastPublishStats.videoBytesSent) / (result.timestamp - time);
                publishData.videoFPS = 1000 * (result.framesEncoded - _this.lastPublishStats.framesEncoded) / (result.timestamp - time);
            }

            if (publishData.videoBitrate < 0) {
                publishData.videoBitrate = 0;
            }
            if (publishData.videoFPS < 0) {
                publishData.videoFPS = 0;
            }

            publishData.nackCount = result.nackCount;
            publishData.pliCount = result.pliCount;
            publishData.sliCount = result.sliCount;

            _this.lastPublishStats.videoBytesSent = result.bytesSent;
            _this.lastPublishStats.framesEncoded = result.framesEncoded;
            _this.lastPublishStats.time = result.timestamp;
        }
        //safari don't have this type
        else if (result.type == "track" && (result.kind == "video" || result.id.indexOf("video") >= 0)) {
            publishData.frameHeight = result.frameHeight;
            publishData.frameWidth = result.frameWidth;

            if (time != 0) {
                publishData.videoTransferFPS = 1000 * (result.framesSent - _this.lastPublishStats.framesSent) / (result.timestamp - time);
            }
        
            if (publishData.videoTransferFPS < 0) {
                publishData.videoTransferFPS = 0;
            }

            _this.lastPublishStats.framesSent = result.framesSent;
        }
        else if (result.type == "candidate-pair") {
            if (result.totalRoundTripTime != undefined) {
                publishData.totalRoundTripTime = result.totalRoundTripTime;
            }
            
            if (result.currentRoundTripTime != undefined) {
                publishData.currentRoundTripTime = result.currentRoundTripTime;
            }
        }
    });

    // _this.logger.debug("zp.gps.0 audio: " + publishData.audioBitrate + " video: " + publishData.videoBitrate +
    //  " FPS: " + publishData.videoFPS + " transfer: " + publishData.videoTransferFPS);

    // _this.dataReport.addEvent(_this.qualitySeq, "PublishQuality", publishData);
    // _this.qualityCount += 1;
    // if (_this.qualityCount > _this.maxQualityListCount) {
    //     _this.dataReport.uploadReport(_this.qualitySeq, "RTCPublishQuality");
    //     _this.qualityCount = 0;
    //     _this.qualitySeq = getSeq();
    //     _this.dataReport.newReport(_this.qualitySeq);
    // }

    //upload quality
    uploadPublishQuality(_this, publishData);
    
    if (time != 0) {
        _this.onPublishQualityUpdate(_this.streamId, publishData);
    }
}

function clearPublishQualityTimer(_this) {
    if (_this.qualityTimer != null) {
        clearInterval(_this.qualityTimer);
        _this.qualityTimer = null;
    }

    _this.lastPublishStats = {};
    _this.qualityCount = 0;
    
    //_this.dataReport.uploadReport(_this.qualitySeq, "RTCPublishQuality");
}

/*
 *    "zp.upq.0": "ZegoPublish.uploadPublishQuality"
 */
function uploadPublishQuality(_this, publishData) {
    if (!_this.qualityUpload) {
        return;
    }

    var timeStamp = Date.parse(new Date());
    if (_this.qualityUploadLastTime == 0 || timeStamp - _this.qualityUploadLastTime >= _this.qualityUploadInterval) {
        _this.logger.debug("zp.upq.0 upload");

        publishData["stream_type"] = "publish";
        publishData["stream_id"] = _this.streamId;
        publishData["timeStamp"] = timeStamp / 1000;

        _this.signal.QualityReport(getSeq(), _this.sessionId, publishData, function(seq, sessionId, data) {
            if (data.report !== undefined) {
                _this.qualityUpload = data.report;
                _this.qualityUploadInterval = data.report_interval_ms;
            }
        }, function(err, seq) {
            _this.logger.info("zp.upq.0 upload failed " + err);
        });

        _this.qualityUploadLastTime = timeStamp;
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////
// error function
function shouldSendCloseSession(_this, errorCode) {
    if (_this.state != ENUM_PUBLISH_STATE.stop && _this.state != ENUM_PUBLISH_STATE.waitingSessionRsp) {
        return true;
    }

    return false;
}

function publishStateUpdateError(_this, errorCode) {
    if (_this.sessionId != 0 && shouldSendCloseSession(_this, errorCode)) {
        //send close session request
        _this.signal.sendCloseSession(getSeq(), _this.sessionId, 1);
    }

    _this.state = ENUM_PUBLISH_STATE.stop;
    _this.onPublishStateUpdate(ENUM_PUBLISH_STATE_UPDATE.error, _this.streamId, errorCode);

    resetPublish(_this);
}

//////////////////////////////////////////////////////////////////////////////////////////////
// reset function
/*
 *    "zp.rp.0": "ZegoPublish.resetPublish"
 */
function resetPublish(_this) {
    _this.logger.info("zp.rp.0 call");

    _this.streamId = null;
    _this.state = ENUM_PUBLISH_STATE.stop;

    if (_this.peerConnection != undefined || _this.peerConnection != null) {
        _this.peerConnection.close();
        _this.peerConnection = null;
    }

    if (_this.waitingAnswerTimer != null) {
        clearTimeout(_this.waitingAnswerTimer);
        _this.waitingAnswerTimer = null;
    }

    if (_this.waitingICETimer != null) {
        clearTimeout(_this.waitingICETimer);
        _this.waitingICETimer = null;
    }

    clearPublishQualityTimer(_this);
    
    if (_this.signal) {
        _this.signal.unregisterPushCallback("CandidateInfoPush", _this.sessionId);
        _this.signal.unregisterPushCallback("MediaDescPush", _this.sessionId);
        _this.signal.unregisterPushCallback("CloseSessionPush", _this.sessionId);
        // _this.signal.unregisterPushCallback('WebSocketDisconnect', _this.sessionId);
    }

    // _this.sessionId = 0;
    _this.sessionSeq = 0;
    _this.offerSeq = 0;
    _this.candidateInfo = [];

    _this.publishQualityList = [];

    _this.qualityUploadLastTime =  0;

    _this.currentRetryCount = 0;
    _this.retryState = ENUM_RETRY_STATE.didNotStart;

    clearTryPublishTimer(_this);
}
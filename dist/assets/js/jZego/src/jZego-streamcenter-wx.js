/**
   ZegoStreamCenter
*/

import ZegoPlayer from './jZego-player-wx.js';
import ZegoDataReport from './jZego-datareport.js';

var ENUM_PLAY_STATE_UPDATE = {
    start: 0,
    stop: 1,
    retry: 2
};

var ENUM_PLAYER_TYPE = {
    play: 0,
    publish: 1
};

export default function ZegoStreamCenter(logger) {
    this.playerList = {};
    this.playerCount = 0;
    this.logger = logger;
    this.playingList = [];
    this.publishingList = [];

    this.dataReport = new ZegoDataReport(this.logger);
    this.eventSeq = 0;
    
    this.streamEventMap = {};
}

//更新拉流信息
//ZegoClient调用StartPlayingStream/StopPlayingStream时更新状态
ZegoStreamCenter.prototype.updatePlayingState = function (streamid, streamParams, start) {
    if (streamid == undefined) {
        return;
    }

    updateStreamState(streamid, start, streamParams, this.playingList);

    if (start) {
        //start a report
        this.eventSeq += 1;
        this.streamEventMap[streamid] = this.eventSeq;
        this.dataReport.newReport(this.eventSeq);
        
        //GetPublishInfo begin
        this.dataReport.eventStart(this.eventSeq, "GotPlayInfo");
    } else {
        //retport
        reportPlayEvent(this, streamid);
    }
};

//更新推流信息
//ZegoClient调用StartPublishingStream/StopPublishingStream时更新状态
ZegoStreamCenter.prototype.updatePublishingState = function (streamid, streamParams, start) {
    if (streamid == undefined) {
        return;
    }

    updateStreamState(streamid, start, streamParams, this.publishingList);

    if (start) {
        //start a report
        this.eventSeq += 1;
        this.streamEventMap[streamid] = this.eventSeq;
        this.dataReport.newReport(this.eventSeq);
        
        //GetPublishInfo begin
        this.dataReport.eventStart(this.eventSeq, "GotPublishInfo");
    } else {
        reportPublishEvent(this, streamid);
    }
};

function updateStreamState(streamid, start, streamParams, streamList) {
    if (streamid == undefined) {
        return;
    }
    
    if (streamParams == undefined ||
        typeof streamParams != "string") {
        streamParams = "";
    }

    if (start == true) {
        streamList.push({
            streamid: streamid,
            params: streamParams
        });
    } else {
        for (var i = 0; i < streamList.length; i++) {
            if (streamList[i].streamid == streamid) {
                streamList.splice(i, 1);
                break;
            }
        }
    }
}

//当前是否在拉流
ZegoStreamCenter.prototype.isPlaying = function () {
    if (this.playingList.length != 0) {
        return true;
    }

    return false;
};

//当前是否正在推流
ZegoStreamCenter.prototype.isPublishing = function () {
    if (this.publishingList.length != 0) {
        return true;
    }

    return false;
};

/*
 *    "zpc.sps.0": "ZegoStreamCenter.startPlayingStream",
 */
//拉流开始(从本地或server获取到推拉流URL)
ZegoStreamCenter.prototype.startPlayingStream = function (streamid, streamUrlList, dispatchType) {
    this.logger.debug("zpc.sps.0 call");

    //获取到URL信息
    var seq = this.streamEventMap[streamid];
    if (seq) {
        var type = "";
        if (dispatchType == 0) {
            type = "cdn";
        }
        else if (dispatchType == 1) {
            type = "ultra_src";
        }

        this.dataReport.eventEndWithMsg(seq, "GotPlayInfo", {
            type: type,
            urls: streamUrlList
        });
    }

    return startPlayer(this, streamid, streamUrlList, dispatchType, ENUM_PLAYER_TYPE.play);
};

/*
 *    "zpc.sp.0": "ZegoStreamCenter.startPlayer",
 */
function startPlayer(_this, streamid, streamUrlList, dispatchType, playerType) {
    var player = _this.playerList[streamid];
    if (player) {
        return true;
    }

    //检查是否需要开始推拉流
    var streamList = [];
    if (playerType == ENUM_PLAYER_TYPE.play) {
        streamList = _this.playingList;
    } else if (playerType == ENUM_PLAYER_TYPE.publish) {
        streamList = _this.publishingList;
    }

    var found = false;
    var params = "";
    for (var i = 0; i < streamList.length; i++) {
        if (streamList[i].streamid == streamid) {
            found = true;
            params = streamList[i].params;
            break;
        }
    }

    if (!found) {
        _this.logger.warn("zpc.sp.0 should not start");
        return false;
    }

    // 开始拉流，调用canvas，并存储起来 存进  this.playerList中
    player = _this.playerList[streamid] = new ZegoPlayer(_this.logger, streamid, streamUrlList, params,
        getReconnectLimit(_this.dispatchType), _this, dispatchType, playerType, _this.dataReport);

    player.playerSeq = _this.streamEventMap[streamid];

    // 拉流失败则返回不做操作
    if (!player) {
        _this.logger.info("zpc.sp.0 new player failed");
        return false;
    }

    // 拉流成功，播放器数量加1
    ++_this.playerCount;

    var result = player.tryStartPlayer(0);
    _this.logger.debug("zpc.sp.0 call result:", result);

    return result;
}

/*
 *    "zpc.sps.1.0": "ZegoStreamCenter.stopPlayingStream",
 */
//拉流结束
ZegoStreamCenter.prototype.stopPlayingStream = function (streamid) {
    this.logger.debug("zpc.sps.1.0 call");
    if (streamid == undefined) {
        return;
    }
    stopPlayer(this, streamid);
    this.updatePlayingState(streamid);
};

/*
 *    "zpc.sp.1.0": "ZegoStreamCenter.stopPlayer",
 */
function stopPlayer(_this, streamid) {
    var player = _this.playerList[streamid];
    if (player) {

        player.stopPlayer();
        
        delete _this.playerList[streamid];

        --_this.playerCount;
        //this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.stop, player.streamid);
    }

    _this.logger.debug("zpc.sp.1.0 call success");
}

/*
 *    "zpc.sps.1": "ZegoStreamCenter.startPublishingStream",
 */
//推流开始
ZegoStreamCenter.prototype.startPublishingStream = function (streamid, streamUrlList, dispatchType) {
    this.logger.debug("zpc.sps.1 call");
    var seq = this.streamEventMap[streamid];
    if (seq) {
        var type = "";
        if (dispatchType == 0) {
            type = "cdn";
        }
        else if (dispatchType == 1) {
            type = "ultra_src";
        }

        this.dataReport.eventEndWithMsg(seq, "GotPublishInfo", {
            type: type,
            urls: streamUrlList
        });
    }

    return startPlayer(this, streamid, streamUrlList, dispatchType, ENUM_PLAYER_TYPE.publish);
};

/*
 *    "zpc.sps.1.1": "ZegoStreamCenter.stopPublishingStream",
 */
//推流结束
ZegoStreamCenter.prototype.stopPublishingStream = function (streamid) {
    this.logger.debug("zpc.sps.1.1 call");

    if (streamid == undefined) {
        return;
    }
    stopPlayer(this, streamid);
    this.updatePublishingState(streamid, false);
};

/*
 *    "zpc.upe.1.0": "ZegoStreamCenter.updatePlayerEvent",
 */
//推拉流状态
ZegoStreamCenter.prototype.updatePlayerState = function (streamid, event) {
    var player = this.playerList[streamid];
    if (player) {
        player.updateEvent(event);
    }

    this.logger.debug("zpc.upe.1.0 updatePlayerEvent success");
};

/*
 *    "zpc.upns.1.0": "ZegoStreamCenter.updatePlayerNetStatus",
 */
//推拉流质量
ZegoStreamCenter.prototype.updatePlayerNetStatus = function (streamid, event) {
    var player = this.playerList[streamid];
    if (player) {
        player.updatePlayerNetStatus(event);
    }

    this.logger.debug("zpc.upns.1.0 updatePlayerNetStatus success");
};


/*
 *    "zpc.r.0": "ZegoStreamCenter.reset",
 */
ZegoStreamCenter.prototype.reset = function () {
    this.logger.debug('zpc.r.0 call');

    for (var i = 0; i < this.playingList.length; i++) {
        this.stopPlayingStream(this.playingList[i]);
    }
    
    for (var j = 0; j < this.publishingList.length; j++) {
        this.stopPublishingStream(this.publishingList[j]);
    }
    
    this.playerCount = 0;
    this.playerList = {};
    this.playerWaitingList = [];

    this.playerStatistics = {};
    this.streamEventMap = {};

    this.logger.debug('zpc.r.0 call success');
};

function reportPublishEvent(_this, streamid, error) {
    if (!_this.streamEventMap[streamid]) {
        return;
    }

    var seq = _this.streamEventMap[streamid];
    
    //report
    _this.dataReport.addMsgExt(seq, {
        "stream": streamid,
        "error": error
    });

    _this.dataReport.uploadReport(seq, "WXPublishStream");

    delete _this.streamEventMap[streamid];
}

function reportPlayEvent(_this, streamid, error) {
    if (!_this.streamEventMap[streamid]) {
        return;
    }

    var seq = _this.streamEventMap[streamid];
    _this.dataReport.addMsgExt(seq, {
        "stream": streamid,
        "error": error
    });
    
    _this.dataReport.uploadReport(seq, "WXPlayStream");

    delete _this.streamEventMap[streamid];
}

ZegoStreamCenter.prototype.onPlayStateUpdate = function (type, streamid, error) {};
ZegoStreamCenter.prototype.onPlayQualityUpdate = function (streamid, streamQuality) {};

ZegoStreamCenter.prototype.onPublishStateUpdate = function (type, streamid, error) {};
ZegoStreamCenter.prototype.onPublishQualityUpdate = function (streamid, streamQuality) {};

ZegoStreamCenter.prototype.onPlayerStreamUrlUpdate = function (streamid, url, type) {};

ZegoStreamCenter.prototype.onVideoSizeChange = function (streamid) {};

function getReconnectLimit(sourceType) {
    //switch(sourceType) in future
    return 1;
}

/*
 *    "ops.0": "ZegoStreamCenter.onPlayStart",
 */
ZegoStreamCenter.prototype.onPlayerStart = function (streamid, playerType) {
    this.logger.debug("ops.0 call");

    //callback
    if (playerType == ENUM_PLAYER_TYPE.play)
        this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.start, streamid, 0);
    else if (playerType == ENUM_PLAYER_TYPE.publish)
        this.onPublishStateUpdate(ENUM_PLAY_STATE_UPDATE.start, streamid, 0);
};

/*
 *    "ops.1": "ZegoStreamCenter.onPlayStop",
 */
ZegoStreamCenter.prototype.onPlayerStop = function (streamid, playerType, error) {
    this.logger.debug("ops.1 call");

    if (playerType == ENUM_PLAYER_TYPE.play) {
        // this.stopPlayingStream(streamid);

        //callback
        reportPlayEvent(this, streamid, error);
        this.logger.warn("ops.1 play error");
        this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.stop, streamid, error);
    } else if (playerType == ENUM_PLAYER_TYPE.publish) {
        // this.stopPublishingStream(streamid);

        reportPublishEvent(this, streamid, error);
        this.logger.warn("ops.1 publish error");
        this.onPublishStateUpdate(ENUM_PLAY_STATE_UPDATE.stop, streamid, error);
    }
};

/*
 *    "opr.0": "ZegoStreamCenter.onPlayStop",
 */

ZegoStreamCenter.prototype.onPlayerRetry = function (streamid, playerType) {
    this.logger.debug("opr.0 call");

    if (playerType == ENUM_PLAYER_TYPE.play)
        this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.retry, streamid, 0);
    else if (playerType == ENUM_PLAYER_TYPE.publish)
        this.onPublishStateUpdate(ENUM_PLAY_STATE_UPDATE.retry, streamid, 0);
};


ZegoStreamCenter.prototype.onPlayerQuality = function (streamid, streamQuality, playerType) {
    if (playerType == ENUM_PLAYER_TYPE.play)
        this.onPlayQualityUpdate(streamid, streamQuality);
    else if (playerType == ENUM_PLAYER_TYPE.play)
        this.onPublishQualityUpdate(streamid, streamQuality);
};

/*
 *    "opuu.0": "ZegoStreamCenter.onPlayUrlUpdated",
 */
ZegoStreamCenter.prototype.onStreamUrlUpdate = function (streamid, url, playerType) {
    this.logger.debug("opuu.0 call");

    //callback
    this.onPlayerStreamUrlUpdate(streamid, url, playerType);
};

ZegoStreamCenter.prototype.onPlayerVideoSizeChanged = function (streamid) {
    this.onVideoSizeChange(streamid);
};
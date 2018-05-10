/**
   ZegoPlayer
*/


var ENUM_PLAY_STATE = { start:0, playing:1, stop:2 };

export default function ZegoPlayer(logger, streamid, urls, params, reconnectLimit, streamcenter, sourceType, playerType, dataReport) {
    this.streamid = streamid;

    //url list
    this.urls = urls;

    this.playUrlIndex = 0;
    this.playUrlTryCount = 0;
    this.currentUrl = null;

    this.reconnectLimit = reconnectLimit;
    this.reconnectCount = 0;
    this.state = ENUM_PLAY_STATE.stop;
    
    this.logger = logger;
    this.streamCenter = streamcenter;

    //this.stateTimeStamp = 0;
    this.sourceType = sourceType;
    this.playerType = playerType;  

    this.params = params;

    this.playerSeq = 0;

    this.publishQualitySeq = 0;
    this.publishQualityCount = 0;
    this.publishQulaityMaxCount = 10;

    this.everSuccess = false;

    this.dataReport = dataReport;
}

/*
*    "zp.rp.0": "ZegoPlayer.resetPlayer",
*/
function resetPlayer(_this) {
    _this.state = ENUM_PLAY_STATE.stop;
    //this.stateTimeStamp = Date.now();
}

function newPlayer(_this) {
    resetPlayer(_this);

    var url = _this.getCurrentPlayerUrl();
    var urlWithParams = url;
    if (_this.params.length != 0) {
        urlWithParams = url + '?' + _this.params;
    }

    if (url !== _this.currentUrl) {
        _this.currentUrl = url;
        _this.streamCenter.onStreamUrlUpdate(_this.streamid, urlWithParams, _this.playerType);   
    }
    else {
        _this.streamCenter.onPlayerRetry(_this.streamid, _this.playerType);
    }

    if (_this.everSuccess == false) {
        if (_this.playerType == 0) {
            _this.dataReport.eventStart(_this.playerSeq, "PlayBegin");
            _this.dataReport.addEventInfo(_this.playerSeq, "PlayBegin", "url", urlWithParams);
        }
        else {
            _this.dataReport.eventStart(_this.playerSeq, "PublishBegin");
            _this.dataReport.addEventInfo(_this.playerSeq, "PublishBegin", "url", urlWithParams);
        } 
    }
    else {
        if (_this.playerType == 0) {
            _this.dataReport.addEventInfo(_this.playerSeq, "PlayRetry", "url", urlWithParams);
        }
        else {
            _this.dataReport.eventStart(_this.playerSeq, "PublishRetry", "url", urlWithParams);
        } 
    }
    _this.state = ENUM_PLAY_STATE.start;
    
    return true;
}

ZegoPlayer.prototype.stopPlayer = function() {
    if (this.playerType == 0) {
        this.dataReport.eventEndWithMsg(this.playerSeq, "PlayStat", {
            "quality": this.playerInfo
        });
    }
    else {
        this.dataReport.addEventInfo(this.playerSeq, "PublishStat", "quality", this.playerInfo);
        this.dataReport.eventEndWithMsg(this.playerSeq, "PublishStat", {
            "quality": this.playerInfo
        });
    }
};

/*
*    "zp.tsp.0": "ZegoPlayer.tryStartPlayer",
*/
ZegoPlayer.prototype.tryStartPlayer = function(errorCode) {
    //当前播放器的备用播放地址可能有多条，可尝试多次
    while (this.playUrlTryCount < this.urls.length) {
        if (++this.reconnectCount > this.reconnectLimit) {
            this.playUrlTryCount++;
            this.playUrlIndex = (this.playUrlIndex + 1) % this.urls.length;
            this.reconnectCount = 0;
            continue;
        }

        this.logger.info("zp.tsp.0 index: " + this.playUrlIndex + ", url: " + this.getCurrentPlayerUrl());
        if (newPlayer(this)) {
            break;
        }
    }

    if (this.playUrlTryCount >= this.urls.length) {
        this.logger.info("zp.tsp.0 stream: " + this.streamid);
        resetPlayer(this);

        var event_name = "";
        if (this.playerType == 0) {
            event_name = "PlayEnd";
        }
        else if (this.playerType == 1) {
            event_name = "PublishEnd";

            reportQualityStatics(this);
        }
        var info = {
            "error": errorCode,
            "reason": "no url to retry"
        };

        this.dataReport.addEvent(this.playerSeq, event_name, info);

        this.streamCenter.onPlayerStop(this.streamid, this.playerType, errorCode);
    }
};

function shouldRetryPlay(_this, event) {
    var code = event.detail.code;
    if (code == 3001 ||
        code == 3002 ||
        code == 3003 ||
        code == 3005) {
        return true;
    }

    return false;
}

function isPlayFailed(_this, event) {
    var code = event.detail.code;
    if (code == -2301 ||
        code == 2101 ||
        code == 2102 ) {
        return true;
    }

    return false;
}

function shouldRetryPublish(_this, event) {
    var code = event.detail.code;
    if (code == 3001 ||
        code == 3002 ||
        code == 3003 ||
        code == 3004 ||
        code == 3005) {
        return true;
    }

    return false;
}

function isPublishFailed(_this, event) {
    var code = event.detail.code;
    if (code == -1301 ||
        code == -1302 ||
        code == -1303 ||
        code == -1304 ||
        code == -1305 ||
        code == -1306 ||
        code == -1307 ||
        code == -1308 ||
        code == -1309 ||
        code == -1310 ||
        code == -1311 ) {
        return true;
    }
    return false;
}
/*
*    "zp.tsp.0": "ZegoPlayer.updateEvent",
*/
ZegoPlayer.prototype.updateEvent = function(event) {
    if (this.playerType == 0) {
        //拉流
        if (event.detail.code == 2004) {
            if (this.everSuccess) {
                this.dataReport.eventEnd(this.playerSeq, "PlayRetry");
            }
            else {
                this.everSuccess = true;
                
                this.dataReport.eventStart(this.playerSeq, "PlayStat");
            }
            
            this.streamCenter.onPlayerStart(this.streamid, this.playerType);
        }
        else if (event.detail.code == 2009) {
            //video size changed
            this.streamCenter.onPlayerVideoSizeChanged(this.streamid);
        }
        else if (shouldRetryPlay(this, event)) {
            //try to restart palyer
            this.dataReport.eventStart(this.playerSeq, "PlayRetry");
            this.dataReport.addEventInfo(this.playerSeq, "PlayRetry", "error_code", event.detail.code);
            
            // this.tryStartPlayer(event.detail.code);
        }
        else if (isPlayFailed(this, event)) {
            this.logger.info("zp.ue.0 play error: " + this.streamid);
            resetPlayer(this);

            var palyFailedInfo = {
                "errorCode": event.detail.code
            };
            this.dataReport.addEvent(this.playerSeq, "PlayError", palyFailedInfo);

            this.streamCenter.onPlayerStop(this.streamid, this.playerType, event.detail.code);
        }

        if (!this.everSuccess) {
            this.dataReport.eventEnd(this.playerSeq, "PlayBegin");
        }
    }
    else if (this.playerType == 1) {
        //推流
        if (event.detail.code == 1002) {
            if (this.everSuccess) {
                this.dataReport.eventEnd(this.playerSeq, "PublishRetry");
            }
            else {
                this.everSuccess = true;
                this.dataReport.eventStart(this.playerSeq, "PublishStat");
            }
            
            this.streamCenter.onPlayerStart(this.streamid, this.playerType);
        }
        else if (shouldRetryPublish(this, event)) {
            //try to restart palyer
            this.dataReport.eventStart(this.playerSeq, "PublishRetry");
            this.dataReport.addEventInfo(this.playerSeq, "PublishRetry", "error_code", event.detail.code);

            //小程序内部retry
            // this.tryStartPlayer(event.detail.code);
        }
        else if (isPublishFailed(this, event)) {
            this.logger.info("zp.ue.0 publish error: " + this.streamid);
            resetPlayer(this);

            var publishFailedInfo = {
                "errorCode": event.detail.code
            };
            this.dataReport.addEvent(this.playerSeq, "PublishError", publishFailedInfo);

            reportQualityStatics(this);
            this.streamCenter.onPlayerStop(this.streamid, this.playerType, event.detail.code);
        }
        
        if (!this.everSuccess) {
            this.dataReport.eventEnd(this.playerSeq, "PublishBegin");
        }
    }
    
};

ZegoPlayer.prototype.updatePlayerNetStatus = function(event) {
    var streamQuality = {
        "videoBitrate": event.detail.info.videoBitrate,
        "audioBitrate": event.detail.info.audioBitrate,
        "videoFPS": event.detail.info.videoFPS,
        "videoHeight": event.detail.info.videoHeight,
        "videoWidth": event.detail.info.videoWidth
    };

    this.playerInfo = streamQuality;

    if (this.playerType == 1) {
        var qualityInfo = {
            "videoBitrate": event.detail.info.videoBitrate,
            "audioBitrate": event.detail.info.audioBitrate,
            "videoFPS": event.detail.info.videoFPS,
            "videoGOP": event.detail.info.videoGOP,
            "netSpeed": event.detail.info.netSpeed,
            "netJitter": event.detail.info.netJitter,
            "videoWidth": event.detail.info.videoWidth,
            "videoHeight": event.detail.info.videoHeight
        };

        if (this.publishQualitySeq == 0) {
            this.publishQualitySeq = ++this.streamCenter.eventSeq;
            this.dataReport.newReport(this.publishQualitySeq);
        }

        this.dataReport.addEvent(this.publishQualitySeq, "PublishQuality", qualityInfo);
        this.publishQualityCount += 1;

        if (this.publishQualityCount >= this.publishQulaityMaxCount) {
            reportQualityStatics(this);
        }
    }
    this.streamCenter.onPlayerQuality(this.streamid, streamQuality, this.playerType);
};

ZegoPlayer.prototype.getCurrentPlayerUrl = function() {
    return this.urls[this.playUrlIndex % this.urls.length];
};

function reportQualityStatics(_this) {
    //report
    _this.dataReport.uploadReport(_this.publishQualitySeq, "WXPublishStateUpdate");
    _this.publishQualityCount = 0;
    _this.publishQualitySeq = 0;
}

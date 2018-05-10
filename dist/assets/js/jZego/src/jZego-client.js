/*
 * desc  wawaji sdk
 * date  20171114
 */

import LinkedList from './LinkedList.js';
import ZegoLogger from './jZego-logger-wx.js';
// import ZegoPlayerCenter from './jZego-playercenter-wx.js';
// import ZegoWebSocket from './jZego-WebSocket-wx.js';

import {
    playErrorList,
    ENUM_PLAY_STATE_UPDATE,
    publishErrorList,
    ENUM_PUBLISH_STATE_UPDATE
} from "./jZego-extern-rtc.js";

//拉流选择
var ENUM_PLAY_SOURCE_TYPE = {
    auto: 0,
    ultra: 1
};

//推流选择
var ENUM_DISPATCH_TYPE = {
    cdn: 0,
    ultra: 1
};

//运行状态
var ENUM_RUN_STATE = {
    logout: 0,
    trylogin: 1,
    login: 2
};

var ENUM_PUBLISH_STREAM_STATE = {
    waiting_url: 1,
    tryPublish: 2,
    update_info: 3,
    publishing: 4,
    stop: 5
};

var ENUM_STREAM_SUB_CMD = {
    liveNone: 0,
    liveBegin: 2001,
    liveEnd: 2002,
    liveUpdate: 2003
};

// var ENUM_ROLE_TYPE = {none:0, anchor:1, Audience:2 };                            //用户角色，1主播，2观众
var ENUM_STREAM_UPDATE_TYPE = {
    added: 0,
    deleted: 1
};

var ENUM_STREAM_UPDATE_CMD = {
    added: 12001,
    deleted: 12002,
    updated: 12003
};

var MAX_TRY_LOGIN_COUNT = 5; //最大重试登录次数
var TRY_LOGIN_INTERVAL = [2000, 2000, 3000, 3000, 4000]; //重试登录的频率
var MAX_TRY_HEARTBEAT_COUNT = 3; //最大心跳尝试次数
var MINIUM_HEARTBEAT_INTERVAL = 3000; //最小心跳尝试间隔
var PROTO_VERSION = "1.0.3"; //协议版本号

var SERVER_ERROR_CODE = 10000;

var ENUM_SIGNAL_SUB_CMD = {
    none: 0,
    joinLiveRequest: 1001,
    joinLiveResult: 1002,
    joinLiveInvite: 1003,
    joinLiveStop: 1004
};

var ENUM_PUSH_SIGNAL_SUB_CMD = {
    none: 0,
    pushJoinLiveRequest: 11001,
    pushJoinLiveResult: 11002,
    pushJoinLiveInvite: 11003,
    pushJoinLiveStop: 11004
};

/**
    sdk接口
*/
export default function ZegoClient() {
    //init once
    this.appid = 0;
    this.server = '';
    this.idName = '';
    this.nickName = '';
    this.configOK = false;
    this.logger = new ZegoLogger();

    //room config, can change anytime
    this.userStateUpdate = false;
    this.userSeq = 0;
    this.userQuerying = false;
    this.userTempList = [];

    this.roomCreateFlag = 1;

    //user call init
    this.roomid = '';
    this.token = '';
    this.role = 0;
    this.callbackList = {};

    //state 
    this.runState = ENUM_RUN_STATE.logout;
    this.lastRunState = ENUM_RUN_STATE.logout;

    //change when running
    this.userid = '';
    this.sessionid = '';
    this.cmdSeq = 0;
    this.websocket = null;
    this.globalHeader = null;

    //trylogin
    this.tryLoginCount = 0;
    this.tryLoginTimer = null;

    //tryheartbeat
    this.tryHeartbeatCount = 0;
    this.tryHeartbeatTimer = null;
    this.heartbeatInterval = 30000;

    //stream
    this.ultraPlaySourceType = "rtmp_v2";
    this.streamList = [];
    this.streamQuerying = false;

    // sourceType
    this.preferPlaySourceType = ENUM_PLAY_SOURCE_TYPE.auto;
    this.preferPublishSourceType = ENUM_DISPATCH_TYPE.ultra;
    this.currentPlaySourceType = ENUM_DISPATCH_TYPE.cdn;

    //playerCenter
    if (BUILD_VIDEO) {
        this.streamCenter = new ZegoStreamCenter(this.logger);
        this.streamCenter.onPlayStateUpdate = this.onPlayStateUpdateHandle.bind(this);
        this.streamCenter.onPlayQualityUpdate = this.onPlayQualityUpdateHandle.bind(this);

        this.streamCenter.onPublishStateUpdate = this.onPublishStateUpdateHandle.bind(this);
        this.streamCenter.onPublishQualityUpdate = this.onPublishQualityUpdateHandle.bind(this);

        if (this.streamCenter.onPlayerStreamUrlUpdate) {
            this.streamCenter.onPlayerStreamUrlUpdate = this.onStreamUrlUpdateHandle.bind(this);
        }

        if (this.streamCenter.onVideoSizeChanged) {
            this.streamCenter.onVideoSizeChanged = this.onVideoSizeChangedHandle.bind(this);
        }
    }   
    

    // if (this.streamCenter.onSignalDisconnected) {
    //     this.streamCenter.onSignalDisconnected = this.onSignalDisconnectedHandle.bind(this);
    // }

    //custommsg check timeout
    this.sendDataMap = {}; //custom消息发送map
    this.sendDataList = new LinkedList(); //custom消息发送数组，方便顺序遍历
    this.sendDataCheckTimer = null; //custom超时检查timer
    this.sendDataCheckInterval = 2000; //检查发送消息间隔
    this.sendDataTimeout = 5 * 1000; //发送消息超时
    this.sendDataDropTimeout = 10 * 1000; //丢弃过期消息的超时时间
    this.sendDataCheckOnceCount = 100; //每次处理最大的超时包

    this.sendRoomMsgTime = 0; //上一次发送房间消息时间
    this.SendRoomMsgInterval = 500; //发送房间消息最多500毫秒发送一次

    //joinLiveCallbackMap
    this.joinLiveCallbackMap = {}; //requestId : callback
    //joinLiveRequestMap
    this.joinLiveRequestMap = {}; //requestId : user_id

    //publish
    this.publishStreamList = {};

    //command check timout
    this.sendCommandMap = {};
    this.sendCommandList = new LinkedList();

    //streamurl result check
    this.streamUrlMap = {};

    //小程序答题
    this.serverTimeOffset = 0;
    this.bigimTimeWindow = 0;
    this.datiTimeWindow = 0;

    //trans
    this.transSeqMap = {}; //type: seq
    //bigim
    this.bigImLastTimeIndex = 0;
    this.bigImMessageList = [];
    this.bigImTimer = null;
    this.bigImCallbackMap = {};

    //relay
    this.realyMessageList = [];
    this.relayTimer = null;

    //command callback
    this.cmdCallback = {};
}

///////////////////////////////////////////////////////////////////////////////////
//callback

if (BUILD_VIDEO) {
// 抛出流播放状态， 开始播放，停止播放
// type: { start:0, stop:1};
    ZegoClient.prototype.onPlayStateUpdateHandle = function (type, streamid, error) {
        if (type == 1) {
            this.stopPlayingStream(streamid);
        }

        this.onPlayStateUpdate(type, streamid, error);
    };

    ZegoClient.prototype.onPlayQualityUpdateHandle = function (streamid, streamQuality) {
        this.onPlayQualityUpdate(streamid, streamQuality);
    };

    //type: { start: 0, stop: 1}
    ZegoClient.prototype.onPublishStateUpdateHandle = function (type, streamid, error) {
        if (type == 0) {
        //start publish
            if (this.publishStreamList[streamid]) {
                if (this.publishStreamList[streamid].state == ENUM_PUBLISH_STREAM_STATE.tryPublish) {
                    this.publishStreamList[streamid].state = ENUM_PUBLISH_STREAM_STATE.update_info;

                    var _this = this;
                    updateStreamInfo(this, streamid, ENUM_STREAM_SUB_CMD.liveBegin, this.publishStreamList[streamid].extra_info, function (err) {
                        if (_this.publishStreamList[streamid] && _this.publishStreamList[streamid].state == ENUM_PUBLISH_STREAM_STATE.update_info) {
                            _this.publishStreamList[streamid].state = ENUM_PUBLISH_STREAM_STATE.stop;
                            _this.onPublishStateUpdate(1, streamid, err);
                            _this.streamCenter.stopPlayingStream(streamid);
                        }
                    });
                }
                else {
                    if (BUILD_WEBRTC) {
                        if (this.publishStreamList[streamid].state == ENUM_PUBLISH_STREAM_STATE.publishing) {
                            this.onPublishStateUpdate(type, streamid, error);
                        }
                    }
                }
            //当前状态为publishing时，如果小程序继续回调相同的开始推流状态码，不应该再返回推流成功的回调
            // else if (this.publishStreamList[streamid].state == ENUM_PUBLISH_STREAM_STATE.publishing) {
            //     this.onPublishStateUpdate(type, streamid, error);
            // }
            }
        } else {
            this.onPublishStateUpdate(type, streamid, error);

            if (type == 1) {
                this.stopPublishingStream(streamid);
            }
        }

    };

    ZegoClient.prototype.onPublishQualityUpdateHandle = function (streamid, streamQuality) {
        this.onPublishQualityUpdate(streamid, streamQuality);
    };

    ZegoClient.prototype.onVideoSizeChangedHandle = function (streamid, videoWidth, videoHeight) {
        this.onVideoSizeChanged(streamid, videoWidth, videoHeight);
    };

    //type: {play: 0, publish: 1};
    ZegoClient.prototype.onStreamUrlUpdateHandle = function (streamid, url, type) {
        this.onStreamUrlUpdate(streamid, url, type);
    };
}


/*
*    "zc.p.osd.0": "ZegoClient.onSignalDisconnectedHandle",
*/
/*
ZegoClient.prototype.onSignalDisconnectedHandle = function (server) {

    this.logger.info("zc.p.osd.0 disconnected " + server);

    setRunState(this, ENUM_RUN_STATE.logout);
    resetRoom(this);

    this.onDisconnect(sdkErrorList.SIGNAL_DISCONNECT);
};
*/

///////////////////////////////////////////////////////////////////////////////////
//webrtc 推拉流
if (BUILD_WEBRTC) {

    ZegoClient.prototype.enumDevices = function(deviceInfoCallback, errorCallback) {
        this.streamCenter.enumDevices(deviceInfoCallback, errorCallback);
    };
    
    /*
    *    "zc.p.sps.0": "ZegoClient.startPlayingStream",
    */
    // 播放流
    ZegoClient.prototype.startPlayingStream = function (streamid, remoteVideo, audioOutput) {
        this.logger.debug("zc.p.sps.0 call");

        if (!streamid || streamid === "") {
            this.logger.info("zc.p.sps.0 param error");
            return false;
        }

        if (!remoteVideo) {
            this.logger.info("zc.p.sps.0 don't have remoteVideo");
            return false;
        }
    
        if (this.customUrl && this.customUrl.length != 0) {
            if (!this.streamCenter.setPlayStateStart(streamid, remoteVideo, audioOutput)) {
                this.logger.info("zc.p.sps.0 cannot start play");
                return false;
            }
            
            return this.streamCenter.startPlayingStream(streamid, [this.customUrl]);
        }


        if (this.runState != ENUM_RUN_STATE.login) {
            this.logger.info("zc.p.sps.0 not login");
            return false;
        }

        var found = false;
        for (var i = 0; i < this.streamList.length; i++) {
            if (this.streamList[i].stream_id === streamid) {
                // 根据传入的流id判断当前的流列表中是否存在该流
                found = true;
                break;
            }
        }

        if (found == false) {
            this.logger.info("zc.p.sps.0 cannot find stream");
            return false;
        }
   
        if (!this.streamCenter.setPlayStateStart(streamid, remoteVideo, audioOutput)) {
            this.logger.info("zc.p.sps.0 cannot start play");
            return false;
        }

        //send request
        var body = {
            stream_id: streamid,
            ptype: "pull"
        };
        
        var _this = this;
        sendMessage(this, "webrtc_url", body, undefined, function(err, seq) {
            if (err == sdkErrorList.SEND_MSG_TIMEOUT) {
                _this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.error, streamid, playErrorList.DISPATCH_TIMEOUT);
            }
            else {
                _this.onPlayStateUpdate(ENUM_PLAY_STATE_UPDATE.error, streamid, playErrorList.DISPATCH_ERROR);
            }
             
            _this.streamCenter.stopPlayingStream(streamid);
        });
        
        return true;
    };

    /*
    *    "zc.p.sps.0.1": "ZegoClient.stopPlayingStream",
    */
    // 停止流
    ZegoClient.prototype.stopPlayingStream = function (streamid) {
        this.logger.debug("zc.p.sps.1.0 call");
        if (!streamid || streamid === "") {
            this.logger.info("zc.p.sps.1.0 param error");
            return false;
        }

        this.logger.debug("zc.p.sps.1.0 call success");

        return this.streamCenter.stopPlayingStream(streamid);
    };

    /*
    *    "zc.p.psao.1": "ZegoClient.setPlayAudioOutput",
    */
    ZegoClient.prototype.setPlayAudioOutput = function (streamid, audioOutput) {
        this.logger.debug("zc.p.psao.1 call");

        return this.streamCenter.setPlayStreamAudioOutput(streamid, audioOutput);
    };

    /*
    *    "zc.p.psao.0": "ZegoClient.setLocalAudioOutput",
    */
    ZegoClient.prototype.setLocalAudioOutput = function (localVideo, audioOutput) {
        this.logger.debug("zc.p.psao.1 call");

        return this.streamCenter.setPublishStreamAudioOutput(localVideo, audioOutput);
    };

    /*
    *    "zc.p.sp.0": "ZegoClient.startPreview",
    */
    //开始预览
    ZegoClient.prototype.startPreview = function (localVideo, mediaStreamConstraints, success, error) {
        this.logger.debug("zc.p.sp.0 call");
        
        if (!localVideo) {
            this.logger.info("zc.p.sp.0 no localVideo");
            return false;
        }

        return this.streamCenter.startPreview(localVideo, mediaStreamConstraints, success, error);
    };

    /*
    *    "zc.p.sp.1": "ZegoClient.stopPreview",
    */
    //结束预览
    ZegoClient.prototype.stopPreview = function (localVideo) {
        this.logger.debug("zc.p.sp.1 call");
        if (!localVideo) {
            this.logger.info("zc.p.sp.1 param error");
            return false;
        }

        return this.streamCenter.stopPreview(localVideo);
    };

    /*
    *    "zc.p.em.0": "ZegoClient.enableMicrophone",
    */
    //是否麦克风
    ZegoClient.prototype.enableMicrophone = function (streamid, enable) {
        this.logger.debug("zc.p.em.0 call");

        if (typeof enable !== "boolean") {
            this.logger.info("zc.p.em.0 argument is not bool");
            return false;
        }

        return this.streamCenter.enableMicrophone(streamid, enable);
    };

    /*
    *    "zc.p.ec.0": "ZegoClient.enableCamera",
    */
    //是否启用摄像头
    ZegoClient.prototype.enableCamera = function (streamid, enable) {
        this.logger.debug("zc.p.ec.0 call");

        if (typeof enable !== "boolean") {
            this.logger.info("zc.p.ec.0 argument is not bool");
            return false;
        }

        return this.streamCenter.enableCamera(streamid, enable);
    };

    /*
    *    "zc.p.sps.1": "ZegoClient.startPublishingStream",
    */
    //开始推流
    ZegoClient.prototype.startPublishingStream = function (streamid, localVideo, extraInfo) {
        this.logger.debug("zc.p.sps.1 call");
        if (!streamid || streamid === "") {
            this.logger.info("zc.p.sps.1 param error");
            return false;
        }

        if (this.customUrl && this.customUrl.length != 0) {
            this.publishStreamList[streamid] = {
                state: ENUM_PUBLISH_STREAM_STATE.tryPublish,
                extra_info: extraInfo
            };

            if (!this.streamCenter.setPublishStateStart(streamid, localVideo)) {
                this.logger.info("zc.p.sps.1 cannot start publish");
                return false;
            }
            
            return this.streamCenter.startPublishingStream(streamid, [this.customUrl]);
        }

        if (this.runState != ENUM_RUN_STATE.login) {
            this.logger.info("zc.p.sps.1 not login");
            return false;
        }

        this.publishStreamList[streamid] = {
            state: ENUM_PUBLISH_STREAM_STATE.tryPublish,
            extra_info: extraInfo
        };

        if (!this.streamCenter.setPublishStateStart(streamid, localVideo)) {
            this.logger.info("zc.p.sps.1 cannot start publish");
            return false;
        }
        
        this.logger.info("zc.p.sps.1 start publish");

        var body = {
            stream_id: streamid,
            ptype: "push"
        };
        
        var _this = this;
        sendMessage(this, "webrtc_url", body, undefined, function(err, seq) {
            if (err == sdkErrorList.SEND_MSG_TIMEOUT) {
                _this.onPublishStateUpdate(ENUM_PUBLISH_STATE_UPDATE.error, streamid, publishErrorList.DISPATCH_TIMEOUT);
            }
            else {
                _this.onPublishStateUpdate(ENUM_PUBLISH_STATE_UPDATE.error, streamid, publishErrorList.DISPATCH_ERROR);
            }
             
            _this.streamCenter.stopPublishingStream(streamid);
        });
        
        return true;
    };

    /*
    *    "zc.p.sps.1.1": "ZegoClient.stopPublishingStream",
    */
    //结束推流
    ZegoClient.prototype.stopPublishingStream = function (streamid) {
        this.logger.debug("zc.p.sps.1.1 call");
        if (!streamid || streamid === "") {
            this.logger.info("zc.p.sps.1.1 param error");
            return false;
        }

        this.streamCenter.stopPublishingStream(streamid);

        if (this.publishStreamList[streamid]) {
            if (this.publishStreamList[streamid].state >= ENUM_PUBLISH_STREAM_STATE.update_info) {
                updateStreamInfo(this, streamid, ENUM_STREAM_SUB_CMD.liveEnd);
            }
            delete this.publishStreamList[streamid];
        }

        return true;
    };

    /*
    *    "zc.p.scs.0": "ZegoClient.setCustomSignal",
    */
    //设置自定义信令地址
    ZegoClient.prototype.setCustomSignalUrl = function (signalUrl) {
        this.logger.debug("zc.p.scs.0 call: " + signalUrl);

        if (!signalUrl || signalUrl.length == 0) {
            this.logger.info("zc.p.scs.0 param error");
            return false;
        }

        if (signalUrl.indexOf("wss://") != 0) {
            this.logger.info("zc.p.scs.0 url is not correct");
            return false;
        }

        this.customUrl = signalUrl;
    };

    //设置质量回调时间间隔
    ZegoClient.prototype.setQualityMonitorCycle = function (timeInMs) {
        if (typeof timeInMs === "number" && timeInMs >= 1000) {
            this.streamCenter.setQualityMonitorCycle(timeInMs);
        }
    };
}

///////////////////////////////////////////////////////////////////////////////////
//小程序 推拉流
if (BUILD_WX) {

    /*
    *    "zc.p.sppst.0": "ZegoClient.setPreferPlaySourceType",
    */
    // 设置优先播放流类型
    ZegoClient.prototype.setPreferPlaySourceType = function (sourceType) {
        this.logger.debug("zc.p.sppst.0 call");
        if (typeof sourceType !== "number" ||
        (sourceType !== ENUM_PLAY_SOURCE_TYPE.auto &&
            sourceType !== ENUM_PLAY_SOURCE_TYPE.ultra)) {
            this.logger.info("zc.p.sppst.0 param error");
            return false;
        }

        this.preferPlaySourceType = sourceType;
        this.logger.debug("zc.p.sppst.0 call success");
        return true;
    };

    /*
    *    "zc.p.sppst.1": "ZegoClient.setPreferPublishSourceType",
    */
    ZegoClient.prototype.setPreferPublishSourceType = function (sourceType) {
        this.logger.debug("zc.p.sppst.1 call");
        if (typeof sourceType !== "number" ||
        (sourceType !== ENUM_DISPATCH_TYPE.cdn &&
            sourceType !== ENUM_DISPATCH_TYPE.ultra)) {
            this.logger.info("zc.p.sppst.1 param error");
            return false;
        }

        this.preferPublishSourceType = sourceType;
        this.logger.debug("zc.p.sppst.1 call success");
        return true;
    };

    /*
    *    "zc.p.sps.0": "ZegoClient.startPlayingStream",
    */
    // 播放流
    ZegoClient.prototype.startPlayingStream = function (streamid, stream_params) {
        this.logger.debug("zc.p.sps.0 call");
        if (!streamid || streamid === "") {
            this.logger.info("zc.p.sps.0 param error");
            return false;
        }

        if (this.runState != ENUM_RUN_STATE.login) {
            this.logger.info("zc.p.sps.0 not login");
            return false;
        }

        this.streamCenter.updatePlayingState(streamid, stream_params, true);

        if (this.streamCenter.isPublishing()) {
        //当前正在推流，根据推流模式确定拉流模式
            if (this.preferPublishSourceType == ENUM_DISPATCH_TYPE.cdn) {
                return startPlayingStreamFromCDN(this, streamid);
            } else {
            //current publish to BGP
                return startPlayingStreamFromBGP(this, streamid);
            }
        } else {
        //当前没有在推流，根据用户设置的拉流方式确定拉流地址
            if (this.preferPlaySourceType == ENUM_PLAY_SOURCE_TYPE.ultra) {
                return startPlayingStreamFromBGP(this, streamid);
            } else {
                return startPlayingStreamFromCDN(this, streamid);
            }
        }
    };

    /*
    *    "zc.p.sps.1.0": "ZegoClient.stopPlayingStream",
    */
    // 停止流
    ZegoClient.prototype.stopPlayingStream = function (streamid) {
        this.logger.debug("zc.p.sps.1.0 call");
        if (!streamid || streamid === "") {
            this.logger.info("zc.p.sps.1.0 param error");
            return false;
        }

        this.streamCenter.stopPlayingStream(streamid);

        if (this.streamUrlMap[streamid]) {
            delete this.streamUrlMap[streamid];
        }

        this.logger.debug("zc.p.sps.1.0 call success");
        return true;
    };

    /*
    *    "zc.p.sps.1": "ZegoClient.startPublishingStream",
    */
    //开始推流
    ZegoClient.prototype.startPublishingStream = function (streamid, stream_params, extraInfo) {
        this.logger.debug("zc.p.sps.1 call");
        if (!streamid || streamid === "") {
            this.logger.info("zc.p.sps.1 param error");
            return false;
        }

        if (this.runState != ENUM_RUN_STATE.login) {
            this.logger.info("zc.p.sps.1 not login");
            return false;
        }

        this.publishStreamList[streamid] = {
            state: ENUM_PUBLISH_STREAM_STATE.waiting_url,
            extra_info: extraInfo
        };

        this.logger.info("zc.p.sps.0 fetch stream url");

        this.streamCenter.updatePublishingState(streamid, stream_params, true);
        fetchPublishStreamUrl(this, streamid);

        //need to check whether play to switch line
        if (this.streamCenter.isPlaying()) {
        //如果是BGP推流，选择auto拉流模式，需要切换服务器
            if (this.preferPublishSourceType == ENUM_PLAY_SOURCE_TYPE.ultra &&
            this.currentPlaySourceType == ENUM_DISPATCH_TYPE.cdn) {
            //switch CDN to bgp
                for (var i = 0; i < this.streamCenter.playingList.length; i++) {
                    var playStreamId = this.streamCenter.playingList[i].streamid;
                    var params = this.streamCenter.playingList[i].params;
                    this.stopPlayingStream(playStreamId);
                    this.streamCenter.updatePlayingState(playStreamId, params, true);
                    startPlayingStreamFromBGP(this, playStreamId);
                }
            }
        }

        return true;
    };

    /*
    *    "zc.p.sps.1.1": "ZegoClient.stopPublishingStream",
    */
    //结束推流
    ZegoClient.prototype.stopPublishingStream = function (streamid) {
        this.logger.debug("zc.p.sps.1.1 call");
        if (!streamid || streamid === "") {
            this.logger.info("zc.p.sps.1.1 param error");
            return false;
        }

        this.streamCenter.stopPublishingStream(streamid);

        if (this.publishStreamList[streamid]) {
            if (this.publishStreamList[streamid].state >= ENUM_PUBLISH_STREAM_STATE.update_info) {
                updateStreamInfo(this, streamid, ENUM_STREAM_SUB_CMD.liveEnd);
            }
            delete this.publishStreamList[streamid];
        }

        if (this.streamUrlMap[streamid]) {
            delete this.streamUrlMap[streamid];
        }

        this.logger.debug("zc.p.sps.1.1 call success");
        return true;

    };

    /*
    *    "zc.p.upe.0": "ZegoClient.updatePlayerEvent",
    */
    // 更新播放器事件
    ZegoClient.prototype.updatePlayerState = function (streamid, event) {
    //通知playercenter
        this.logger.debug("zc.p.upe.0 call");

        this.streamCenter.updatePlayerState(streamid, event);
    };

    /*
    *    "zc.p.upns.0": "ZegoClient.updatePlayerEvent",
    */
    // 更新推拉流质量
    ZegoClient.prototype.updatePlayerNetStatus = function (streamid, event) {
        this.logger.debug("zc.p.upns.0 call");

        this.streamCenter.updatePlayerNetStatus(streamid, event);
    };
}

///////////////////////////////////////////////////////////////////////////////////
//webrtc 内部函数，由于ES6作用域的问题，目前的解决方案只能放在作用域外，rollup打包时会删除

/*
 *    "zc.p.hfwur.0": "ZegoClient.handleFetchWebRtcUrlRsp",
 */
function handleFetchWebRtcUrlRsp(_this, msg) {
    var streamId = msg.body.stream_id;

    if (msg.body.ptype === "push") {
        if (_this.publishStreamList[streamId]) {
            _this.streamCenter.startPublishingStream(streamId, msg.body.urls);
        }
        else {
            _this.logger.debug("zc.p.hfwur.0 no streamid to publish");
        }
    }
    else if (msg.body.ptype == "pull") {
        //check streamid exist
        var found = false;
        for (var i = 0; i < _this.streamList.length; i++) {
            if (_this.streamList[i].stream_id === streamId) {
                // 根据传入的流id判断当前的流列表中是否存在该流
                found = true;
                break;
            }
        }

        if (found == false) {
            _this.logger.info("zc.p.hfwur.0 cannot find stream to play");
            return;
        }
        _this.streamCenter.startPlayingStream(streamId, msg.body.urls);
    }
}

///////////////////////////////////////////////////////////////////////////////////
//小程序 内部函数，由于ES6作用域的问题，目前的解决方案只能放在作用域外，rollup打包时会删除
/*
 *    "zc.p.spsfc.0": "ZegoClient.startPlayingStreamFromCDN",
 */
//从CDN拉流
function startPlayingStreamFromCDN(_this, streamid) {
    _this.logger.debug("zc.p.spsfc.0 call");

    var streamUrl = null; // 判断传入的流id，在当前流列表中能否找到，找到就存起相对应的流地址
    for (var i = 0; i < _this.streamList.length; i++) {
        if (_this.streamList[i].stream_id === streamid) {
            // 根据传入的流id判断当前的流列表中是否存在该流
            streamUrl = _this.streamList[i].url_rtmp || [];
            break;
        }
    }

    if (!streamUrl || streamUrl.length <= 0) {
        _this.logger.error("zc.p.spsfc.0 cannot find stream url");
        return false;
    }

    _this.currentPlaySourceType = ENUM_DISPATCH_TYPE.cdn;
    _this.logger.debug("zc.p.spsfc.0 play stream");
    return doPlayStream(_this, streamid, [streamUrl]);
}

/*
 *    "zc.p.spsfb.0": "ZegoClient.startPlayingStreamFromBGP",
 */
//从BGP拉流
function startPlayingStreamFromBGP(_this, streamid) {
    _this.currentPlaySourceType = ENUM_DISPATCH_TYPE.ultra;
    _this.logger.info("zc.p.sps.0 fetch stream url");
    fetchPlayStreamUrl(_this, streamid);
    return true;
}

/*
 *    "fpsu.0": "ZegoClient.fetchPublishStreamUrl",
 */
//拉取服务端推流信息
function fetchPublishStreamUrl(_this, streamid) {
    _this.logger.debug("fpsu.0 call");
    if (_this.runState !== ENUM_RUN_STATE.login) {
        _this.logger.info("fpsu.0 state error");
        return;
    }

    _this.logger.info("fpsu.0 send fetch publish request");
    var publish_type = "";
    if (_this.preferPublishSourceType == ENUM_DISPATCH_TYPE.cdn) {
        publish_type = "cdn";
    } else if (_this.preferPublishSourceType == ENUM_DISPATCH_TYPE.ultra) {
        publish_type = "bgp";
    }

    var bodyData = {
        "stream_id": streamid,
        "url_type": _this.ultraPlaySourceType,
        "publish_type": publish_type
    };

    var seq = sendMessage(_this, "stream_publish", bodyData);
    if (seq == -1) {
        _this.onPublishStateUpdate(1, streamid, -1);
        _this.streamCenter.stopPublishingStream(streamid);
    } else {
        _this.streamUrlMap[seq] = streamid;
    }

    _this.logger.debug("fpsu.0 call success");
}

/*
 *    "fsu.0": "ZegoClient.fetchPlayStreamUrl",
 */
// 拉取服务端流信息
function fetchPlayStreamUrl(_this, streamid) {
    _this.logger.debug("fsu.0 call");
    // 不是处于登录状态，不让拉流
    if (_this.runState !== ENUM_RUN_STATE.login) {
        _this.logger.info("fsu.0 state error");
        return;
    }

    _this.logger.info("fsu.0 send fetch request");
    var bodyData = {
        "stream_ids": [streamid],
        "url_type": _this.ultraPlaySourceType,
    };

    // 发送消息
    var seq = sendMessage(_this, 'stream_url', bodyData);
    if (seq == -1) {
        _this.onPlayStateUpdate(1, streamid, -1);
    }
    else {
        _this.streamUrlMap[seq] = streamid;
    }
    _this.logger.debug("fsu.0 call success");
}

/*
 *    "zc.p.dps.0": "ZegoClient.doPlayStream",
 */
// 播放流
function doPlayStream(_this, streamid, streamUrls) {
    _this.logger.debug("zc.p.dps.0 call");

    /*
    var streamUrls = null;
    for (var i = 0; i < _this.streamList.length; i++) {
        if (_this.streamList[i].stream_id === streamid) {
            streamUrls = (_this.streamList[i].urls_ws || []);
            break;
        }
    }
    */

    if (!streamUrls || streamUrls.length <= 0) {
        return false;
    }

    _this.streamCenter.startPlayingStream(streamid, streamUrls, _this.currentPlaySourceType);
    return true;
}

/*
 *    "zc.p.dps.1": "ZegoClient.doPublishStream",
 */
// 发布流
function doPublishStream(_this, streamid, streamUrls) {
    _this.logger.debug("zc.p.dps.1 call");

    if (!streamUrls || streamUrls.length <= 0) {
        return false;
    }

    _this.logger.info("zc.p.dps.1 streamid: " + streamid + "streamUrl: " + streamUrls);
    _this.streamCenter.startPublishingStream(streamid, streamUrls, _this.preferPublishSourceType);
    _this.logger.debug("zc.p.dps.1 call success");
    return true;
}

/*
 *    "hfspur.0": "ZegoClient.handleFetchStreamPublishUrlRsp",
 */
function handleFetchStreamPublishUrlRsp(_this, msg) {
    _this.logger.debug("hfspur.0 call");

    var requestStreamId = _this.streamUrlMap[msg.header.seq];
    if (requestStreamId) {
        delete _this.streamUrlMap[msg.header.seq];
    }

    if (msg.body.err_code !== 0) {
        _this.logger.info("hfspur.0 server error=", msg.body.err_code);
        if (_this.publishStreamList[requestStreamId]) {
            _this.onPublishStateUpdate(1, requestStreamId, msg.body.err_code + SERVER_ERROR_CODE);
            _this.streamCenter.stopPublishingStream(requestStreamId);
        }
        return;
    }

    if (msg.body.stream_url_info) {
        var streamid = msg.body.stream_url_info.stream_id;
        //return rtmp address
        var urlsWS = msg.body.stream_url_info.urls_ws;

        if (!_this.publishStreamList[streamid]) {
            _this.logger.info("hfspur.0 cannot find stream");
            return;
        }

        _this.publishStreamList[streamid].url_rtmp = urlsWS;
        _this.publishStreamList[streamid].state = ENUM_PUBLISH_STREAM_STATE.tryPublish;

        doPublishStream(_this, streamid, urlsWS);
    }
}


/*
 *    "hfsur.0": "ZegoClient.handleFetchStreamUrlRsp",
 */
function handleFetchStreamUrlRsp(_this, msg) {
    _this.logger.debug("hfsur.0 call");

    var requestStreamId = _this.streamUrlMap[msg.header.seq];
    if (requestStreamId) {
        delete _this.streamUrlMap[msg.header.seq];
    }

    if (msg.body.err_code !== 0) {
        _this.logger.debug("hfsur.0 server error=", msg.body.err_code);
        //cann't get stream url, should callback
        _this.onPlayStateUpdate(1, requestStreamId, msg.body.err_code + SERVER_ERROR_CODE);

        return;
    }

    if (msg.body.stream_url_infos && msg.body.stream_url_infos.length > 0) {
        var streamid = msg.body.stream_url_infos[0].stream_id;
        //return rtmp address
        var urlsWS = msg.body.stream_url_infos[0].urls_ws;

        // 修复当_this.streamList为空时，没有对新增的流进行保存的问题，导致客户端收到新增的流，启动starPlayingStream不能播放问题
        var found = false;
        // 检查拉流streamid
        for (var i = 0; i < _this.streamList.length; i++) {
            if (_this.streamList[i].stream_id == streamid) {
                _this.streamList[i].urltra_url_rtmp = urlsWS;
                found = true;
                break;
            }
        }

        if (!found) {
            _this.streamList.push({
                stream_id: streamid,
                urltra_url_rtmp: urlsWS
            });
        }

        doPlayStream(_this, streamid, urlsWS);
    }

    _this.logger.debug("hfsur.0 call success");
}

/*
 *    "zc.p.c.0": "ZegoClient.config",
 */
// 配置初始化参数
ZegoClient.prototype.config = function (option) {
    this.logger.debug("zc.p.c.0 call");
    if (!checkConfigParam(this, option)) {
        this.logger.error("zc.p.c.0 param error");
        return false;
    }

    this.appid = option.appid;
    this.server = option.server;
    this.idName = option.idName;
    this.nickName = option.nickName;
    this.logger.setLogLevel(option.logLevel);
    if (option.audienceCreateRoom === false) {
        this.roomCreateFlag = 0;
    }

    if (option.remoteLogLevel != undefined) {
        this.logger.setRemoteLogLevel(option.remoteLogLevel);
    } else {
        this.logger.setRemoteLogLevel(0);
    }
    this.logger.setSessionInfo(option.appid, "", "", option.idName, "", PROTO_VERSION);

    if (option.logUrl != undefined && option.logUrl.length != 0) {
        this.logger.openLogServer(option.logUrl);
    }

    this.configOK = true;
    this.logger.debug("zc.p.c.0 call success");
    return true;
};

/*
 *    "zc.p.l.0": "ZegoClient.login",
 */
// 登入
ZegoClient.prototype.login = function (roomid, role, token, success, error) {
    this.logger.setSessionInfo(this.appid, roomid, "", this.idName, "", PROTO_VERSION);
    this.logger.info("zc.p.l.0 call:", roomid, token);


    if (!this.configOK ||
        !checkLoginParam({
            roomid: roomid,
            token: token
        })) {
        this.logger.info("zc.p.l.0 param error");
        return false;
    }

    if (this.runState !== ENUM_RUN_STATE.logout) {
        this.logger.debug("zc.p.l.0 reset");
        setRunState(this, ENUM_RUN_STATE.logout);
        resetRoom(this);
    }

    this.logger.debug("zc.p.l.0 begin");
    setRunState(this, ENUM_RUN_STATE.trylogin);

    this.roomid = roomid;
    this.token = token;
    this.role = role;
    registerCallback(this, 'login', {
        success: success,
        error: error
    });
    resetTryLogin(this);
    tryLogin(this);
    this.logger.info("zc.p.l.0 call success");
    return true;
};

/*
 *    "zc.p.l.1.0": "ZegoClient.logout",
 */
// 登出
ZegoClient.prototype.logout = function () {
    this.logger.debug("zc.p.l.1.0 call");

    if (this.runState === ENUM_RUN_STATE.logout) {
        this.logger.info("zc.p.l.1.0 at logout");
        return false;
    }

    setRunState(this, ENUM_RUN_STATE.logout);
    resetRoom(this);
    this.logger.debug("zc.p.l.1.0 call success");
    return true;
};

/* 
    "zc.p.eusu.0": "ZegoClient.enableUserStateUpdate",
*/
// 设置是否push用户进出房间，登录前设置有效

ZegoClient.prototype.setUserStateUpdate = function (update) {
    this.logger.debug("zc.p.eusu.0 call");

    if (typeof update !== "boolean") {
        this.logger.info("zp.p.eusu.0 param error");
        return false;
    }

    this.userStateUpdate = update;
    this.logger.debug("zc.p.eusu.0 call success " + update);
    return true;
};

/*
 *    "zc.p.scc.0": "ZegoClient.sendCustomCommand",
 */
// 发送自定义消息
ZegoClient.prototype.sendCustomCommand = function (dstMembers, customContent, success, error) {
    this.logger.debug("zc.p.scc.0 call");

    if (this.runState !== ENUM_RUN_STATE.login) {
        this.logger.info("zc.p.scc.0 state error");
        return false;
    }

    if (!dstMembers || !(dstMembers instanceof Array) || dstMembers.length == 0) {
        this.logger.info("zc.p.scc.0 dstMembers error");
        return false;
    }

    var bodyData = {
        "dest_id_name": dstMembers,
        "custom_msg": customContent
    };
    if (!checkCustomCommandParam(bodyData)) {
        this.logger.info("zc.p.scc.0 param error");
        return false;
    }

    // 发送消息
    sendCustomMessage(this, 'custommsg', bodyData, success, error);
    this.logger.debug("zc.p.scc.0 call success");
    return true;
};


// 发送房间消息
/*
 *    "srm.0": "ZegoClient.sendRoomMsg",
 */
ZegoClient.prototype.sendRoomMsg = function (msg_category, msg_type, msg_content, success, error) {
    this.logger.debug("srm.0 call");
    // 不是处于登录状态
    if (this.runState !== ENUM_RUN_STATE.login) {
        this.logger.info("srm.0 state error");
        return;
    }

    var timestamp = Date.parse(new Date());
    if (this.sendRoomMsgTime > 0 && this.sendRoomMsgTime + this.SendRoomMsgInterval > timestamp) {
        this.logger.info("srm.0 freq error");
        if (error) {
            error(sdkErrorList.FREQ_LIMITED, 0, msg_category, msg_type, msg_content);
        }
        return;
    }


    this.sendRoomMsgTime = timestamp;
    this.logger.debug("srm.0 send fetch request");
    var bodyData = {
        "msg_category": msg_category,
        "msg_type": msg_type,
        "msg_content": msg_content,
    };

    // 发送消息
    sendCustomMessage(this, 'im_chat', bodyData, success, error);
    this.logger.debug("srm.0 call success");
};

/*
 *    "zc.p.usei.0": "ZegoClient.updateStreamExtraInfo",
 */
//更新流信息
ZegoClient.prototype.updateStreamExtraInfo = function (streamid, extraInfo) {
    this.logger.debug("zc.p.usei.0 call");
    if (!streamid || streamid === "") {
        this.logger.info("zc.p.usei.0 param error");
        return false;
    }

    if (typeof extraInfo != "string") {
        return false;
    }

    if (this.publishStreamList[streamid]) {
        this.publishStreamList[streamid].extra_info = extraInfo;
        if (this.publishStreamList[streamid].state >= ENUM_PUBLISH_STREAM_STATE.update_info) {
            updateStreamInfo(this, streamid, ENUM_STREAM_SUB_CMD.liveUpdate, extraInfo);
        }
    }

    return true;
};

/*
 *    "zc.p.r.0": "ZegoClient.release",
 */
// 释放房间和播放器
ZegoClient.prototype.release = function () {
    this.logger.debug("zc.p.r.0 call");
    setRunState(this, ENUM_RUN_STATE.logout);
    resetRoom(this);

    this.logger.stopLogServer();
    this.logger.debug("zc.p.r.0 call success");
};

/*
 *    "zc.p.rjl.0": "ZegoClient.requestJoinLive",
 */
// 请求连麦信令
ZegoClient.prototype.requestJoinLive = function (dest_id_name, success, error, result_callback) {
    this.logger.debug("zc.p.rjl.0 call");
    var requestId = getRequestId(this);
    var signalCmd = getSignalCmdContent(this, requestId, dest_id_name);
    if (result_callback == undefined) {
        return false;
    }

    this.joinLiveCallbackMap[requestId] = result_callback;
    sendSignalCmd(this, ENUM_SIGNAL_SUB_CMD.joinLiveRequest, signalCmd, dest_id_name, success, error);
    return true;
};

/*
 *    "zc.p.ijl.0": "ZegoClient.inviteJoinLive",
 */
// 邀请连麦信令
ZegoClient.prototype.inviteJoinLive = function (dest_id_name, success, error, result_callback) {
    this.logger.debug("zc.p.ijl.0 call");
    var requestId = getRequestId(this);
    var signalCmd = getSignalCmdContent(this, requestId, dest_id_name);
    if (result_callback == undefined) {
        return false;
    }

    this.joinLiveCallbackMap[requestId] = result_callback;
    sendSignalCmd(this, ENUM_SIGNAL_SUB_CMD.joinLiveInvite, signalCmd, dest_id_name, success, error);

    return true;
};

/*
 *    "zc.p.rjl.1": "ZegoClient.respondJoinLive",
 */
// 响应连麦请求
ZegoClient.prototype.respondJoinLive = function (requestId, respondResult, success, error) {
    this.logger.debug("zc.p.rjl.1 call");
    var dest_id_name = this.joinLiveRequestMap[requestId];
    if (!dest_id_name) {
        this.logger.info("zc.p.rjl.1 no dest id name");
        return false;
    }

    var result = 0;
    if (respondResult === true)
        result = 1;

    var signalCmd = getSignalCmdContent(this, requestId, dest_id_name, result);
    sendSignalCmd(this, ENUM_SIGNAL_SUB_CMD.joinLiveResult, signalCmd, dest_id_name, success, error);

    delete this.joinLiveRequestMap[requestId];

    return true;
};

/*
 *    "zc.p.sjl.0": "ZegoClient.stopJoinLive",
 */
// 结束连麦信令
ZegoClient.prototype.endJoinLive = function (dest_id_name, success, error) {
    this.logger.debug("zc.p.sjl.0 call");
    var requestId = getRequestId(this);
    var signalCmd = getSignalCmdContent(this, requestId, dest_id_name);
    sendSignalCmd(this, ENUM_SIGNAL_SUB_CMD.joinLiveStop, signalCmd, dest_id_name, success, error);

    return true;
};

/*
 *    "zc.p.srm.0": "ZegoClient.sendReliableMessage",
 */
//发送可靠广播业务
ZegoClient.prototype.sendReliableMessage = function (type, data, success, error) {
    this.logger.debug("zc.p.srm.0 call");

    if (this.transSeqMap[type]) {
        delete this.transSeqMap[type];
    }

    this.transSeqMap[type] = {
        seq: 0
    };

    var body = {
        "trans_type": type,
        "trans_data": data
    };

    sendMessage(this, "trans", body, success, error);
};

/*
 *    "zc.p.srm.1": "ZegoClient.sendRelayMessage",
 */
//发送转发消息
ZegoClient.prototype.sendRelayMessage = function (type, data, success, error) {
    this.logger.debug("zc.p.srm.1 call");

    var timeWindow = this.datiTimeWindow;
    var offset = this.serverTimeOffset;
    if (timeWindow > 0) {
        this.realyMessageList.push({
            type: type,
            data: data,
            success: success,
            error: error
        });
        if (this.realyMessageList.length == 1) {
            setRelayTimer(this, offset, timeWindow);
        }
    }
    else {
        sendRelayMessageInternal(this, type, data, success, error);
    }
};

/*
 *    "zc.p.sbim.1": "ZegoClient.sendBigRoomMessage",
 */
//发送大房间消息
ZegoClient.prototype.sendBigRoomMessage = function (type, category, content, success, error) {
    this.logger.debug("zc.p.sbim.1 call");

    var timeWindow = this.bigimTimeWindow;
    var offset = this.serverTimeOffset;
    var serverTime = (new Date()).getTime() + offset;

    var clientId = ++this.cmdSeq;
    clientId = clientId.toString();

    if (success == undefined) {
        success = null;
    }
    if (error == undefined) {
        error = null;
    }

    this.bigImCallbackMap[clientId] = {
        success: success,
        error: error
    };

    if (timeWindow == 0) {
        var bodyData = {
            "msg_category": category,
            "msg_type": type,
            "msg_content": content,
            "bigmsg_client_id": clientId
        };

        this.logger.debug("zc.p.sbim.1 no time window");

        sendBigRoomMessageInternal(this, [bodyData], handleBigImMsgRsp, error);
    }
    else {
        var currentIndex = Math.floor(serverTime / timeWindow);
        this.logger.debug("currentIndex " + currentIndex + " lastTimeIndex " + this.bigImLastTimeIndex);
        
        if (this.bigImLastTimeIndex < currentIndex && this.bigImMessageList.length == 0) {
            this.bigImLastTimeIndex = currentIndex;

            var oneData = {
                "msg_category": category,
                "msg_type": type,
                "msg_content": content,
                "bigmsg_client_id": clientId
            };
    
            sendBigRoomMessageInternal(this, [oneData], handleBigImMsgRsp, error);
        }
        else {
            this.bigImMessageList.push({
                msg_category: category,
                msg_type: type,
                msg_content: content,
                bigmsg_client_id: clientId
            });

            if (this.bigImMessageList.length == 1) {
                setBigImTimer(this, offset, window);
            }
        }
    }
};

/**
   ZegoClient Helper Function
*/

// 获取全局参数对象header
function getHeader(_this, cmd) {
    _this.globalHeader = {
        'Protocol': 'req',
        'cmd': cmd,
        'appid': _this.appid,
        'seq': ++_this.cmdSeq,
        'user_id': _this.userid,
        'session_id': _this.sessionid,
        'room_id': _this.roomid,
    };
    return _this.globalHeader;
}

/*
 *    "sm.0": "ZegoClient.sendMessage",
 */
// 发送处理后的数据参数
function sendMessage(_this, cmd, body, success, error) {

    _this.logger.debug("sm.0 call " + cmd);
    if (!_this.websocket || _this.websocket.readyState !== 1) {
        _this.logger.info("sm.0 error");
        return -1;
    }
    var header = getHeader(_this, cmd);
    var data = {
        "header": header,
        "body": body
    };

    var dataBuffer = JSON.stringify(data);

    if (success == undefined) {
        success = null;
    }

    if (error == undefined) {
        error = null;
    }

    if (success != null || error != null) {
        var cmdData = {
            data: data,
            seq: header.seq,
            deleted: false,
            time: Date.parse(new Date()),
            success: success,
            error: error,
        };
        var cmdDataNode = _this.sendCommandList.push(cmdData);
        _this.sendCommandMap[cmdData.seq] = cmdDataNode;
    }

    _this.websocket.send(dataBuffer);
    _this.logger.debug("sm.0 success");

    return header.seq;
}

/*
 *    "scm.0": "ZegoClient.sendCustomMessage",
 */
// 发送带回调消息
function sendCustomMessage(_this, cmd, body, success, error) {
    _this.logger.debug("scm.0 call");
    if (!_this.websocket || _this.websocket.readyState !== 1) {
        _this.logger.info("scm.0 error");
        return false;
    }

    var header = getHeader(_this, cmd);
    var data = {
        "header": header,
        "body": body,
    };

    var dataBuffer = JSON.stringify(data);

    if (success == undefined) {
        success = null;
    }

    if (error == undefined) {
        error = null;
    }

    var cmdData = {
        data: data,
        seq: header.seq,
        deleted: false,
        time: Date.parse(new Date()),
        success: success,
        error: error,
    };
    var cmdDataNode = _this.sendDataList.push(cmdData);
    _this.sendDataMap[cmdData.seq] = cmdDataNode;
    _this.websocket.send(dataBuffer);
    _this.logger.debug("scm.0 success seq: ", header.seq);
    return true;
}

/**
   参数检查
*/
/*
 *    "ccp.0": "ZegoClient.checkConfigParam",
 */
function checkConfigParam(_this, option) {
    if (typeof option.appid != "number") {
        _this.logger.error("ccp.0 appid must be number");
        return false;
    }

    if (typeof option.server != "string" || option.server.length == 0) {
        _this.logger.error("ccp.0 server must be string and not empty");
        return false;
    }

    if (!typeof option.idName != "string" || option.idName.length == 0) {
        _this.logger.error("ccp.0 idName must be string and not empty");
    }

    return true;
}

function checkLoginParam(option) {
    return true;
}

function checkCustomCommandParam(option) {
    return true;
}

function checkPlayingStreamParam(option) {
    return true;
}

/**
    同一请求串行执行的回调，或者新请求的回调覆盖旧请求的回调
*/
// 注册回调函数
function registerCallback(_this, fName, option) {
    var sf = function () {},
        ef = function () {};
    if (option.success && (typeof option.success === 'function')) {
        sf = option.success;
    }
    if (option.error && (typeof option.error === 'function')) {
        ef = option.error;
    }
    _this.callbackList[fName + "SuccessCallback"] = sf;
    _this.callbackList[fName + "ErrorCallback"] = ef;
}

// 执行成功回调函数
function actionSuccessCallback(_this, fName) {
    return _this.callbackList[fName + "SuccessCallback"];
}

// 执行错误回调函数
function actionErrorCallback(_this, fName) {
    return _this.callbackList[fName + "ErrorCallback"];
}

/**
   错误管理
*/
function getServerError(code) {
    var serverErrorList = {
        1: "parse json error.",
        1001: "login is processing.",
        1002: "liveroom request error.",
        1003: "zpush connect fail.",
        1004: "zpush handshake fail.",
        1005: "zpush login fail.",
        1006: "user login state is wrong.",
        1007: "got no zpush addr",
        1008: "token error",
        1009: "dispatch error",
        1000000000: "liveroom cmd error, result=",
    };

    if (code === 0) {
        return {
            code: "ZegoClient.Success",
            msg: "success"
        };
    }

    var err = {};
    err.code = "ZegoClient.Error.Server";
    if (code > 1000000000) {
        err.msg = serverErrorList[1000000000] + code;
    } else if (serverErrorList[code] != undefined) {
        err.msg = serverErrorList[code];
    } else {
        err.msg = "unknown error code:" + code;
    }

    return err;
}

var sdkErrorList = {
    SUCCESS: {
        code: "ZegoClient.Success",
        msg: "success."
    },
    PARAM: {
        code: "ZegoClient.Error.Param",
        msg: "input error."
    },
    HEARTBEAT_TIMEOUT: {
        code: "ZegoClient.Error.Timeout",
        msg: "heartbeat timeout."
    },
    LOGIN_TIMEOUT: {
        code: "ZegoClient.Error.Timeout",
        msg: "login timeout."
    },
    SEND_MSG_TIMEOUT: {
        code: "ZegoClient.Error.Timeout",
        msg: "send customsg timeout."
    },
    RESET_QUEUE: {
        code: "ZegoClient.Error.Timeout",
        msg: "msg waiting ack is clear when reset."
    },
    LOGIN_DISCONNECT: {
        code: "ZegoClient.Error.Network",
        msg: "network is broken and login fail."
    },
    KICK_OUT: {
        code: "ZegoClient.Error.Kickout",
        msg: "kickout reason="
    },
    UNKNOWN: {
        code: "ZegoClient.Error.Unknown",
        msg: "unknown error."
    },
    FREQ_LIMITED: {
        code: "ZegoClient.Error.requencyLimited",
        msg: "Frequency Limited."
    }
    // SIGNAL_DISCONNECT: {
    //     code: "ZegoClient.Error.Timeout",
    //     msg: "WebRTC Signal broken"
    // }
};

/*
 *    "srs.0": "ZegoClient.setRunState",
 */
// 切换执行状态
function setRunState(_this, newRunState) {
    _this.logger.debug("srs.0 old=" + _this.runState + ", new=" + newRunState);
    _this.lastRunState = _this.runState;
    _this.runState = newRunState;
}

function checkMessageListTimeout(_this, messageList, messageMap) {
    var head = messageList.getFirst();
    var timestamp = Date.parse(new Date());
    var checkCount = 0;
    var timeoutMsgCount = 0;
    var dropMsgCount = 0;

    while (head != null) {
        if ((head._data.time + _this.sendDataTimeout) > timestamp) {
            break;
        }

        delete messageMap[head._data.data.header.seq];
        messageList.remove(head);
        ++timeoutMsgCount;

        if (head._data.error == null ||
            (_this.sendDataDropTimeout > 0 &&
                (head._data.time + _this.sendDataDropTimeout) < timestamp)) {
            ++dropMsgCount;
        } else {
            if (head._data.data.body.custom_msg != undefined) {
                head._data.error(sdkErrorList.SEND_MSG_TIMEOUT,
                    head._data.data.header.seq,
                    head._data.data.body.custom_msg);
            } else {
                head._data.error(sdkErrorList.SEND_MSG_TIMEOUT,
                    head._data.data.header.seq);
            }
        }

        ++checkCount;
        if (checkCount >= _this.sendDataCheckOnceCount) {
            break;
        }
        head = messageList.getFirst();
    }

    if (timeoutMsgCount != 0 || dropMsgCount != 0) {
        _this.logger.debug("scmt.0 call success, stat: timeout=", timeoutMsgCount, "drop=", dropMsgCount);
    }
}

/*
 *    "scmt.0": "ZegoClient.startCheckMessageTimeout",
 */
//检查custommsg发送包是否超时
function startCheckMessageTimeout(_this) {
    //_this.logger.debug("scmt.0 call");
    if (_this.runState !== ENUM_RUN_STATE.login) {
        _this.logger.info("scmt.0 state error");
        return;
    }

    checkMessageListTimeout(_this, _this.sendDataList, _this.sendDataMap);
    checkMessageListTimeout(_this, _this.sendCommandList, _this.sendCommandMap);

    //由于webrtc会存在多个signal, 如果每个signal都用timer来检查消息超时，可能会有性能问题。所有由room的timer触发来检查
    if (BUILD_WEBRTC) {
        _this.streamCenter.checkMessageTimeout();
    }
    
    _this.sendDataCheckTimer = setTimeout(function () {
        startCheckMessageTimeout(_this);
    }, _this.sendDataCheckInterval);

}

/*
 *    "rcm.0": "ZegoClient.resetCheckMessage",
 */
// 关闭/清除custommsg超时检查逻辑
function checkSendMessageList(messageList) {
    var head = messageList.getFirst();
    while (head != null) {
        messageList.remove(head);
        if (head._data.error != null) {
            if (head._data.data.body.custom_msg != undefined) {
                head._data.error(sdkErrorList.SEND_MSG_TIMEOUT,
                    head._data.data.header.seq,
                    head._data.data.body.custom_msg);
            } else {
                head._data.error(sdkErrorList.SEND_MSG_TIMEOUT,
                    head._data.data.header.seq);
            }
        }
        head = messageList.getFirst();
    }
}

function resetCheckMessage(_this) {
    _this.logger.debug("rcm.0 call");

    clearTimeout(_this.sendDataCheckTimer);
    _this.sendDataCheckTimer = null;

    checkSendMessageList(_this.sendDataList);
    checkSendMessageList(_this.sendCommandList);

    _this.sendDataMap = {};
    _this.sendCommandMap = {};

    _this.logger.debug("rcm.0 call success");
}

function resetBigRoomInfo(_this) {
    //清除trans信令信息
    _this.transSeqMap = {};

    //清除relay信令信息
    _this.realyMessageList = [];
    if (_this.relayTimer) {
        clearTimeout(_this.relayTimer);
        _this.relayTimer = null;
    }

    //清除大房间消息
    _this.bigImLastTimeIndex = 0;
    _this.bigIMmessageList = [];
    _this.bigImCallbackMap = {};
    if (_this.bigImTimer) {
        clearTimeout(_this.bigImTimer);
        _this.bigImTimer = null;
    }

    _this.serverTimeOffset = 0;
    _this.datiTimeWindow = 0;
    _this.bigimTimeWindow = 0;
}

function resetStreamCenter(_this) {

    _this.customUrl = null;
    _this.streamCenter.reset();

    if (_this.websocket && _this.websocket.readyState === 1) {
        //send stream delete info
        for (var streamid in _this.publishStreamList) {
            if (_this.publishStreamList[streamid].state == ENUM_PUBLISH_STREAM_STATE.publishing) {
                updateStreamInfo(_this, streamid, ENUM_STREAM_SUB_CMD.liveEnd, _this.publishStreamList[streamid].extra_info);
            }
        }
    }
}

/*
 *    "rht.0": "ZegoClient.resetHeartbeat",
 */
// 关闭/清除心跳计时器对象
function resetHeartbeat(_this) {
    _this.logger.debug("rht.0 call");
    clearTimeout(_this.heartbeatTimer);
    _this.heartbeatTimer = null;
    _this.tryHeartbeatCount = 0;
    _this.logger.debug("rht.0 call success");
}

/*
 *    "sht.0": "ZegoClient.startHeartbeat",
 */
// 发送心跳包 / 并启动心跳计时器
function startHeartbeat(_this) {
    _this.logger.debug("sht.0 call");

    // 若当前不是处于login登录状态，则返回不做心跳
    if (_this.runState !== ENUM_RUN_STATE.login) {
        _this.logger.info("sht.0 state error");
        return;
    }

    // 若尝试心跳次数大于最大尝试次数，则置为登出状态，清除状态数据
    if (++_this.tryHeartbeatCount > MAX_TRY_HEARTBEAT_COUNT) {
        _this.logger.error("sht.0 come to try limit");

        setRunState(_this, ENUM_RUN_STATE.logout);
        resetRoom(_this);

        _this.onDisconnect(sdkErrorList.HEARTBEAT_TIMEOUT);

        return;
    }

    // 发送消息
    _this.logger.debug("sht.0 send packet");
    var bodyData = {
        "reserve": 0
    };
    sendMessage(_this, 'hb', bodyData);

    // heartbeatInterval后再发
    _this.heartbeatTimer = setTimeout(function () {
        startHeartbeat(_this);
    }, _this.heartbeatInterval);

    _this.logger.debug("sht.0 call success");
}

/*
 *    "rtl.0": "ZegoClient.resetTryLogin",
 */
// 清除尝试登录计时器对象
function resetTryLogin(_this) {
    _this.logger.debug("rtl.0 call");
    clearTimeout(_this.tryLoginTimer);
    _this.tryLoginTimer = null;
    _this.tryLoginCount = 0;
    _this.logger.debug("rtl.0 call success");
}

/*
 *    "tl.0": "ZegoClient.tryLogin",
 */
// 尝试重新登录
function tryLogin(_this) {
    _this.logger.debug('tl.0 call');
    if (_this.runState !== ENUM_RUN_STATE.trylogin) {
        _this.logger.info('tl.0 state error');
        return;
    }
    // 如果尝试登录次数大于最大可尝试次数，则直接置为logout登出状态
    if (++_this.tryLoginCount > MAX_TRY_LOGIN_COUNT) {
        _this.logger.error('tl.0 fail times limit');
        var lastRunState = _this.lastRunState;
        setRunState(_this, ENUM_RUN_STATE.logout);
        resetRoom(_this);

        if (lastRunState == ENUM_RUN_STATE.login) {
            //relogin fail, not by user
            _this.logger.info('tl.0 fail and disconnect');
            _this.onDisconnect(sdkErrorList.LOGIN_DISCONNECT);
        } else {
            //trylogin fail, call by user
            _this.logger.info('tl.0 fail and callback user');
            actionErrorCallback(_this, 'login')(sdkErrorList.LOGIN_TIMEOUT);
        }

        return;
    }

    // 如果websocket还未初始化或者还不是处于连接状态
    if (!_this.websocket || _this.websocket.readyState !== 1) {
        _this.logger.debug('tl.0 need new websocket');

        try {
            // 若已经初始化，但是还不是连接状态，先清除置为null
            if (_this.websocket) {
                _this.logger.info('tl.0 close error websocket');
                _this.websocket.onclose = null;
                _this.websocket.onerror = null;
                _this.websocket.close();
                _this.websocket = null;
            }

            // 建立websocket连接
            _this.logger.debug('tl.0 new websocket');

            if (BUILD_WEBRTC) {
                _this.websocket = new WebSocket(_this.server);
            }

            if (BUILD_WX) {
                _this.websocket = new ZegoWebSocket(_this.server);
            }

            _this.websocket.onopen = function () {
                // websocket连接已经打开
                // 注册onmessage函数，处理服务的发过来的消息，该函数只调用一次
                _this.logger.info('tl.0 websocket.onpen call');
                bindWebSocketHandler(_this);


                // 发送消息
                _this.logger.info('tl.0 websocket.onpen send login');
                var bodyData = loginBodyData(_this);
                sendMessage(_this, 'login', bodyData);
                _this.logger.debug('tl.0 websocket.onpen call success');

            };
        } catch (e) {
            _this.logger.error("tl.0 websocket err:" + e);
        }

    } else { // websocket已建立成功
        _this.logger.info('tl.0 use current websocket and sent login');
        var bodyData = loginBodyData(_this);
        sendMessage(_this, 'login', bodyData);
    }

    //settimeout
    _this.tryLoginTimer = setTimeout(function () {
        tryLogin(_this);
    }, TRY_LOGIN_INTERVAL[_this.tryLoginCount % MAX_TRY_LOGIN_COUNT]);

    _this.logger.debug('tl.0 call success');
}

//登录请求数据包
function loginBodyData(_this) {
    var bodyData = {
        "id_name": _this.idName,
        "nick_name": _this.nickName,
        "role": _this.role,
        "token": _this.token,
        "version": PROTO_VERSION,
        "user_state_flag": _this.userStateUpdate ? 1 : 0,
        "room_create_flag": _this.roomCreateFlag
    };

    return bodyData;
}

/*
 *    "rr.0": "ZegoClient.resetRoom",
 */
// 重置房间信息
function resetRoom(_this) {
    _this.logger.debug('rr.0 call');
    // 清除尝试登录计时器对象
    resetTryLogin(_this);

    // 清除心跳计时器对象
    resetHeartbeat(_this);

    // 清除检查消息循环
    resetCheckMessage(_this);

    //清除推拉流状态
    if (BUILD_VIDEO) {
        resetStreamCenter(_this);
    }
    
    // 清除流列表
    _this.streamList = [];
    _this.publishStreamList = {};
    _this.streamQuerying = false;

    // 清除连麦信令
    _this.joinLiveCallbackMap = {};
    _this.joinLiveRequestMap = {};

    // 清除请求url信息
    _this.streamUrlMap = {};

    //清除大房间消息
    resetBigRoomInfo(_this);

    _this.cmdCallback = {};

    // 防止多次重置时，发送多次消息
    _this.logger.debug('rr.0 call send logout=', _this.sessionid);
    if (_this.sessionid !== '0') {
        var bodyData = {
            "reserve": 0
        };
        sendMessage(_this, 'logout', bodyData);
    }

    if (_this.websocket) {
        _this.websocket.onclose = null;
        _this.websocket.onerror = null;
        _this.websocket.close();
        _this.websocket = null;
    }

    _this.userid = '0';
    _this.sessionid = '0';
    _this.logger.setSessionInfo(_this.appid, _this.roomid, _this.userid, _this.idName, _this.sessionid, PROTO_VERSION);
    _this.logger.debug('rr.0 call success');
}

/*
 *    "fsl.0": "ZegoClient.fetchStreamList",
 */
// 拉取服务端流信息
function fetchStreamList(_this) {
    _this.logger.debug("fsl.0 call");
    // 不是处于登录状态，不让拉流
    if (_this.runState !== ENUM_RUN_STATE.login) {
        _this.logger.info("fsl.0 state error");
        return;
    }

    // 是否正处于拉流状态 false 为完成， true为正在拉流
    if (_this.streamQuerying) {
        _this.logger.info("fsl.0 already doing");
        return;
    }
    _this.streamQuerying = true;
    _this.logger.debug("fsl.0 send fetch request");
    var bodyData = {
        "reserve": 0
    };

    // 发送消息
    sendMessage(_this, 'stream_info', bodyData);
    _this.logger.debug("fsl.0 call success");
}

/*
 *    "ful.0": "ZegoClient.fetchUserList",
 */
// 拉取服务端user信息
function fetchUserList(_this) {
    _this.logger.debug("ful.0 call");
    if (_this.userQuerying) {
        _this.logger.info("ful.0 is already querying");
        return;
    }

    _this.userQuerying = true;
    _this.userTempList = [];
    fetchUserListWithPage(_this, 0);
    _this.logger.debug("ful.0 the first time call");

    return;
}

/*
 *    "fulwp.0": "ZegoClient.fetchUserListWithPage",
 */
//分页拉取user list
function fetchUserListWithPage(_this, userIndex) {
    _this.logger.debug("fulwp.0 call");

    var bodyData = {
        "user_index": userIndex,
        "sort_type": 0
    };

    // 发送消息
    sendMessage(_this, 'user_list', bodyData);
    _this.logger.debug("fulwp.0 call success");
}

function isKeepTryLogin(code) {
    switch (code) {
    case 1002: //liveroom connect error
    case 1003: //zpush connect error
        return true;
    default:
        return false;
    }
}

/*
 *    "usi.0": "ZegoClient.updateStreamInfo",
 */
//流更新信令
function updateStreamInfo(_this, streamid, cmd, stream_extra_info, error) {
    _this.logger.debug("usi.0 call");

    var extra_info = "";
    if (stream_extra_info != undefined && typeof stream_extra_info == "string") {
        extra_info = stream_extra_info;
    }

    var data = {
        "stream_id": streamid,
        "extra_info": extra_info
    };

    var stream_msg = JSON.stringify(data);
    var bodyData = {
        "sub_cmd": cmd,
        "stream_msg": stream_msg
    };

    sendMessage(_this, "stream", bodyData, undefined, error);
    _this.logger.debug("usi.0 call success cmd " + cmd);
}

//连麦信令
/*
 *    "ssc.0": "ZegoClient.SendSignalCmd",
 */
function sendSignalCmd(_this, cmd, signalMsg, dest_id_name, success, error) {
    _this.logger.debug("ssc.0 call");
    if (_this.runState !== ENUM_RUN_STATE.login) {
        _this.logger.info("ssc.0 state error");
        return;
    }

    _this.logger.debug("ssc.0 send signal cmd " + cmd);
    var bodyData = {
        "sub_cmd": cmd,
        "signal_msg": signalMsg,
        "dest_id_name": [dest_id_name]
    };

    sendMessage(_this, "signal", bodyData, success, error);
    _this.logger.debug("ssc.0 call success");
}

//requestId
function getRequestId(_this) {
    ++_this.cmdSeq;
    return _this.idName + "-" + _this.cmdSeq;
}

function getSignalCmdContent(_this, requestId, dest_id_name, result) {
    var data = {
        "request_id": requestId,
        "room_id": _this.roomid,
        "from_userid": _this.idName,
        "from_username": _this.nickName,
        "to_userid": dest_id_name
    };

    if (result != undefined) {
        data["result"] = result;
    }
    return JSON.stringify(data);
}

/*
 *    "frm.0": "ZegoClient.fetchReliableMessage",
 */
//拉取可靠业务广播
function fetchReliableMessage(_this, type, localSeq) {
    _this.logger.debug("frm.0 call");

    var data = {
        "trans_type": type,
        "trans_local_seq": localSeq
    };

    sendMessage(_this, "trans_fetch", data);
    _this.logger.debug("frm.0 call success");
}

/*
 *    "srm.0": "ZegoClient.sendRelayMessage",
 */
//发送relay信令
function sendRelayMessageInternal(_this, type, data, success, error) {
    _this.logger.debug("srm.0 call");

    var bodyData = {
        "relay_type": type,
        "relay_data": data
    };

    sendMessage(_this, "relay", bodyData, success, error);
}

/*
 *    "srt.0": "ZegoClient.SetRelayTimer",
 */
function setRelayTimer(_this, offset, timeWindow) {
    var serverTimestamp = (new Date()).getTime() + offset;
    var residue = timeWindow * 2 - (serverTimestamp % timeWindow);
    var interval = generateRandumNumber(residue);

    _this.logger.info("srt.0 setTimer " + interval);

    _this.relayTimer = setTimeout(function () {
        onRelayTimer(_this);
    }, interval);
}

/*
 *    "ort.0": "ZegoClient.onRelayTimer",
 */
function onRelayTimer(_this) {
    if (_this.realyMessageList.length == 0) {
        _this.logger.info("ort.0 no relay data");
        return;
    }

    var relayInfo = _this.realyMessageList[0];
    sendRelayMessageInternal(_this, relayInfo.type, relayInfo.data, relayInfo.success, relayInfo.error);

    clearTimeout(_this.relayTimer);
    _this.relayTimer = null;

    _this.realyMessageList.splice(0, 1);
    if (_this.realyMessageList.length > 0) {
        setRelayTimer(_this, _this.serverTimeOffset, _this.datiTimeWindow);
    }
}

/*
 *    "sbim.0": "ZegoClient.sendBigIMMessage",
 */
//发送bigim信令
function sendBigRoomMessageInternal(_this, msgs, success, error) {
    _this.logger.debug("sbim.0 call");

    var bodyData = {
        "msgs": msgs
    };

    sendMessage(_this, "bigim_chat", bodyData, success, error);
}

/*
 *    "sbt.0": "ZegoClient.setBigImTimer",
 */
function setBigImTimer(_this, offset, timeWindow) {
    var serverTimestamp = (new Date()).getTime() + offset;
    var residue = timeWindow - (serverTimestamp % timeWindow);
    var interval = generateRandumNumber(timeWindow) + residue;

    _this.logger.info("sbt.0 setTimer " + interval);

    _this.bigImTimer = setTimeout(function () {
        onBigImTimer(_this);
    }, interval);
}

/*
 *    "ort.0": "ZegoClient.onRelayTimer",
 */
function onBigImTimer(_this) {
    var serverTimestamp = (new Date()).getTime() + _this.serverTimeOffset;
    _this.bigImLastTimeIndex = Math.floor(serverTimestamp / _this.bigimTimeWindow);

    var bodyData = [];
    var requestList = [];
    for (var i = 0; i < _this.bigImMessageList.length; i++) {
        if (i >= 20) {
            break;
        }

        var info = _this.bigImMessageList[i];
        bodyData.push({
            "msg_category": info.msg_category,
            "msg_type": info.msg_type,
            "msg_content": info.msg_content,
            "bigmsg_client_id": info.bigmsg_client_id
        });

        requestList.push(info.bigmsg_client_id);
    }

    if (_this.bigImMessageList.length > 20) {
        _this.bigImMessageList.splice(0, 20);
    } else {
        _this.bigImMessageList = [];
    }

    sendBigRoomMessageInternal(_this, bodyData, handleBigImMsgRsp, function (err, seq) {
        for (var i = 0; i < requestList.length; i++) {
            var clientId = requestList[i];
            var callbackInfo = _this.bigImCallbackMap[clientId];
            if (callbackInfo) {
                if (callbackInfo.error != null) {
                    callbackInfo.error(err, seq);
                }

                delete _this.bigImCallbackMap[clientId];
            }
        }
    });

    clearTimeout(_this.bigImTimer);
    _this.bigImTimer = null;

    if (_this.bigImMessageList.length > 0) {
        setBigImTimer(_this, _this.serverTimeOffset, _this.bigimTimeWindow);
    }
}

//生成随机数
function generateRandumNumber(maxNum) {
    return parseInt(Math.random() * (maxNum + 1), 10);
}


/*
 *    "hlf.0": "ZegoClient.handleLoginFail",
 */
function handleLoginFail(_this, msg) {
    _this.logger.debug("hlf.0 call");
    if (isKeepTryLogin(msg.body.err_code)) {
        _this.logger.info("hlf.0 KeepTry true");
        return;
    }

    //stop
    var lastRunState = _this.lastRunState;
    setRunState(_this, ENUM_RUN_STATE.logout);
    resetRoom(_this);

    var err = getServerError(msg.body.err_code);
    if (lastRunState == ENUM_RUN_STATE.login) {
        //relogin fail, not by user
        _this.logger.info('hlf.0 callback disconnect');
        _this.onDisconnect(err);
    } else {
        //trylogin fail, call by user
        _this.logger.info('hlf.0 callback error');
        actionErrorCallback(_this, 'login')(err);
    }

    _this.logger.debug("hlf.0 call success");
}

/*
 *    "hls.0": "ZegoClient.handleLoginSuccess",
 */
function handleLoginSuccess(_this, msg) {
    _this.logger.debug("hls.0 call");

    //enter login
    var lastRunState = _this.lastRunState;
    setRunState(_this, ENUM_RUN_STATE.login);
    _this.userid = msg.body.user_id;
    _this.sessionid = msg.body.session_id;

    //set log
    _this.logger.setSessionInfo(_this.appid, _this.roomid, _this.userid, _this.idName, _this.sessionid, PROTO_VERSION);
    if (msg.body.config_info != undefined) {
        _this.logger.setRemoteLogLevel(msg.body.config_info.log_level);
        if (msg.body.config_info.log_url != "") {
            _this.logger.openLogServer(msg.body.config_info.log_url);
        }
    }

    //get time stamp & window
    if (msg.body.ret_timestamp != undefined && typeof msg.body.ret_timestamp == "string") {
        var serverTime = parseFloat(msg.body.ret_timestamp);
        if (serverTime == 0) {
            _this.serverTimeOffset = 0;
        } else {
            _this.serverTimeOffset = msg.body.ret_timestamp - (new Date()).getTime();
        }
    }
    if (msg.body.bigim_time_window != undefined && typeof msg.body.bigim_time_window == "number") {
        _this.bigimTimeWindow = msg.body.bigim_time_window;
    }
    if (msg.body.dati_time_window != undefined && typeof msg.body.dati_time_window == "number") {
        _this.datiTimeWindow = msg.body.dati_time_window;
    }

    //stop trylogin
    resetTryLogin(_this);

    //start heartbeat
    resetHeartbeat(_this);
    _this.heartbeatInterval = msg.body.hearbeat_interval;
    if (_this.heartbeatInterval < MINIUM_HEARTBEAT_INTERVAL) {
        _this.heartbeatInterval = MINIUM_HEARTBEAT_INTERVAL;
    }
    _this.heartbeatTimer = setTimeout(function () {
        startHeartbeat(_this);
    }, _this.heartbeatInterval);

    //start checkmessage
    resetCheckMessage(_this);
    _this.sendDataCheckTimer = setTimeout(function () {
        startCheckMessageTimeout(_this);
    }, _this.sendDataCheckInterval);

    //webrtc
    if (BUILD_WEBRTC) {

        _this.streamCenter.setSessionInfo(_this.appid, _this.idName, _this.token);

        _this.logger.debug("hls.0 call success");
    }

    //handle stream list
    _this.streamQuerying = false;
    if (lastRunState == ENUM_RUN_STATE.login) {
        _this.logger.info("hls.0 recover from disconnect so call streamupdate");
        //relogin and stream update callback
        handleFullUpdateStream(_this, msg.body.stream_seq, msg.body.stream_info || []);
    } else {
        _this.logger.info("hls.0 success callback user");
        //login and callback
        _this.streamList = (msg.body.stream_info || []);
        _this.streamSeq = msg.body.stream_seq;

        for (var i = 0; i < _this.streamList.length; i++) {
            //check whether stream contain self
            if (_this.streamList[i].anchor_id_name == _this.idName) {
                //delete this stream
                updateStreamInfo(_this, _this.streamList[i].stream_id, ENUM_STREAM_SUB_CMD.liveEnd);
                _this.streamList.splice(i, 1);
            }
        }

        var callbackStreamList = [];
        callbackStreamList = makeCallbackStreamList(_this.streamList);
        actionSuccessCallback(_this, 'login')(callbackStreamList);
    }

    //handle anchor info
    if (msg.body.anchor_info) {
        var anchorId = msg.body.anchor_info.anchor_id_name;
        var anchorName = msg.body.anchor_info.anchor_nick_name;
        _this.onGetAnchorInfo(anchorId, anchorName);
    }

    if (msg.body.online_count != undefined && msg.body.online_count != 0) {
        _this.onUpdateOnlineCount(_this.roomid, msg.body.online_count);
    }

    //handle userStateUpdate
    _this.logger.debug("hls.0 userStateUpdate " + _this.userStateUpdate);

    if (_this.userStateUpdate) {
        _this.logger.info("hls.0 fetch all new userlist");
        fetchUserList(_this);
    }
}

/*
 *    "hlr.0": "ZegoClient.handleLoginRsp",
 */

function handleLoginRsp(_this, msg) {
    _this.logger.debug("hlr.0 call");
    if (_this.runState !== ENUM_RUN_STATE.trylogin) {
        _this.logger.info("hlr.0 state error");
        return;
    }

    if (msg.header.seq !== _this.cmdSeq) {
        _this.logger.info("hlr.0 in wrong seq, local=", _this.cmdSeq, ",recv=", msg.header.seq);
        return;
    }

    if (msg.body.err_code !== 0) {
        handleLoginFail(_this, msg);
        _this.logger.info("hlr.0 server error=", msg.body.err_code);
        return;
    }
    handleLoginSuccess(_this, msg);
    _this.logger.info("hlr.0 call success.");
}

/*
 *    "hhbr.0": "ZegoClient.handleHeartbeatRsp",
 */
function handleHeartbeatRsp(_this, msg) {
    _this.logger.debug("hhbr.0 call");
    if (msg.body.err_code !== 0) {
        _this.logger.info("hhbr.0 call disconnect, server error=", msg.body.err_code);

        setRunState(_this, ENUM_RUN_STATE.logout);
        resetRoom(_this);

        var err = getServerError(msg.body.err_code);
        _this.onDisconnect(err);

        return;
    }

    //reset heartbeat fail count
    _this.tryHeartbeatCount = 0;
    _this.heartbeatInterval = msg.body.hearbeat_interval;
    if (_this.heartbeatInterval < MINIUM_HEARTBEAT_INTERVAL) {
        _this.heartbeatInterval = MINIUM_HEARTBEAT_INTERVAL;
    }

    //update timewindow
    if (msg.body.bigim_time_window != undefined && typeof msg.body.bigim_time_window == "number") {
        _this.bigimTimeWindow = msg.body.bigim_time_window;
    }
    if (msg.body.dati_time_window != undefined && typeof msg.body.dati_time_window == "number") {
        _this.datiTimeWindow = msg.body.dati_time_window;
    }

    //check trans seq
    if (msg.body.trans_seqs != undefined) {
        for (var i = 0; i < msg.body.trans_seqs.length; i++) {
            var type = msg.body.trans_seqs[i].trans_type;
            var seq = msg.body.trans_seqs[i].trans_seq;
            if (!_this.transSeqMap[type] || _this.transSeqMap[type].seq !== seq) {
                //fetch trans 
                var oldSeq = 0;
                if (!_this.transSeqMap[type]) {
                    oldSeq = 0;
                    _this.logger.debug("hhbr.0 type " + type + " server seq " + seq);
                } else {
                    oldSeq = _this.transSeqMap[type].seq;
                    _this.logger.debug("hhbr.0 type " + type + " old seq " + _this.transSeqMap[type].seq + " server seq " + seq);
                }

                fetchReliableMessage(_this, type, oldSeq);
            }
        }
    }

    //update stream if diff/
    if (msg.body.stream_seq !== _this.streamSeq) {
        _this.logger.debug("hhbr.0 current seq " + _this.streamSeq + " server Seq " + msg.body.stream_seq);
        fetchStreamList(_this);
    }

    //update user if diff
    if (msg.body.server_user_seq !== _this.userSeq && _this.userStateUpdate) {
        _this.logger.info("hhbr.0 call update user " + msg.body.server_user_seq, _this.userSeq);
        fetchUserList(_this);
    }

    //try updating stream info again
    for (var streamid in _this.publishStreamList) {
        if (_this.publishStreamList[streamid].state == ENUM_PUBLISH_STREAM_STATE.update_info) {
            _this.logger.info("hbbr.0 try to update stream info");
            updateStreamInfo(_this, streamid, ENUM_STREAM_SUB_CMD.liveBegin, _this.publishStreamList[streamid].extra_info);
        }
    }

    //get online count
    if (msg.body.online_count != undefined && msg.body.online_count != 0) {
        _this.onUpdateOnlineCount(_this.roomid, msg.body.online_count);
    }

    _this.logger.debug("hhbr.0 call success");
}

/*
 *    "hlor.0": "ZegoClient.handleLogoutRsp",
 */
function handleLogoutRsp(_this, msg) {
    _this.logger.debug("hlor.0 result=", msg.body.err_code);
}

/*
 *    "hscmr.0": "ZegoClient.handleSendCustomMsgRsp",
 */
function handleSendCustomMsgRsp(_this, msg) {
    _this.logger.debug("hscmr.0 call");
    var sendDataNode = _this.sendDataMap[msg.header.seq];
    var sendData;
    if (sendDataNode != null) {
        sendData = sendDataNode._data;

        if (sendData.data.header.cmd != "custommsg") {
            _this.logger.error("hscmr.0 cmd wrong" + sendData.data.header.cmd);
        } else {
            if (msg.body.err_code === 0) {
                if (sendData.success != null) {
                    sendData.success(msg.header.seq, sendData.data.body.custom_msg);
                }
            } else {
                if (sendData.error != null) {
                    sendData.error(getServerError(msg.body.err_code), msg.header.seq, sendData.data.body.custom_msg);
                }
            }
        }

        delete _this.sendDataMap[msg.header.seq];
        _this.sendDataList.remove(sendDataNode);
    } else {
        _this.logger.error('hscmr.0 no found seq=' + msg.header.seq);
    }
    _this.logger.debug("hscmr.0 call success");
}

function handleRelayRspCallback(_this, msg, sendData) {
    if (msg.body.err_code === 0) {
        if (sendData.success != null) {
            sendData.success(msg.header.seq, msg.body.relay_result);
        }
    } else {
        if (sendData.error != null) {
            sendData.error(getServerError(msg.body.err_code), msg.header.seq);
        }
    }
}

function handleBigImRspCallback(_this, msg, sendData) {
    if (msg.body.err_code === 0) {
        if (sendData.success != null) {
            //should be sendData.success callback
            handleBigImMsgRsp(_this, msg);
        }
    }
    else {
        if (sendData.error != null) {
            sendData.error(getServerError(msg.body.err_code), msg.header.seq);
        }
    }
}

/*
 *    "hscmr.0": "ZegoClient.handleSendCommandMsgRsp",
 */
function handleSendCommandMsgRsp(_this, msg) {
    _this.logger.debug("hscmr.0 call");
    var sendDataNode = _this.sendCommandMap[msg.header.seq];
    var sendData;
    if (sendDataNode != null) {
        sendData = sendDataNode._data;

        if (sendData.data.header.cmd == "login") {
            _this.logger.debug("hscmr.0 don't check " + sendData.data.header.cmd);
        } else if (sendData.data.header.cmd == "relay") {
            handleRelayRspCallback(_this, msg, sendData);
        } else if (sendData.data.header.cmd == "bigim_chat") {
            handleBigImRspCallback(_this, msg, sendData);
        } else {
            if (msg.body.err_code === 0) {
                if (sendData.success != null) {
                    sendData.success(msg.header.seq);
                }
            } else {
                if (sendData.error != null) {
                    sendData.error(getServerError(msg.body.err_code), msg.header.seq);
                }
            }
        }

        delete _this.sendCommandMap[msg.header.seq];
        _this.sendCommandList.remove(sendDataNode);
    }

    _this.logger.debug("hscmr.0 call success");
}

/*
 *    "hsrmr.0": "ZegoClient.handleSendRoomMsgRsp",
 */
function handleSendRoomMsgRsp(_this, msg) {
    _this.logger.debug("hsrmr.0 call");
    var sendDataNode = _this.sendDataMap[msg.header.seq];
    var sendData;

    if (sendDataNode != null) {
        sendData = sendDataNode._data;

        if (sendData.data.header.cmd != "im_chat") {
            _this.logger.error("hsrmr.0 cmd wrong" + sendData.data.header.cmd);
        } else {
            if (msg.body.err_code === 0) {
                if (sendData.success) {
                    sendData.success(msg.header.seq, msg.body.msg_id, sendData.data.body.msg_category, sendData.data.body.msg_type, sendData.data.body.msg_content);
                }
            } else {
                if (sendData.error) {
                    sendData.error(getServerError(msg.body.err_code), msg.header.seq, sendData.data.body.msg_category, sendData.data.body.msg_type, sendData.data.body.msg_content);
                }
            }
        }

        delete _this.sendDataMap[msg.header.seq];
        _this.sendDataList.remove(sendDataNode);
    } else {
        _this.logger.error('hsrmr.0 no found seq=' + msg.header.seq);
    }
    _this.logger.debug("hsrmr.0 call success");
}

/*
 *    "hpcm.0": "ZegoClient.handlePushCustomMsg",
 */
function handlePushCustomMsg(_this, msg) {
    var submsg = JSON.parse(msg.body.custommsg);
    _this.logger.debug("hpcm.0 submsg=", submsg);
    _this.onRecvCustomCommand(submsg.from_userid, submsg.from_username, submsg.custom_content);
}

/*
 *    "hprm.0": "ZegoClient.handlePushRoomMsg",
 */
function handlePushRoomMsg(_this, msg) {
    _this.onRecvRoomMsg(msg.body.chat_data, msg.body.server_msg_id, msg.body.ret_msg_id);
}


/*
 *    "hfus.0": "ZegoClient.handleFullUpdateStream",
 */
function handleFullUpdateStream(_this, serverStreamSeq, serverStreamList) {
    _this.logger.debug("hfus.0 call");
    _this.streamSeq = serverStreamSeq;
    _this.logger.debug("hfus.0 server seq " + _this.streamSeq);

    mergeStreamList(_this, _this.streamList, serverStreamList, function (addStreamList, delStreamList, updateStreamList) {
        if (addStreamList.length !== 0) {
            _this.logger.debug("hfus.0 callback addstream");
            _this.onStreamUpdated(ENUM_STREAM_UPDATE_TYPE.added, makeCallbackStreamList(addStreamList));
        }
        if (delStreamList.length !== 0) {
            _this.logger.debug("hfus.0 callback delstream");
            _this.onStreamUpdated(ENUM_STREAM_UPDATE_TYPE.deleted, makeCallbackStreamList(delStreamList));
        }
        if (updateStreamList.length !== 0) {
            _this.logger.debug("hfus.0 callback updatestream");
            _this.onStreamExtraInfoUpdated(makeCallbackStreamList(updateStreamList));
        }
    });

    _this.logger.debug("hfus.0 call success");
}

/*
 *    "msl.0": "ZegoClient.mergeStreamList",
 */
function mergeStreamList(_this, oldStreamList, newStreamList, callbackResult) {
    _this.logger.debug("msl.0 call");
    var addStreamList = [];
    var delStreamList = [];
    var updateStreamList = [];
    var flag;

    for (var i = 0; i < newStreamList.length; i++) {
        if (newStreamList[i].anchor_id_name == _this.idName) {
            _this.logger.debug("msl.0 have self stream added");
            continue;
        }
        flag = false;
        for (var j = 0; j < oldStreamList.length; j++) {
            if (newStreamList[i].stream_id === oldStreamList[j].stream_id) {
                if (newStreamList[i].extra_info !== oldStreamList[j].extra_info) {
                    updateStreamList.push(newStreamList[i]);
                }
                flag = true;
                break;
            }
        }
        if (!flag) {
            addStreamList.push(newStreamList[i]);
        }
    }

    for (var k = 0; k < oldStreamList.length; k++) {
        flag = false;
        for (var n = 0; n < newStreamList.length; n++) {
            if (newStreamList[n].anchor_id_name == _this.idName) {
                _this.logger.debug("msl.0 have self stream deleted");
                continue;
            }

            if (oldStreamList[k].stream_id === newStreamList[n].stream_id) {
                flag = true;
                break;
            }
        }
        if (!flag) {
            delStreamList.push(oldStreamList[k]);
        }
    }

    oldStreamList = newStreamList;
    callbackResult(addStreamList, delStreamList, updateStreamList);
    _this.logger.debug("msl.0 call success");
}

function makeCallbackStreamList(streamList) {
    var callbackStreamList = [];
    if (streamList != undefined && streamList != null) {
        for (var i = 0; i < streamList.length; i++) {
            callbackStreamList.push({
                anchor_id_name: streamList[i].anchor_id_name,
                stream_gid: streamList[i].stream_gid,
                anchor_nick_name: streamList[i].anchor_nick_name,
                extra_info: streamList[i].extra_info,
                stream_id: streamList[i].stream_id,
            });

        }
    }

    return callbackStreamList;
}

/*
 *    "hfslr.0": "ZegoClient.handleAddedStreamList",
 */
function handleFetchStreamListRsp(_this, msg) {
    _this.logger.debug("hfslr.0 call");
    _this.streamQuerying = false;
    if (msg.body.err_code !== 0) {
        _this.logger.info("hfslr.0 server error=", msg.body.err_code);
        return;
    }

    if (_this.streamSeq === msg.body.stream_seq) {
        _this.logger.info("hfslr.0 same seq");
        return;
    }

    handleFullUpdateStream(_this, msg.body.stream_seq, msg.body.stream_info);
    _this.logger.debug("hfslr.0 call success");
}

/*
 *    "hasl.0": "ZegoClient.handleAddedStreamList",
 */
function handleAddedStreamList(_this, streamList) {
    _this.logger.debug("hasl.0 call");
    var addStreamList = [];
    var flag;
    for (var i = 0; i < streamList.length; i++) {
        if (streamList[i].anchor_id_name == _this.idName) {
            _this.logger.debug("hdsl.0 have self stream added");
            continue;
        }

        flag = false;
        for (var j = 0; j < _this.streamList.length; j++) {
            if (streamList[i].stream_id === _this.streamList[j].stream_id) {
                flag = true;
                break;
            }
        }
        if (!flag) {
            addStreamList.push(streamList[i]);
        }
    }

    if (addStreamList.length !== 0) {
        _this.logger.debug("hasl.0 callback addstream");
        // _this.streamList.concat(addStreamList);
        for (var k = 0; k < addStreamList.length; k++) {
            _this.streamList.push(addStreamList[k]);
        }
        _this.onStreamUpdated(ENUM_STREAM_UPDATE_TYPE.added, makeCallbackStreamList(addStreamList));
    }
    _this.logger.debug("hasl.0 call success");
}

/*
 *    "hdsl.0": "ZegoClient.handleDeletedStreamList",
 */
function handleDeletedStreamList(_this, streamList) {
    _this.logger.debug("hdsl.0 call");
    var delStreamList = [];
    for (var i = 0; i < streamList.length; i++) {
        if (streamList[i].anchor_id_name == _this.idName) {
            _this.logger.debug("hdsl.0 have self stream deleted");
            continue;
        }
        for (var j = _this.streamList.length - 1; j >= 0; j--) {
            if (streamList[i].stream_id === _this.streamList[j].stream_id) {
                _this.streamList.splice(j, 1);
                delStreamList.push(streamList[i]);
                break;
            }
        }
    }

    if (delStreamList.length !== 0) {
        _this.logger.debug("hdsl.0 callback delstream");
        _this.onStreamUpdated(ENUM_STREAM_UPDATE_TYPE.deleted, makeCallbackStreamList(delStreamList));
    }
    _this.logger.debug("hdsl.0 call");
}

/*
 *    "husl.0": "ZegoClient.handleUpdatedStreamList",
 */
function handleUpdatedStreamList(_this, streamList) {
    _this.logger.debug("husl.0 call");
    var updateStreamList = [];
    for (var i = 0; i < streamList.length; i++) {
        if (streamList[i].anchor_id_name == _this.idName) {
            _this.logger.debug("hsul.0 have self stream updated");
            continue;
        }
        for (var j = 0; j < _this.streamList.length; j++) {
            if (streamList[i].stream_id === _this.streamList[j].stream_id) {
                if (streamList[i].extra_info !== _this.streamList[j].extra_info) {
                    _this.streamList[j] = streamList[i];
                    updateStreamList.push(streamList[i]);
                }
                break;
            }
        }
    }

    if (updateStreamList.length !== 0) {
        _this.logger.debug("husl.0 callback updatestream");
        _this.onStreamExtraInfoUpdated(makeCallbackStreamList(updateStreamList));
    }
    _this.logger.debug("husl.0 call success");
}

/*
 *    "hpsum.0": "ZegoClient.handlePushStreamUpdateMsg",
 */
function handlePushStreamUpdateMsg(_this, msg) {
    _this.logger.debug("hpsum.0 call");
    if (!msg.body.stream_info || msg.body.stream_info.length === 0) {
        _this.logger.info("hpsum.0, emtpy list");
        return;
    }

    if (msg.body.stream_info.length + _this.streamSeq !== msg.body.stream_seq) {
        _this.logger.info("hpsum.0 call updatestream");
        fetchStreamList(_this);
        return;
    }

    _this.streamSeq = msg.body.stream_seq;
    switch (msg.body.stream_cmd) {
    case ENUM_STREAM_UPDATE_CMD.added:
        handleAddedStreamList(_this, msg.body.stream_info);
        break;
    case ENUM_STREAM_UPDATE_CMD.deleted:
        handleDeletedStreamList(_this, msg.body.stream_info);
        break;
    case ENUM_STREAM_UPDATE_CMD.updated:
        handleUpdatedStreamList(_this, msg.body.stream_info);
        break;
    }
    _this.logger.debug("hpsum.0 call success");
}

/*
 *    "hpk.0": "ZegoClient.handlePushKickout",
 */
function handlePushKickout(_this, msg) {
    _this.logger.info("hpk.0 call");
    setRunState(_this, ENUM_RUN_STATE.logout);
    resetRoom(_this);

    var err = {
        "code": sdkErrorList.KICK_OUT.code,
        "msg": sdkErrorList.KICK_OUT.msg + msg.body.reason
    };
    _this.onKickOut(err);
    _this.logger.debug("hpk.0 call success");
}

/*
 *    "hpus.0": "ZegoClient.handlePushUserStateUpdate"
 */
function handlePushUserStateUpdateMsg(_this, msg) {
    _this.logger.debug("hpus.0 call");
    if (_this.runState != ENUM_RUN_STATE.login) {
        _this.logger.info("hpus.0 not login");
        return;
    }

    if (!_this.userStateUpdate) {
        _this.logger.info("hpus.0 no userStateUpdate flag");
        return;
    }

    if (_this.userSeq + msg.body.user_actions.length !== msg.body.user_list_seq) {
        _this.logger.info("hpus.0 fetch new userlist " + _this.userSeq, +" server " + msg.body.user_list_seq);
        fetchUserList(_this);
        return;
    }

    _this.userSeq = msg.body.user_list_seq;
    _this.logger.debug("hpus.0 push userSeq " + _this.userSeq);

    var user_list = [];
    for (var i = 0; i < msg.body.user_actions.length; i++) {
        var user_info = {
            "action": msg.body.user_actions[i].Action,
            "idName": msg.body.user_actions[i].IdName,
            "nickName": msg.body.user_actions[i].NickName,
            "role": msg.body.user_actions[i].Role,
            "loginTime": msg.body.user_actions[i].LoginTime
        };

        user_list.push(user_info);
    }

    _this.onUserStateUpdate(msg.body.room_id, user_list);
    _this.logger.debug("hpus.0 call success");
}

/*
 *    "hfulr.0": "ZegoClient.handleFetchUserListRsp"
 */
function handleFetchUserListRsp(_this, msg) {
    _this.logger.debug("hfulr.0 call");
    if (msg.body.err_code != 0) {
        _this.userQuerying = false;
        _this.logger.info("hfulr.0 fetch error " + msg.body.err_code);
        return;
    }

    //set userseq
    if (!_this.userStateUpdate) {
        return;
    }

    _this.userTempList.push.apply(_this.userTempList, msg.body.user_baseinfos);

    // _this.logger.debug("hfulr.0 server user_list " + msg.body.user_baseinfos);

    var currentIndex = msg.body.ret_user_index;
    var serverIndex = msg.body.server_user_index;
    if (currentIndex != serverIndex) {
        _this.logger.info("hfulr.0 fetch another page");
        fetchUserListWithPage(currentIndex + 1);
        return;
    }

    _this.userSeq = msg.body.server_user_seq;
    _this.logger.info("hfulr.0 set user Seq " + _this.userSeq);

    var user_list = [];
    for (var i = 0; i < _this.userTempList.length; i++) {
        var user_info = {
            "idName": _this.userTempList[i].id_name,
            "nickName": _this.userTempList[i].nick_name,
            "role": _this.userTempList[i].role
        };

        user_list.push(user_info);
    }

    _this.userQuerying = false;
    _this.onGetTotalUserList(_this.roomid, user_list);
    _this.userTempList = [];

    _this.logger.debug("hfulr.0 call success user_list " + user_list + " count " + user_list.length);
}

/*
 *    "hpsm.0": "ZegoClient.handlePushSignalMsg",
 */
// 连麦信令push
function handlePushSignalMsg(_this, msg) {
    if (_this.runState != ENUM_RUN_STATE.login) {
        _this.logger.info("hpcm.0 not login");
        return;
    }

    var signalMsg = JSON.parse(msg.body.signal_msg);
    _this.logger.debug("hpcm.0 submsg= ", signalMsg);
    switch (msg.body.sub_cmd) {
    case ENUM_PUSH_SIGNAL_SUB_CMD.pushJoinLiveRequest:
        handlePushJoinLiveRequestMsg(_this, signalMsg);
        break;
    case ENUM_PUSH_SIGNAL_SUB_CMD.pushJoinLiveResult:
        handlePushJoinLiveResultMsg(_this, signalMsg);
        break;
    case ENUM_PUSH_SIGNAL_SUB_CMD.pushJoinLiveInvite:
        handlePushJoinLiveInviteMsg(_this, signalMsg);
        break;
    case ENUM_PUSH_SIGNAL_SUB_CMD.pushJoinLiveStop:
        handlePushJoinLiveStopMsg(_this, signalMsg);
    }
    _this.logger.debug("hpsm.0 call end");
}


/*
 *    "hpjlrm.0": "ZegoClient.handlePushJoinLiveRequestMsg",
 */
// 请求连麦push
function handlePushJoinLiveRequestMsg(_this, signalMsg) {
    var requestId = signalMsg.request_id;
    if (typeof requestId !== "string") {
        _this.logger.error("hpjlrm.0 no requestId");
        return;
    }

    var dest_id_name = signalMsg.from_userid;
    if (typeof dest_id_name !== "string") {
        _this.logger.error("hpjlrm.0 no from user");
        return;
    }
    _this.joinLiveRequestMap[requestId] = dest_id_name;

    _this.logger.info("hpjlrm.0 onRecvJoinLiveRequest " + dest_id_name);
    _this.onRecvJoinLiveRequest(requestId, signalMsg.from_userid, signalMsg.from_username, signalMsg.room_id);
}

/*
 *    "hpjlim.0": "ZegoClient.handlePushJoinLiveInviteMsg",
 */
function handlePushJoinLiveInviteMsg(_this, signalMsg) {
    var requestId = signalMsg.request_id;
    if (typeof requestId !== "string") {
        _this.logger.error("hpjlim.0 no requestId");
        return;
    }

    var dest_id_name = signalMsg.from_userid;
    if (typeof dest_id_name !== "string") {
        _this.logger.error("hpjlim.0 no from user");
        return;
    }

    _this.joinLiveRequestMap[requestId] = dest_id_name;

    _this.logger.info("hpjlim.0 onRecvInviteJoinLiveRequest " + dest_id_name);
    _this.onRecvInviteJoinLiveRequest(requestId, signalMsg.from_userid, signalMsg.from_username, signalMsg.room_id);
}

/*
 *    "hpjlrm.0": "ZegoClient.handlePushJoinLiveResultMsg",
 */
function handlePushJoinLiveResultMsg(_this, signalMsg) {
    var requestId = signalMsg.request_id;
    if (typeof requestId !== "string") {
        _this.logger.error("hpjlrm.0 no requestId");
        return;
    }

    var result = signalMsg.result;
    if (result == undefined) {
        _this.logger.info("hpjlrm.0 no result");
        return;
    }

    var respondResult = result == 1 ? true : false;
    if (_this.joinLiveCallbackMap[requestId]) {
        var result_callback = _this.joinLiveCallbackMap[requestId];
        if (!result_callback) {
            _this.logger.info("hpjlrm.o no callback");
            return;
        }

        _this.logger.info("hpjlrm.0 joinLiveRequest/invite result " + respondResult);
        delete _this.joinLiveCallbackMap[requestId];
        result_callback(respondResult, signalMsg.from_userid, signalMsg.from_username);
    }
}

/*
 *    "hpjlsm.0": "ZegoClient.handlePushJoinLiveStopMsg",
 */
function handlePushJoinLiveStopMsg(_this, signalMsg) {
    var requestId = signalMsg.request_id;
    if (typeof requestId !== "string") {
        _this.logger.error("hpjlsm.0 no requestId");
        return;
    }

    _this.logger.info("hpjlsm.0 onRecvEndJoinLiveCommand " + signalMsg.from_userid);
    _this.onRecvEndJoinLiveCommand(requestId, signalMsg.from_userid, signalMsg.from_username, signalMsg.room_id);
}

/*
 *    "hsur.0": "ZegoClient.handleStreamUpdateRsp",
 */
//流更新回包
function handleStreamUpdateRsp(_this, msg) {
    if (_this.runState != ENUM_RUN_STATE.login) {
        _this.logger.info("hsur.0 not login");
        return;
    }

    if (msg.body.err_code != 0) {
        _this.logger.info("hsur.0 stream update error " + msg.body.err_code);
        return;
    }

    _this.logger.debug("hsur.0 stream seq " + _this.streamSeq + " server seq " + msg.body.stream_seq);
    _this.streamSeq = msg.body.stream_seq;

    //流删除时，publishStreamList已经删除了
    for (var i = 0; i < msg.body.stream_info.length; i++) {
        var streamid = msg.body.stream_info[i].stream_id;
        if (!_this.publishStreamList[streamid]) {
            _this.logger.info("hsur.0 stream is not exist");
            return;
        }

        if (_this.publishStreamList[streamid].state == ENUM_PUBLISH_STREAM_STATE.update_info) {
            _this.publishStreamList[streamid].state = ENUM_PUBLISH_STREAM_STATE.publishing;
            _this.onPublishStateUpdate(0, streamid, 0);
        }
    }

}

/*
 *    "htr.0": "ZegoClient.handleTransRsp",
 */
//trans回包
function handleTransRsp(_this, msg) {
    if (_this.runState != ENUM_RUN_STATE.login) {
        _this.logger.info("htr.0 not login");
        return;
    }

    if (msg.body.err_code != 0) {
        _this.logger.info("htr.0 trans send error " + msg.body.err_code);
        return;
    }

    var type = msg.body.trans_type;
    if (!_this.transSeqMap[type]) {
        _this.logger.info("htr.0 cannot match send info");
        return;
    }

    //update seq
    _this.transSeqMap[type].seq = msg.body.trans_seq;
    _this.logger.debug("htr.0 trans " + type + " seq " + msg.body.trans_seq);
}

/*
 *    "hftr.0": "ZegoClient.handleTransRsp",
 */
//fetch trans 回包
function handleFetchTransRsp(_this, msg) {
    if (_this.runState != ENUM_RUN_STATE.login) {
        _this.logger.info("hftr.0 not login");
        return;
    }

    if (msg.body.err_code != 0) {
        _this.logger.info("hftr.0 trans send error " + msg.body.err_code);
        return;
    }

    var type = msg.body.trans_type;
    var seq = msg.body.trans_seq;
    if (!_this.transSeqMap[type]) {
        _this.transSeqMap[type] = {
            seq: seq
        };
    } else {
        _this.transSeqMap[type].seq = seq;
    }

    if (msg.body.trans_user_idname != _this.idName) {
        _this.onRecvReliableMessage(type, seq, msg.body.trans_data);
    }

    _this.logger.debug("hftr.0 trans " + type + " seq " + seq);
}

/*
 *    "hptr.0": "ZegoClient.handleTransRsp",
 */
//trans push
function handlePushTransMsg(_this, msg) {
    if (_this.runState != ENUM_RUN_STATE.login) {
        _this.logger.info("hptr.0 not login");
        return;
    }

    var type = msg.body.trans_type;
    var seq = msg.body.trans_seq;
    if (!_this.transSeqMap[type]) {
        _this.transSeqMap[type] = {
            seq: seq
        };
    } else {
        _this.transSeqMap[type].seq = seq;
    }

    if (msg.body.trans_user_idname != _this.idName) {
        _this.onRecvReliableMessage(type, seq, msg.body.trans_data);
    } else {
        _this.logger.debug("hptr.0 receive self trans message");
    }
    _this.logger.debug("hptr.0 trans " + type + " seq " + seq);
}

/*
 *    "hpmm.0": "ZegoClient.handlePushMergeMsg",
 */
//bigIm push
function handlePushMergeMsg(_this, msg) {
    if (_this.runState != ENUM_RUN_STATE.login) {
        _this.logger.info("hpmm.0 not login");
        return;
    }

    for (var i = 0; i < msg.body.messages.length; i++) {
        if (msg.body.messages[i].sub_cmd === 14001) {
            handlePushBigRooMsg(_this, msg.body.messages[i].msg_body);
        }
    }

    _this.logger.debug("hpmm.0 call success");
}

/*
 *    "hpbrm.0": "ZegoClient.handlePushBigRooMsg",
 */
function handlePushBigRooMsg(_this, bodyString) {

    //messageBody json
    try {
        var messageBody = JSON.parse(bodyString);
    } catch (e) {
        _this.logger.warn("hpbrm.0 parse json error");
        return;
    }

    if (messageBody == undefined) {
        _this.logger.warn("hpbrm.0 cann't find message body");
        return;
    }

    var roomId = messageBody.room_id;
    var pushData = [];
    for (var i = 0; i < messageBody.msg_data.length; i++) {
        var message = messageBody.msg_data[i];
        var idName = message.id_name;
        if (idName == _this.idName) {
            _this.logger.debug("hpbrm.0 self message");
            continue;
        }
        pushData.push({
            idName: message.id_name,
            nickName: message.nick_name,
            messageId: message.bigmsg_id,
            category: message.msg_category,
            type: message.msg_type,
            content: message.msg_content,
            time: message.send_time
        });
    }

    if (pushData.length == 0) {
        _this.logger.debug("hpbrm.0 no other pushData except self");
    } else {
        _this.onRecvBigRoomMessage(pushData, roomId);
    }

    _this.logger.debug("hpbrm.0 call success");
}

/*
 *    "hbmr.0": "ZegoClient.handleTransRsp",
 */
//bigIm rsp
function handleBigImMsgRsp(_this, msg) {
    if (_this.runState != ENUM_RUN_STATE.login) {
        _this.logger.info("hbmr.0 not login");
        return;
    }

    if (_this.bigimTimeWindow != msg.body.bigim_time_window) {
        _this.bigimTimeWindow = msg.body.bigim_time_window;
    }

    for (var i = 0; i < msg.body.msgs.length; i++) {
        var clientId = msg.body.msgs[i].bigmsg_client_id;
        var msgId = msg.body.msgs[i].bigmsg_id;
        if (_this.bigImCallbackMap[clientId]) {
            var success = _this.bigImCallbackMap[clientId].success;
            if (success != null) {
                success(msg.header.seq, msgId);
            }

            delete _this.bigImCallbackMap[clientId];
        }
    }
}


/*
 *    "ws.bwsh.0": "ZegoClient.bindWebSocketHandler",
 *    "ws.oc.0": "ZegoClient.onClose",
 *    "ws.oe.0": "ZegoClient.onError",
 */
// 处理服务端返回的数据，并抛出给用户
function bindWebSocketHandler(_this) {
    _this.websocket.onmessage = function (e) {

        var msg = JSON.parse(e.data);
        _this.logger.debug("jsonmsg= ", msg.header.cmd);

        if (msg.header.cmd === 'login') {
            handleLoginRsp(_this, msg);
            return;
        }


        if (msg.header.appid !== _this.appid ||
            msg.header.session_id !== _this.sessionid ||
            msg.header.user_id !== _this.userid ||
            msg.header.room_id !== _this.roomid ||
            _this.runState !== ENUM_RUN_STATE.login) {
            _this.logger.info("ws.bwsh.0 check session fail.");
            return;
        }

        //检查消息回包
        handleSendCommandMsgRsp(_this, msg);

        switch (msg.header.cmd) {
        case 'hb':
            handleHeartbeatRsp(_this, msg);
            break;
        case 'logout':
            handleLogoutRsp(_this, msg);
            break;
        case 'custommsg':
            handleSendCustomMsgRsp(_this, msg);
            break;
        case 'stream_info':
            handleFetchStreamListRsp(_this, msg);
            break;
        case 'push_custommsg':
            handlePushCustomMsg(_this, msg);
            break;
        case 'push_stream_update':
            handlePushStreamUpdateMsg(_this, msg);
            break;
        case 'push_kickout':
            handlePushKickout(_this, msg);
            break;
        case 'stream_url':
            if (BUILD_WX) {
                handleFetchStreamUrlRsp(_this, msg);
            }
            break;
        case 'stream_publish':
            if (BUILD_WX) {
                handleFetchStreamPublishUrlRsp(_this, msg);
            }
            break;
        case 'webrtc_url':
            if (BUILD_WEBRTC) {
                handleFetchWebRtcUrlRsp(_this, msg);
            }
            break;
        case 'im_chat':
            handleSendRoomMsgRsp(_this, msg);
            break;
        case 'push_im_chat':
            handlePushRoomMsg(_this, msg);
            break;
        case 'push_userlist_update':
            handlePushUserStateUpdateMsg(_this, msg);
            break;
        case 'user_list':
            handleFetchUserListRsp(_this, msg);
            break;
        case 'push_signal':
            handlePushSignalMsg(_this, msg);
            break;
        case 'stream':
            handleStreamUpdateRsp(_this, msg);
            break;
        case 'trans':
            handleTransRsp(_this, msg);
            break;
        case 'trans_fetch':
            handleFetchTransRsp(_this, msg);
            break;
        case 'push_trans':
            handlePushTransMsg(_this, msg);
            break;
        case 'push_merge_message':
            handlePushMergeMsg(_this, msg);
            break;
        }
    };

    /*
       "ws.oc.0":onclose
    */
    _this.websocket.onclose = function (e) {
        _this.logger.info("ws.oc.0 msg=" + JSON.stringify(e));
        if (_this.runState !== ENUM_RUN_STATE.logout) {
            if (_this.runState === ENUM_RUN_STATE.trylogin &&
                _this.tryLoginCount <= MAX_TRY_LOGIN_COUNT) {
                //trylogin --> trylogin
                _this.logger.info("ws.oc.0 is called because of try login");
            } else if (_this.runState === ENUM_RUN_STATE.login) {
                //login --> trylogin
                _this.logger.info("ws.oc.0 is called because of network broken, try again");
                setRunState(_this, ENUM_RUN_STATE.trylogin);
                resetTryLogin(_this);
                tryLogin(_this);
            } else {
                //unknown
                _this.logger.info("ws.oc.0 out of think!!!");
                setRunState(_this, ENUM_RUN_STATE.logout);
                resetRoom(_this);
                _this.onDisconnect(sdkErrorList.UNKNOWN);
            }

        } else {
            //* --> logout
            _this.logger.info("ws.oc.0 onclose logout flow call websocket.close");
        }
    };

    /*
       "ws.oe.0":onerror
    */
    // websocket发生错误
    _this.websocket.onerror = function (e) {
        _this.logger.info("ws.oe.0 msg=" + JSON.stringify(e));
    };
}

// 客户调用的notify函数
var registerNotifyList = [
    'onDisconnect',
    'onKickOut',
    'onRecvCustomCommand',
    'onStreamUpdated',
    'onStreamExtraInfoUpdated',
    'onPlayStateUpdate',
    'onRecvRoomMsg',
    'onUserStateUpdate',
    'onGetTotalUserList',
    'onPublishStateUpdate',
    'onRecvJoinLiveRequest',
    'onRecvInviteJoinLiveRequest',
    'onRecvEndJoinLiveCommand',
    'onStreamUrlUpdate',
    'onGetAnchorInfo',
    'onPublishQualityUpdate',
    'onPlayQualityUpdate',
    'onRecvReliableMessage',
    'onRecvBigRoomMessage',
    'onVideoSizeChanged',
    'onUpdateOnlineCount'
];


for (var i = 0; i < registerNotifyList.length; i++) {
    ZegoClient.prototype[registerNotifyList[i]] = function () {};
}
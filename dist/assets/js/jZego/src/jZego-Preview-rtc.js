/**
 * ZegoPreview
 */

import "./adapter.js";

var ENUM_RESOLUTION_TYPE = {
    LOW: {
        width: 240,
        height: 320,
        frameRate: 15,
        bitRate: 300
    },
    MEDIUM: {
        width: 480,
        height: 640,
        frameRate: 15,
        bitRate: 800
    },
    HIGH: {
        width: 720,
        height: 1280,
        frameRate: 20,
        bitRate: 1500
    }
};

export default function ZegoPreview(logger) {
    this.logger = logger;

    this.localVideo = null;
    this.localStream = null;
    this.videoInfo = {};
}

ZegoPreview.enumDevices = function (devicesList, error) {
    if (navigator.mediaDevices === undefined || 
        navigator.mediaDevices.enumerateDevices === undefined) {
        if (error) {
            error("browser don't support enumerate devices");
        }
        return;
    }
    
    navigator.mediaDevices.enumerateDevices().then(function(deviceInfos) {
        var microphone = [];
        var speaker = [];
        var camera = [];

        for (var i = 0; i < deviceInfos.length; i++) {
            var deviceInfo = deviceInfos[i];
            if (deviceInfo.kind === 'audioinput') {
                microphone.push({
                    label: deviceInfo.label,
                    deviceId: deviceInfo.deviceId
                });
            }
            if (deviceInfo.kind === 'audiooutput') {
                speaker.push({
                    label: deviceInfo.label,
                    deviceId: deviceInfo.deviceId
                });
            }
            if (deviceInfo.kind === 'videoinput') {
                camera.push({
                    label: deviceInfo.label,
                    deviceId: deviceInfo.deviceId
                });
            }
        }

        if (devicesList) {
            devicesList({
                microphones: microphone,
                speakers: speaker,
                cameras: camera
            });
        }
        
    }).catch(function(err) {
        if (error) {
            error(err);
        }
    });
};

/*
 *    "zp.gmsc.2": "ZegoPreview.getMediaStreamConstraints"
 */
function getMediaStreamConstraints(_this, mediaStreamConfig) {
    var mediaStreamConstraints = {};

    //audio
    if (mediaStreamConfig.audio === true) {
        if (mediaStreamConfig.audioInput != undefined) {
            mediaStreamConstraints.audio = {
                deviceId: {
                    exact: mediaStreamConfig.audioInput
                }
            };
        }
        else {
            mediaStreamConstraints.audio = true;
        }
    }

    //video
    if (mediaStreamConfig.video === true) {
        var width = 640;
        var height = 480;
        var frameRate = 15;
        var bitRate = 800;

        //videoQuality
        //1 QVGA
        if (mediaStreamConfig.videoQuality === 1) {
            width = ENUM_RESOLUTION_TYPE.LOW.width;
            height = ENUM_RESOLUTION_TYPE.LOW.height;
            frameRate = ENUM_RESOLUTION_TYPE.LOW.frameRate;
            bitRate = ENUM_RESOLUTION_TYPE.LOW.bitRate;
        }
        //2 VGA
        else if (mediaStreamConfig.videoQuality === 2) {
            width = ENUM_RESOLUTION_TYPE.MEDIUM.width;
            height = ENUM_RESOLUTION_TYPE.MEDIUM.height;
            frameRate = ENUM_RESOLUTION_TYPE.MEDIUM.frameRate;
            bitRate = ENUM_RESOLUTION_TYPE.MEDIUM.bitRate;
        }
        //3 HD
        else if (mediaStreamConfig.videoQuality === 3) {
            width = ENUM_RESOLUTION_TYPE.HIGH.width;
            height = ENUM_RESOLUTION_TYPE.HIGH.height;
            frameRate = ENUM_RESOLUTION_TYPE.HIGH.frameRate;
            bitRate = ENUM_RESOLUTION_TYPE.HIGH.bitRate;
        }
        //custom
        else if (mediaStreamConfig.videoQuality === 4){
            width = mediaStreamConfig.width;
            height = mediaStreamConfig.height;
            frameRate = mediaStreamConfig.frameRate;
            bitRate = 800;
        }
        else {
            _this.logger.info("zp.gmsc.2 user default");
        }

        //horizontal
        if (mediaStreamConfig.horizontal === true) {
            var temp = height;
            height = width;
            width = temp;
        }
        
        mediaStreamConstraints.video = {
            width: width,
            height: height,
            frameRate: frameRate,
            bitRate: bitRate
        };

        if (mediaStreamConfig.videoInput != undefined) {
            mediaStreamConstraints.video.deviceId = {
                exact: mediaStreamConfig.videoInput
            };
        }

        _this.logger.info("zp.gmsc.2 width: " + width + " height: " + height + " rate: " + frameRate);
    }

    return mediaStreamConstraints;
}

/*
 *    "zp.sv.2": "ZegoPreview.startPreview"
 */
ZegoPreview.prototype.startPreview = function (localVideo, mediaStreamConfig, successCallback, errorCallback) {
    this.logger.debug("zp.sv.2 called");

    if (navigator.getUserMedia === undefined) {
        if (errorCallback) {
            errorCallback("browser don't support");
        }
        return;
    }

    this.localVideo = localVideo;
    
    if (mediaStreamConfig.externalCapture) {
        var result = captureStream(this, localVideo);
        if (result) {
            if (successCallback) {
                successCallback();
            }
        }
        else {
            if (errorCallback) {
                errorCallback("browser don't support");
            }
        }

        return;
    }
    
    var mediaStreamConstraints = getMediaStreamConstraints(this, mediaStreamConfig);
    this.videoInfo = mediaStreamConstraints.video;

    var _this = this;
    navigator.getUserMedia(mediaStreamConstraints, function(stream) {
        _this.logger.info("zp.sv.2 success");

        if (!_this.localVideo) {
            _this.logger.info("zp.sv.2 no localVideo");
            if (errorCallback) {
                errorCallback("no localVideo");
            }
            return;
        }
        
        _this.localVideo.srcObject = stream;
        _this.localStream = stream;
               
        if (successCallback) {
            successCallback();
        }
    }, function (error) {
        _this.logger.info("zp.sv.2 failed");
        if (errorCallback) {
            errorCallback(error.name);
        }
    });
};
/*
 *    "zp.cs.2": "ZegoPreview.captureStream"
 */
function captureStream(_this, localVideo) {
    if (!localVideo) {
        _this.logger.info("zp.cs.2 no local video");
        return false;
    }

    if (localVideo.captureStream) {
        _this.localStream = localVideo.captureStream();
        _this.logger.debug("zp.cs.2 captureStream");
    }
    else if (localVideo.mozCaptureStream) {
        _this.localStream = localVideo.mozCaptureStream();
        _this.logger.debug("zp.cs.2 mozCaptureStream");
    }
    else{
        _this.logger.info("zp.cs.2 don't support");
        return false;
    }

    _this.videoInfo = {
        width: localVideo.videoWidth,
        height: localVideo.videoHeight,
        frameRate: 0,
        bitRate: 0
    };
    
    return true;
}

/*
 *    "zp.sv.2.1": "ZegoPreview.stopPreview"
 */
ZegoPreview.prototype.stopPreview = function () {
    this.logger.info("zp.sv.2.1 called");

    if (!this.localStream) {
        return;
    }
    
    this.localStream.getTracks().forEach(function(track) {
        track.stop();
    });
    
    this.localStream = null;

    this.localVideo.srcObject = null;
    this.localVideo = null;

    this.videoInfo = {};
};

/*
 *    "zp.em.2": "ZegoPreview.enableMicrophone"
 */
ZegoPreview.prototype.enableMicrophone = function (enable) {
    if (!this.localStream) {
        this.logger.info("zp.em.2 no localStream");
        return false;
    }

    this.localStream.getAudioTracks().forEach(
        function(track) {
            track.enabled = enable;
        }
    );

    this.logger.debug("zp.em.2 call success");
    return true;
};

/*
 *    "zp.ec.2": "ZegoPreview.enableCamera"
 */
ZegoPreview.prototype.enableCamera = function (enable) {
    if (!this.localStream) {
        this.logger.info("zp.ec.2 no localStream");
        return false;
    }

    this.localStream.getVideoTracks().forEach(
        function(track) {
            track.enabled = enable;
        }
    );

    this.logger.debug("zp.ec.2 call success");
    return true;
};

/*
 *    "zp.sad.2": "ZegoPreview.setAudioDestination"
 */
ZegoPreview.prototype.setAudioDestination = function (audioOutput) {
    if (!this.localVideo) {
        this.logger.info("zp.sad.2 no localVideo");
        return false;
    }

    if (this.localVideo.sinkId !== 'undefined') {
        var _this = this;
        this.localVideo.setSinkId(audioOutput).then(function() {
            _this.logger.info("zp.sad.2 success device: " + audioOutput);
            // _this.audioOutput = audioOutput;
        }).catch(function(error) {
            _this.logger.info("zp.sad.2 " + error.name);
        });
        return true;
    }
    else {
        this.logger.error("zp.sad.2 browser does not suppport");
        return false;
    }
};
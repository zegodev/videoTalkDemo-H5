///<reference path="../../../node_modules/ionic-angular/components/alert/alert-controller.d.ts"/>
import {Component, ViewChild, ElementRef, ViewChildren, QueryList} from '@angular/core';
import {AlertController, Content, FabButton, IonicPage, NavController, NavParams} from 'ionic-angular';
import {ConfigProvider} from '../../providers/configProvider';
import {SlidePipe} from "../../util/pipe/slidePipe";
import {LogProvider} from "../../providers/logProvider";
import {LogPage} from "../log/log";

/**
 * Generated class for the DetailPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */
//
// @IonicPage()
const ENUM_STREAM_UPDATE_TYPE = {added: 0, deleted: 1};

@Component({
  selector: 'page-room',
  templateUrl: 'room.html',
})
export class RoomPage {


  roomId: string;
  zg: any;
  loginToken: string;
  loginRoom: boolean;
  useLocalStreamList: Array<any> = [];
  publishStreamId: string;
  isTest: number;
  signUrl: string;

  isSuportMultipCam = false;
  isPublish = true;


  @ViewChild("localVideo")
  localVideo: ElementRef;
  @ViewChildren('subVideo')
  subVideoList: QueryList<ElementRef>;

  constructor(public navCtrl: NavController, public navParams: NavParams, private config: ConfigProvider
    , private slide: SlidePipe, private logger: LogProvider, public alertCtrl: AlertController) {
    this.roomId = this.navParams.get('roomId') || this.config.getParameterByName('roomId');
    this.isTest = this.navParams.get('isTest');
    this.signUrl = this.navParams.get('signUrl');
    this.isPublish = this.navParams.get('isPublish') === false ? false : true;
    this.publishStreamId = this.navParams.get('publishStreamId') || ('s-' + this.config.idName);
    if (!this.roomId) {
      this.logger.warning(`#${this.publishStreamId}#roomId is empty,force to go back`);
      this.logoutRoom();
    }
  }

  ngAfterViewInit() {
    if (typeof ZegoClient !== 'undefined') {
      this.init();
    } else {
      setTimeout(() => {
        this.ngAfterViewInit();
      }, 1000)
    }

  }

  init() {
    this.zg = new ZegoClient();
    this.configZego();
    this.isSuportMultipCam = this.config.videoInputList.length>1? true :  false;
    this.subVideoList.changes.subscribe((list: QueryList<ElementRef>) => {
      if (list.length > 0) {
        let _count = 0;
        list.forEach(el => {
          console.log(el);
          let result;
          // setTimeout(() => {
          if (this.addedVideo.some(item => {
            return el.nativeElement.id == (item.stream_id);
          })) {
            el.nativeElement.muted = (this.offOnVolume === 'md-volume-off');
            result = this.zg.startPlayingStream(el.nativeElement.id, el.nativeElement);


            if (!result) {
              this.alertCtrl.create({title: '哎呀，播放失败啦！'}).present();
              el.nativeElement.style = 'display:none';
              //this.useLocalStreamList.splice(_count, 1);
              // console.error("play " + el.nativeElement.id + " return " + result);
              // result = this.zg.startPlayingStream(el.nativeElement.id, el.nativeElement);
               console.error("play " + el.nativeElement.id + " return " + result);

            }
          }
          //}, 1000 * _count);
          _count++;
        });
        this.addedVideo = [];
      }
    });



    window.onbeforeunload = ()=> {
      console.log("beafore unload");

      if (this.loginRoom) {
        this.leaveRoom();
        this.loginRoom = false;
      }

    };
  }


  /*****
   * 配置sdk
   *
   *
   * */
  configZego() {
    if (this.roomId) {
      let _config = {
        appid: this.config.appId,
        idName: this.config.idName,
        nickName: this.config.nickName,
        server: this.config.server,
        logLevel: this.config.logLevel,
        logUrl: this.config.logUrl,
        remoteLogLevel: 0
      }
      this.logger.info(`#${this.publishStreamId}#config param:${JSON.stringify(_config)}`);
      this.zg.config(_config);
      this.login();
      this.signUrl && this.zg.setCustomSignalUrl(this.signUrl);
    }
  }

  /*****
   * 1 获取token指令
   * 2 登陆sdk，获取拉留信息，并播放，同时预览本地视频，推送本地流
   *
   * */
  login() {
    this.logger.info(`#${this.publishStreamId}#get token start`);
    this.config.getToken().subscribe(result => {
      this.loginToken = result;
      this.logger.info(`#${this.publishStreamId}#get token success:${result}`);
      this.logger.info(`#${this.publishStreamId}#start login`);
      this.zg.login(this.roomId, 2, this.loginToken, streamList => {
        if(streamList.length >= 4) {
          this.alertCtrl.create({title: '房间太拥挤，换一个吧！'}).present();
          this.logoutRoom();
          //window.location.reload();
          return ;
        }
        this.logger.info(`#${this.publishStreamId}#login success`);
        this.loginRoom = true;
        this.listen();
        this.useLocalStreamList = [...this.useLocalStreamList, ...streamList];
        this.addedVideo = [...this.useLocalStreamList];
        //this._useLocalStreamList = this.slide.transform(this.useLocalStreamList, 3);
        this.doPreviewPublish();
      }, (err) => {
        this.logger.errors(`#${this.publishStreamId}login failed:err.msg`);
      });
    }, error => {
      this.logger.errors(`#${this.publishStreamId}#get token failed`);
    })
  }


  /*****
   *
   * 同时预览本地视频，并推送
   *
   * */
  doPreviewPublish() {
    this.logger.info(`#${this.publishStreamId}#start Preview`);
    let _conf = {
      audio: this.config.audio,
        audioInput: this.config.audioInput,
        video: this.config.video,
        videoInput: this.config.videoInput,
        videoQuality: this.config.videoQuality,
        horizontal: this.config.horizontal
    }
    this.logger.info(`#${this.publishStreamId}#  Preview  config ${JSON.stringify(_conf)}`);
    this.zg.startPreview(this.localVideo.nativeElement, _conf, () => {
      this.logger.info(`#${this.publishStreamId}#preview success`);
      this.isPublish && this.zg.startPublishingStream(this.publishStreamId, this.localVideo.nativeElement);
      this.localVideo.nativeElement.muted = !this.config.muted;
      this.config.initEnumDevices();
    }, (error) => {
      this.logger.errors(`#${this.publishStreamId}#Preview  error ${JSON.stringify(error)}`);
      let tipInfo = (error === 'NotAllowedError' ? '请打开允许使用摄像头使用权限' : '浏览器可能不支持，换一个试试吧！');
      this.alertCtrl.create({title: tipInfo}).present();
      this.logoutRoom();
    });
  }



  /**********直播中开关  start*****************/
  offOnCam = 'md-videocam';

  toggleCam() {
    if (this.offOnCam === 'md-videocam') {
      this.offOnCam = 'ios-videocam-outline';
      this.logger.info(`#${this.publishStreamId}#close camera`);
      this.zg.enableCamera(this.localVideo.nativeElement, false);
    } else {
      this.offOnCam = 'md-videocam';
      this.logger.info(`#${this.publishStreamId}#open camera`);
      this.zg.enableCamera(this.localVideo.nativeElement, true);
    }
    ;
  }

  offOnMic = 'md-mic';

  toggleMic() {
    if (this.offOnMic === 'md-mic') {
      this.offOnMic = 'ios-mic-outline';
      this.logger.info(`#${this.publishStreamId}#close micphone`);
      this.zg.enableMicrophone(this.localVideo.nativeElement, false);
    } else {
      this.offOnMic = 'md-mic';
      this.logger.info(`#${this.publishStreamId}#open micphone`);
      this.zg.enableMicrophone(this.localVideo.nativeElement, true);
    }
    ;
  }

  offOnVolume = 'md-volume-up';

  toggleVolume() {
    if (this.offOnVolume === 'md-volume-up') {
      this.offOnVolume = 'md-volume-off';
      this.subVideoList.forEach(item=>{
        item.nativeElement.muted = true;
      });
    } else {
      this.offOnVolume = 'md-volume-up';
      this.subVideoList.forEach(item=>{
        item.nativeElement.muted = false;
      });
    }
    ;
  }

  changeCam ='md-sync';
  changeUseCam() {
    if (this.changeCam === 'md-sync') {
      this.changeCam = 'ios-sync-outline';
    } else {
      this.changeCam = 'md-sync';
    }
    this.logger.info(`#${this.publishStreamId}#change camera`);
    this.zg.stopPreview(this.localVideo.nativeElement);
    this.zg.stopPublishingStream(this.publishStreamId);
    let _config = {
      audio: this.offOnMic === 'md-mic',
      audioInput: this.config.audioInput,
      video: this.offOnCam === 'md-videocam',
      videoInput: this.config.toggleVideo(this.changeCam === 'md-sync'?0:1),
      videoQuality: this.config.videoQuality,
      horizontal: this.config.horizontal
    };
    this.logger.info(`#${this.publishStreamId}#  Preview  config ${JSON.stringify(_config)}`);
    this.zg.startPreview(this.localVideo.nativeElement,_config , () => {
      this.logger.info(`#${this.publishStreamId}#preview success`);
      this.zg.startPublishingStream(this.publishStreamId, this.localVideo.nativeElement);
      this.localVideo.nativeElement.muted = !this.config.muted;

    }, (error) => {
      this.logger.errors(`#${this.publishStreamId}#Preview  error ${JSON.stringify(error)}`);
    });

  }

  /**********直播中开关  end*****************/

  /*****
   *
   * 监听sdk的变化流事件，做出对应的措施
   *
   * */

  addedVideo = [];
  deletedVideo = [];

  listen() {

    let _config = {
      onPlayStateUpdate: (type, streamid, error) => {
        if (type == 0) {
          this.logger.info(`#${streamid}# play  success`);
        }
        else if (type == 2) {
          this.logger.info(`#${streamid}# play retry`);
        }
        else {
          // trace("publish " + streamid + "error " + error.code);
          this.logger.errors(`#${streamid}# play error ${error.msg}`);
        }
      },
      onPublishStateUpdate: (type, streamid, error) => {
        if (type == 0) {
          this.logger.info(`#${streamid}# publish  success`);
        }
        else if (type == 2) {
          this.logger.info(`#${streamid}# publish  retry`);
        }
        else {
          // trace("publish " + streamid + "error " + error.code);
          this.logger.errors(`#${streamid}# publish error ${error.msg}`);
        }
      },
      onPublishQualityUpdate: (streamid, quality) => {
        this.logger.info("#" + streamid + "#" + "publish " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
      },

      onPlayQualityUpdate: (streamid, quality) => {
        this.logger.info("#" + streamid + "#" + "play " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
      },

      onDisconnect: (error) => {
        this.logger.errors("onDisconnect " + JSON.stringify(error));
      },

      onKickOut: (error) => {
        this.logger.errors("onKickOut " + JSON.stringify(error));
      },

      onStreamExtraInfoUpdated: (streamList) => {

      },

      onVideoSizeChanged: (streamid, videoWidth, videoHeight) => {
        this.logger.info("#" + streamid + "#" + "play " + " : " + videoWidth + "x" + videoHeight);
      },

      onStreamUpdated: (type, streamList) => {
        if (type == ENUM_STREAM_UPDATE_TYPE.added) {
          for (var i = 0; i < streamList.length; i++) {
            //this.doPlay(streamList[0].stream_id, this.useLocalStreamList.length + 1);
            this.logger.info(`#${streamList[i].stream_id}# was added`);
            this.useLocalStreamList.push(streamList[i]);
            this.addedVideo.push(streamList[i]);
          }
        } else if (type == ENUM_STREAM_UPDATE_TYPE.deleted) {
          for (var k = 0; k < this.useLocalStreamList.length; k++) {
            for (var j = 0; j < streamList.length; j++) {
              if (this.useLocalStreamList[k].stream_id === streamList[j].stream_id) {
                this.zg.stopPlayingStream(this.useLocalStreamList[k].stream_id);
                this.logger.info(`#${this.useLocalStreamList[k].stream_id}# was deleted `);

                this.useLocalStreamList.splice(k, 1);
                break;
              }
            }
          }
        }
        //this._useLocalStreamList = this.slide.transform(this.useLocalStreamList, 3);
      },
      onUserStateUpdate: (roomId, userList) => {
        this.logger.info("onUserStateUpdate = " + roomId + JSON.stringify(userList));
      }
    }

    for (let key in _config) {
      this.zg[key] = _config[key]
    }
  }

  /**
   * 销毁组建钩子
   */
  ionViewWillUnload() {
    this.logger.info("beafore unload");
    if (this.loginRoom) {
      this.leaveRoom();
      this.loginRoom = false;
    }
  }

  leaveRoom() {
    this.logger.info('leave room  and close stream');
    this.zg.stopPreview(this.localVideo.nativeElement);
    this.zg.stopPublishingStream(this.publishStreamId);
    //this.config.idName = '';
    for (var i = 0; i < this.useLocalStreamList.length; i++) {
      this.zg.stopPlayingStream(this.useLocalStreamList[i].stream_id);
    }
    this.zg.logout();
  }

  logoutRoom() {
    this.logger.info(`#${this.publishStreamId}# logout`);
    if (this.loginRoom) {
      try{
        this.leaveRoom();
      }catch (e) {
         console.error(e);
      }

      this.loginRoom = false;
    }

    if (this.navCtrl.canGoBack()) {
      this.navCtrl.pop();
      //window.location.reload();
    } else {
      this.navCtrl.goToRoot({
        animate: true
      });
      //window.location.reload();
    }
  };

  showLogs() {
    this.navCtrl.push(LogPage);
  }

}

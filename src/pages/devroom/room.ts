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
  selector: 'page-devroom',
  templateUrl: 'room.html',
})
export class DevRoomPage {


  roomId: string;
  zg: any;
  loginToken: string;
  loginRoom: boolean;
  useLocalStreamList: Array<any> = [];
  publishStreamId: string;
  isTest: number;
  signUrl: string;
  pullstreamId:  {stream_id:string}[] = [];

  isSuportMultipCam = false;
  isPublish = true;
  isLogin = true;

  @ViewChild("localVideo")
  localVideo: ElementRef;
  @ViewChildren('subVideo')
  subVideoList: QueryList<ElementRef>;

  status = {};


  /****
   * 初始化
   * ***/
  constructor(public navCtrl: NavController, public navParams: NavParams, private config: ConfigProvider
    , private slide: SlidePipe, private logger: LogProvider, public alertCtrl: AlertController) {
    // 从路由获取参数
    this.roomId = this.navParams.get('roomId') || this.config.getParameterByName('roomId');
    this.isTest = this.navParams.get('isTest');
    this.signUrl = this.navParams.get('signUrl');
    let _pullstreamIds:string = this.navParams.get('pullstreamIds');
    if(_pullstreamIds){
       _pullstreamIds.split(',').forEach(id=>{
         this.pullstreamId.push({stream_id: id})
      });

    }
    this.isPublish = this.navParams.get('isPublish') === false ? false : true;
    this.isLogin = this.navParams.get('isLogin') === false ? false : true;
    this.publishStreamId = this.navParams.get('publishStreamId') || ('s' + this.config.idName);

    if (!this.roomId) {
      this.logger.warning(`#${this.publishStreamId}#roomId is empty,force to go back`);
      this.logoutRoom();
    }
  }

  /****
   * 路由钩子，跳转到改页面自动执行
   * ***/
  ngAfterViewInit() {
    if (typeof ZegoClient !== 'undefined') {
      this.init();
    } else {
      setTimeout(() => {
        this.ngAfterViewInit();
      }, 1000)
    }

  }


  /****
   *  初始化zego sdk
   * ***/
  init() {
    this.zg = new ZegoClient();
    this.configZego();

    //判断是否有多个摄像头
    this.isSuportMultipCam = this.config.videoInputList.length > 1 ? true : false;


    //angular不鼓励直接操作dom,所以这里是通过监听页面vedio的dom变化拿到dom,再对dom进行操作
    this.subVideoList.changes.subscribe((list: QueryList<ElementRef>) => {
      if (list.length > 0) {
        let _count = 0;

        list.forEach(el => {

          let result;
          if (this.addedVideo.some(item => {
            return el.nativeElement.id == (item.stream_id);
          })) {


            el.nativeElement.muted = (this.offOnVolume === 'md-volume-off');


            result = this.zg.startPlayingStream(el.nativeElement.id, el.nativeElement);


            if (!result) {
              this.alertCtrl.create({title: '哎呀，播放失败啦！'}).present();
              el.nativeElement.style = 'display:none';
              console.error("play " + el.nativeElement.id + " return " + result);

            }
          }
          _count++;
        });
        this.addedVideo = [];
      }
    });


    // 暴力关闭浏览器引起的内存未释放
    const isOnIOS = navigator.userAgent.match (/iPad/i) || navigator.userAgent.match (/iPhone/i);
    const eventName = isOnIOS ? "pagehide" : "beforeunload";
    window.addEventListener (eventName, (event) => {
      window.event.cancelBubble = true; // Don't know if this works on iOS but it might!
      console.log ("beafore unload");
      if (this.loginRoom) {
        this.logoutRoom ();
        this.loginRoom = false;
      }
    });
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

      //测试页面相关，自定义拉流
      this.signUrl && this.zg.setCustomSignalUrl(this.signUrl);


       this.login();
    }
  }

  /*****
   * 1 获取token指令
   * 2 登陆sdk，获取拉留信息，并播放，同时预览本地视频，推送本地流
   *
   * */
  login() {

    this.logger.info(`#${this.publishStreamId}#get token start`);

    this.status[this.publishStreamId] = 'logging';
    this.status = {...this.status};

    this.config.getToken().subscribe(result => {

      this.loginToken = result;

      this.logger.info(`#${this.publishStreamId}#get token success:${result}`);
      this.logger.info(`#${this.publishStreamId}#start login`);
      this.zg.login(this.roomId, 2, this.loginToken,streamList=>{

        this.status[this.publishStreamId] = 'login';

        //测试页面相关，自定了拉流id
        if (this.pullstreamId.length>0) {
          streamList = this.pullstreamId;
        }

        //限制房间最多人数
        if (streamList.length >= 4) {
          this.alertCtrl.create({title: '房间太拥挤，换一个吧！'}).present();
          this.logoutRoom();
          //window.location.reload();
          return;
        }

        this.logger.info(`#${this.publishStreamId}#login success`);

        this.loginRoom = true;

        // 监听sdk回掉
        this.listen();

        this.useLocalStreamList = [...this.useLocalStreamList, ...streamList];
        this.addedVideo = [...this.useLocalStreamList];

        //状态
        this.useLocalStreamList.forEach(item => {
          this.status[item.stream_id] = 'pulling'
        });
        this.status = {...this.status};

        //开始预览本地视频
        this.isPublish&&this.doPreviewPublish();
      } , (err) => {
        this.alertCtrl.create({title: `登录失败:${err.msg}`}).present();
        this.logger.errors(`#${this.publishStreamId}login failed:${err.msg}`);
      });
    }, error => {
      this.alertCtrl.create({title: `获取token失败`}).present();
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

      this.status[this.publishStreamId] = 'previewed';
      this.status = {...this.status};

      this.isPublish && this.zg.startPublishingStream(this.publishStreamId, this.localVideo.nativeElement);

      this.localVideo.nativeElement.muted = !this.config.muted;

      let _index = 0;
      this.config.videoInputList && this.config.videoInputList.forEach((item, index) => {
        if (item.deviceId == this.config.videoInput) {
          _index = index
        }
      })
      this.changeCam = (_index === 0 ? 'md-sync' : 'ios-sync-outline');

      //部分浏览器，获取设备名称时为空，只有在调用摄像头后才能获取到摄像头名称，在这里，对摄像头信息进行再次获取
      this.config.initEnumDevices();


    }, (error) => {

      this.logger.errors(`#${this.publishStreamId}#Preview  error ${JSON.stringify(error)}`);
      let tipInfo = (error === 'NotAllowedError' ? '请打开允许使用摄像头使用权限' : '请检查摄像设备是否可用，再试试吧！');
      this.alertCtrl.create({title: `${tipInfo}(${error})`}).present();

      //预览失败，退出
      this.logoutRoom();
    });
  }


  /**********直播中开关  start*****************/

  offOnCam = 'md-videocam';

  /****
   * 开或关闭摄像头
   * ***/
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

  /****
   * 开或关闭麦克风
   * ***/
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

  /****
   * 开或关闭喇叭
   * ***/
  toggleVolume() {
    if (this.offOnVolume === 'md-volume-up') {
      this.offOnVolume = 'md-volume-off';
      this.subVideoList.forEach(item => {
        item.nativeElement.muted = true;
      });
    } else {
      this.offOnVolume = 'md-volume-up';
      this.subVideoList.forEach(item => {
        item.nativeElement.muted = false;
      });
    }
    ;
  }

  changeCam = 'md-sync';

  /****
   * 切换前后摄像头 由于sdk暂不支持直接切换，所以我们这里实际上是先停止预览，再重新配置再预览
   * ***/
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
      videoInput: this.config.toggleVideo(this.changeCam === 'md-sync' ? 0 : 1),
      videoQuality: this.config.videoQuality,
      horizontal: this.config.horizontal
    };

    this.logger.info(`#${this.publishStreamId}#  Preview  config ${JSON.stringify(_config)}`);

    this.zg.startPreview(this.localVideo.nativeElement, _config, () => {

      this.logger.info(`#${this.publishStreamId}#preview success`);

      this.zg.startPublishingStream(this.publishStreamId, this.localVideo.nativeElement);

      this.localVideo.nativeElement.muted = !this.config.muted;

    }, (error) => {
      this.logger.errors(`#${this.publishStreamId}#Preview  error ${JSON.stringify(error)}`);
    });

  }
  
  togglePullStream(){
    const prompt = this.alertCtrl.create({
      title: '',
      message: "请输入拉流ID，多个流用逗号隔开",
      inputs: [
        {
          name: 'pullStreamIds',
          placeholder: 'Title'
        },
      ],
      buttons: [
        {
          text: '取消',
          handler: data => {
            console.log('Cancel clicked');
          }
        },
        {
          text: '确定',
          handler: data => {
            for (let i = 0; i < this.useLocalStreamList.length; i++) {
              this.zg.stopPlayingStream(this.useLocalStreamList[i].stream_id);
            }
            this.useLocalStreamList = [];
            data.pullStreamIds.split(',').forEach(id=>{
              this.useLocalStreamList.push({stream_id: id});
            });
            this.useLocalStreamList = [... this.useLocalStreamList];
            this.addedVideo = [...this.useLocalStreamList];
          }
        }
      ]
    });
    prompt.present();
  
  }

  /**********直播中开关  end*****************/


  /*****
   *
   * 监听sdk的变化流事件，做出对应的措施
   *
   * */

  addedVideo = [];


  /****
   * 绑定监听回掉函数，回掉钩子参见https://www.zego.im/html/document/#Live_Room/API_Instructions:web
   * ***/
  listen() {

    let _config = {
      onPlayStateUpdate: (type, streamid, error) => {
        if (type == 0) {
          this.logger.info(`#${streamid}# play  success`);
          this.status[streamid] = 'play';
        }
        else if (type == 2) {
          this.logger.info(`#${streamid}# play retry`);
        } else {
          // trace("publish " + streamid + "error " + error.code);
          this.status[streamid] = 'play';
          this.status[streamid] = 'play err';
          this.logger.errors(`#${streamid}# play error ${error.msg}`);
          let _msg = error.msg;
          if(error.msg.indexOf('server session closed, reason: ')>-1){
            let code = error.msg.replace('server session closed, reason: ','');
            if(code == 21){
              _msg = '音频编解码不支持(opus)';
            }else if(code == 22){
              _msg = '视频编解码不支持(H264)'
            }else if(code == 20){
              _msg = 'sdp 解释错误';
            }
          }
          this.alertCtrl.create({title: `拉流${streamid}失败，${_msg}`}).present();
        }
        this.status = {...this.status};
      },
      onPublishStateUpdate: (type, streamid, error) => {
        if (type == 0) {
          this.status[streamid] = 'publish suc';
          this.logger.info(`#${streamid}# publish  success`);
        } else if (type == 2) {
          this.logger.info(`#${streamid}# publish  retry`);
        } else {
          // trace("publish " + streamid + "error " + error.code);
          this.status[streamid] = 'publish err';
          this.logger.errors(`#${streamid}# publish error ${error.msg}`);
          let _msg = error.msg;
          if(error.msg.indexOf('server session closed, reason: ')>-1){
             let code = error.msg.replace('server session closed, reason: ','');
             if(code == 21){
               _msg = '音频编解码不支持(opus)';
             }else if(code == 22){
               _msg = '视频编解码不支持(H264)'
             }else if(code == 20){
               _msg = 'sdp 解释错误';
             }
          }
          this.alertCtrl.create({title: `推流${streamid}失败，${_msg}`}).present();
        }
        this.status = {...this.status};
      },
      onPublishQualityUpdate: (streamid, quality) => {
        this.logger.info("#" + streamid + "#" + "publish " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
      },

      onPlayQualityUpdate: (streamid, quality) => {
        this.logger.info("#" + streamid + "#" + "play " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
      },

      onDisconnect: (error) => {
        this.logger.errors("onDisconnect " + JSON.stringify(error));
        this.alertCtrl.create({title: `网络连接已断开：${JSON.stringify(error)}`}).present();
        this.logoutRoom();
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

          this.addedVideo.forEach(item => {
            this.status[item.stream_id] = 'pulling'
          });
          this.status = {...this.status};
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

  /****
   * 退出房间
   * ***/
  leaveRoom() {
    this.logger.info('leave room  and close stream');

    this.zg.stopPreview(this.localVideo.nativeElement);

    this.zg.stopPublishingStream(this.publishStreamId);

    for (var i = 0; i < this.useLocalStreamList.length; i++) {
      this.zg.stopPlayingStream(this.useLocalStreamList[i].stream_id);
    }

    this.zg.logout();
  }

  /****
   *  登出
   * ***/
  logoutRoom() {
    this.logger.info(`#${this.publishStreamId}# logout`);

    if (this.loginRoom) {
      try {
        this.leaveRoom();
      } catch (e) {
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


  /****
   * 打开日志页面
   * ***/
  showLogs() {

    this.navCtrl.push(LogPage);

  }


  identify(index: number, item: { stream_id: string }) {
    return item.stream_id;
  }

}

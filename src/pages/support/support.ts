import {Component, OnInit} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {SettingtPage} from "../setting/setting";
import {LogProvider} from "../../providers/logProvider";
import {Storage} from '@ionic/storage';
import {ConfigProvider} from "../../providers/configProvider";
import {SupportRoomPage} from "../supportRoom/room";

@Component ({
  selector: 'page-support',
  templateUrl: 'support.html'
})
export class SupportPage implements OnInit {
  
  roomId: string = '';
  isPublish: boolean = true;
  isLogin: boolean = false;
  streamId: string = '';
  pullstreamId: string = '';
  signUrl: string = '';
  appId: number;
  
  isPublishAudio = true;
  isPublishVideo = true;
  isPullAudio = true;
  isPullVideo = true;
  
  
  constructor (public navCtrl: NavController, private logger: LogProvider, private config: ConfigProvider,
               private alertCtr: AlertController, private storage: Storage) {
    console.log ('SupportPage start');
    this.appId = this.config.appId;
    
  }
  
  ngOnInit () {
    this.storage.get ('support_setting').then (settings => {
      if (settings) {
        this.appId = settings['appId'];
        this.roomId = settings['roomId'];
        this.isPublish = settings['isPublish'];
        this.isLogin = settings['isLogin'];
        this.streamId = settings['publishStreamId'];
        this.pullstreamId = settings['pullstreamIds'];
        this.signUrl = settings['signUrl'];
        this.isPublishAudio = !!settings['isPublishAudio'];
        this.isPublishVideo = !!settings['isPublishVideo'];
        this.isPullAudio = !!settings['isPullAudio'];
        this.isPullVideo = !!settings['isPullVideo'];
      }
    });
    
  }
  
  /****
   * 跳转到直播间
   * ***/
  openRoom () {
    const param = {
      roomId: this.roomId,
      publishStreamId: this.streamId,
      pullstreamIds: this.pullstreamId,
      isPublish: this.isPublish,
      isLogin: this.isLogin,
      signUrl: this.signUrl,
      isTest: 1,
      appId: this.appId,
      isPublishAudio: this.isPublishAudio,
      isPublishVideo: this.isPublishVideo,
      isPullAudio: this.isPullAudio,
      isPullVideo: this.isPullVideo
    };
    
    if (!this.roomId) {
      this.logger.info ('input roomId is empty!');
      this.alertCtr.create ({title: '请输入房间号'}).present ();
      return;
    }
    if (typeof  (this.appId * 1) !== 'number') {
      this.logger.info ('input appid is not number!');
      this.alertCtr.create ({title: 'appid只能是数字'}).present ();
      return;
    }
    
    this.config.appId = this.appId * 1;
    this.config.server = this.signUrl;
    
    this.storage.set ('support_setting', param).then (() => {
      //if(param.signUrl)param.roomId = 'zego-support' + param.roomId;
      this.navCtrl.push (SupportRoomPage, param, {
          animate: false,
        }
      )
    });
  }
  
  /****
   * 打开设置页面
   * ***/
  openSetting () {
    this.navCtrl.push (SettingtPage, {}, {
      animate: true,
    })
  }
  
  
}

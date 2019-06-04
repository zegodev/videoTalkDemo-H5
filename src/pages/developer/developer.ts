import {Component, OnInit} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {SettingtPage} from "../setting/setting";
import {LogProvider} from "../../providers/logProvider";
import {Storage} from '@ionic/storage';
import {ConfigProvider} from "../../providers/configProvider";
import {DevRoomPage} from "../devroom/room";
import {HistoryPage} from "../history/history";
import {Subscription} from "rxjs/Subscription";

@Component({
  selector: 'page-developer',
  templateUrl: 'developer.html'
})
export class DeveloperPage implements OnInit {

  roomId: string = '';
  isPublish: boolean = true;
  isLogin: boolean = false;
  streamId: string = '';
  pullstreamId: string = '';
  signUrl: string = '';
  authTokenUrl:string = '';
  appNode = '';
  appId:number;
  subscription:Subscription;
  
  isPublishAudio = true;
  isPublishVideo = true;
  isPullAudio = true;
  isPullVideo = true;
  isTestEnv = false;
  
  constructor(public navCtrl: NavController, private logger: LogProvider,private config: ConfigProvider,
              private alertCtr: AlertController, private storage: Storage) {
    this.subscription = this.config.sub.subscribe(appid=>{
      this.appId = appid;
    })
  }

  ngOnInit() {
    this.storage.get('develop_setting').then(settings => {
      if(settings){
        this.roomId = settings['roomId'];
        this.isPublish = settings['isPublish'];
        this.isLogin = settings['isLogin'];
        this.streamId = settings['publishStreamId'];
        this.pullstreamId = settings['pullstreamIds'];
        this.signUrl = settings['signUrl']||'wss://webrtctest.zego.im/ws?a=webrtc-demo';
        this.authTokenUrl = settings['authTokenUrl']||'';
        this.appNode =  settings['appNode']||'';
        this.isPublishAudio = typeof settings['isPublishAudio'] === 'undefined'?true:settings['isPublishAudio'];
        this.isPublishVideo = typeof settings['isPublishVideo'] === 'undefined'?true:settings['isPublishVideo'];
        this.isPullAudio = typeof settings['isPullAudio'] === 'undefined'?true:settings['isPullAudio'];
        this.isPullVideo = typeof settings['isPullVideo'] === 'undefined'?true:settings['isPullVideo'];
        this.isTestEnv = typeof settings['isTestEnv'] === 'undefined'?true:settings['isTestEnv'];
      }else{
        this.signUrl = 'wss://webrtctest.zego.im/ws?a=webrtc-demo';
      }
    });

  }

  /****
   * 跳转到直播间
   * ***/
  openRoom() {
    const param = {
      roomId:  this.roomId,
      publishStreamId: this.streamId,
      pullstreamIds: this.pullstreamId,
      isPublish: this.isPublish,
      isLogin:this.isLogin,
      signUrl: this.signUrl,
      isTest: 1,
      isPublishAudio: this.isPublishAudio,
      isPublishVideo: this.isPublishVideo,
      isPullAudio: this.isPullAudio,
      isPullVideo: this.isPullVideo,
      authTokenUrl:this.authTokenUrl,
      appNode:this.appNode,
      isTestEnv:this.isTestEnv,
    };
    this.roomId = this.roomId&&this.roomId.replace(/^\s+|\s+$/gm,'');
    if (!this.roomId) {
      this.logger.info('input roomId is empty!');
      this.alertCtr.create({title: '请输入房间号'}).present();
      return;
    }
    if( typeof  (this.appId*1) !== 'number'){
      this.logger.info('input appid is not number!');
      this.alertCtr.create({title: 'appid只能是数字'}).present();
      return;
    }
  
    if(this.signUrl&&this.signUrl.indexOf('wss')<0){
      this.logger.info('signUrl   is not correct!');
      this.alertCtr.create({title: 'signUrl必须是wss开头'}).present();
      return;
    }
    this.config.appId = this.appId*1;
    
    this.storage.set('develop_setting', param).then(() => {
      if(param.signUrl)param.roomId = 'zego-developement' + param.roomId;
      this.navCtrl.push(DevRoomPage, param, {
          animate: false,
        }
      )
    });
  }

  /****
   * 打开设置页面
   * ***/
  openSetting() {
    this.navCtrl.push(SettingtPage, {}, {
      animate: true,
    })
  }
  
  openHistory() {
    this.navCtrl.push(HistoryPage, {}, {
      animate: true,
    })
  }


}

import {Component, OnInit} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {SettingtPage} from "../setting/setting";
import {LogProvider} from "../../providers/logProvider";
import {Storage} from '@ionic/storage';
import {ConfigProvider} from "../../providers/configProvider";
import {DevRoomPage} from "../devroom/room";

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
  appId:number;


  constructor(public navCtrl: NavController, private logger: LogProvider,private config: ConfigProvider,
              private alertCtr: AlertController, private storage: Storage) {
    console.log('DeveloperPage start');
    this.appId = this.config.appId;
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
      isTest: 1
    };
  
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


}

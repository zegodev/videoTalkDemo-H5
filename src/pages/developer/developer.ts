import {Component, OnInit} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {RoomPage} from "../room/room";
import {SettingtPage} from "../setting/setting";
import {LogProvider} from "../../providers/logProvider";
import {Storage} from '@ionic/storage';
import {ConfigProvider} from "../../providers/configProvider";

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
      this.roomId = settings['roomId'];
      this.isPublish = settings['isPublish'];
      this.isLogin = settings['isLogin'];
      this.streamId = settings['publishStreamId'];
      this.pullstreamId = settings['pullstreamId'];
      this.signUrl = settings['signUrl'];
    });

  }

  /****
   * 跳转到直播间
   * ***/
  openRoom() {
    const param = {
      roomId: this.roomId,
      publishStreamId: this.streamId,
      pullstreamId: this.pullstreamId,
      isPublish: this.isPublish,
      isLogin:this.isLogin,
      signUrl: this.signUrl,
      isTest: 1
    };

    this.storage.set('develop_setting', param).then(() => {
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
      this.config.appId = this.appId*1;
      this.navCtrl.push(RoomPage, param, {
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

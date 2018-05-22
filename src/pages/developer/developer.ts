import {Component, OnInit} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {RoomPage} from "../room/room";
import {SettingtPage} from "../setting/setting";
import {LogProvider} from "../../providers/logProvider";
import {Storage} from '@ionic/storage';

@Component({
  selector: 'page-developer',
  templateUrl: 'developer.html'
})
export class DeveloperPage implements OnInit {

  roomId: string = '';
  isPublish: boolean = true;
  streamId: string = '';
  pullstreamId: string = '';
  signUrl: string = '';


  constructor(public navCtrl: NavController, private logger: LogProvider,
              private alertCtr: AlertController, private storage: Storage) {
    console.log('DeveloperPage start');
  }

  ngOnInit() {
    this.storage.get('develop_setting').then(settings => {
      this.roomId = settings['roomId'];
      this.isPublish = settings['isPublish'];
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
      signUrl: this.signUrl,
      isTest: 1
    };

    this.storage.set('develop_setting', param).then(() => {
      if (!this.roomId) {
        this.logger.info('input roomId is empty!');
        this.alertCtr.create({title: '请输入房间号'}).present();
        return;
      }
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

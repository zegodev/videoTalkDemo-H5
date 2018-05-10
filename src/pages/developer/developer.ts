import {Component, OnInit} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {RoomPage} from "../room/room";
import {SettingtPage} from "../setting/setting";
import {LogfigProvider} from "../../providers/logProvider";

@Component({
  selector: 'page-developer',
  templateUrl: 'developer.html'
})
export class DeveloperPage implements OnInit {


  constructor(public navCtrl: NavController, private logger: LogfigProvider, private alertCtr: AlertController) {

  }

  ngOnInit() {
    console.log('000');
  }


  openRoom(roomId: string, isPublish:boolean,streamId: string, signUrl: string) {
    if (!roomId) {
      this.logger.info('input roomId is empty!');
      this.alertCtr.create({title: '请输入房间号'}).present();
      return;
    }
    this.navCtrl.push(RoomPage, {
      roomId:roomId,
        publishStreamId:streamId,
        isPublish:isPublish,
        signUrl:signUrl,
        isTest:1
  }, {
      animate: false,
    }
  )
  }


  openSetting() {
    this.navCtrl.push(SettingtPage, {}, {
      animate: true,
    })
  }


}

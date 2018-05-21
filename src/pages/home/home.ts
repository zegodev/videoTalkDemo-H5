///<reference path="../../util/commonUtil.ts"/>
///<reference path="../../../node_modules/ionic-angular/components/alert/alert-controller.d.ts"/>
import {Component,  OnInit} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {RoomPage} from "../room/room";
import {SettingtPage} from  "../setting/setting";
import {LogProvider} from "../../providers/logProvider";
import {CommonUtil} from "../../util/commonUtil";

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage implements OnInit {

  isSupport = true;
  constructor(public navCtrl: NavController,private logger:LogProvider, public alertCtr: AlertController) {
  }

  /****
   * 生命周期钩子，自动执行
   * ***/
  ngOnInit() {
    if(!CommonUtil.isSupportWebRtc()){
      this.isSupport = false;
      this.alertCtr.create({title: '哎呀，浏览器暂不支持体验webrtc哦！'}).present();
    }
    console.log('000');
  }


  /****
   * 跳转到直播间
   * ***/
  openRoom(roomId: string, test = 0) {
    if(!roomId){
      this.logger.info('iuput roomId is empty!');
      this.alertCtr.create({title: '请输入房间号'}).present();
      return;
    }
    this.navCtrl.push(RoomPage, {
      roomId, test
    }, {
      animate: false,
    })
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

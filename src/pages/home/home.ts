///<reference path="../../util/commonUtil.ts"/>
///<reference path="../../../node_modules/ionic-angular/components/alert/alert-controller.d.ts"/>
import {Component,  OnInit} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {RoomPage} from "../room/room";
import {SettingtPage} from  "../setting/setting";
import {LogProvider} from "../../providers/logProvider";
import {CommonUtil} from "../../util/commonUtil";
import {Storage} from '@ionic/storage';
import {screenShareRoomPage} from "../screeshare/screenshare";

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage implements OnInit {

  isSupport = true;
  roomId = '';
  constructor(public navCtrl: NavController,private logger:LogProvider,
              private storage:Storage,public alertCtr: AlertController) {
  }

  /****
   * 生命周期钩子，自动执行
   * ***/
  ngOnInit() {

    if(!CommonUtil.isSupportWebRtc()){
      this.isSupport = false;
      this.alertCtr.create({title: '哎呀，浏览器暂不支持体验webrtc哦！'}).present();
    }

    this.storage.get('homepage_roomid').then(result=>{
      this.roomId = result;
    })
  }


  /****
   * 跳转到直播间
   * ***/
  openRoom(test = 0) {

    if(!this.roomId){
      this.logger.info('iuput roomId is empty!');
      this.alertCtr.create({title: '请输入房间号'}).present();
      return;
    }

    let page = this.roomId === 'screen'?screenShareRoomPage:RoomPage;
    page = RoomPage;

    this.storage.set('homepage_roomid',this.roomId).then(()=>{
      this.navCtrl.push(page, {
        roomId:this.roomId, test
      }, {
        animate: false,
      })
    },err=>{
      console.log(err);
    }).catch(err=>{
      console.log(err);
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

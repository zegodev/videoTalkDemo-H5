import {Component, ViewChild} from '@angular/core';
import {AlertController, Navbar, NavController} from 'ionic-angular';
import {ConfigProvider} from "../../providers/configProvider";
import {ZegoClient} from "webrtc-zego";

@Component({
  selector: 'page-setting',
  templateUrl: 'setting.html'
})
export class SettingtPage {

  idName: string;
  appId: number;
  nickName: string;
  logLevel: number;
  logUrl: string;
  audienceCreateRoom: boolean;
  audio: boolean;
  audioInput: string;
  audioInputList: { label: string, deviceId: string }[] = [];
  video: boolean;
  videoInput: string;
  videoInputList: { label: string, deviceId: string }[] = [];
  videoQuality: number;
  horizontal: boolean;
  muted: boolean;

  zg: any;

  constructor(public navCtrl: NavController, private config: ConfigProvider, public alertCtrl: AlertController) {
    this.idName = this.config.idName;
    this.appId = this.config.appId;
    this.nickName = this.config.nickName;
    this.logLevel = this.config.logLevel;
    this.logUrl = this.config.logUrl;
    this.audio = this.config.audio;
    this.audienceCreateRoom = this.config.audienceCreateRoom;
    this.audioInput = this.config.audioInput;
    this.video = this.config.video;
    this.videoInput = this.config.videoInput;
    this.videoQuality = this.config.videoQuality;
    this.horizontal = this.config.horizontal;
    this.muted = this.config.muted;
  }

  @ViewChild(Navbar) navBar: Navbar;


  /**
   *
   * 路由跳转钩子回掉，跳转到该页面，自动执行
   * **/
  ngAfterViewInit() {
    if (typeof ZegoClient !== 'undefined') {
      this.zg = new ZegoClient();
      this.audioInputList = this.config.audioInputList;
      this.videoInputList = this.config.videoInputList;

      this.navBar.backButtonClick = (e: UIEvent) => {
        if(this.isChange()){
          this.showConfirm();
        }else{
          this.navCtrl.pop();
        }
      }
    } else {
      setTimeout(() => {
        this.ngAfterViewInit();
      }, 1000)
    }

  }


  /**
   *
   * 提示框
   * **/
  showConfirm() {
    let confirm = this.alertCtrl.create({
      title: '确定修改么?',
      message: '',
      buttons: [
        {
          text: '取消',
          handler: () => {
            if (this.navCtrl.canGoBack()) {
              this.navCtrl.pop();
            } else {
              this.navCtrl.goToRoot({
                animate: true
              });
            }
          }
        },
        {
          text: '确定',
          handler: () => {
            this.sure();
          }
        }
      ]
    });
    confirm.present();
  }


  /**
   *
   * 点击提示确定回掉，修改全局的设置
   * **/
  sure() {
    this.config.idName = this.idName;
    this.config.appId = this.appId;
    this.config.nickName = this.nickName;
    this.config.logLevel = this.logLevel;
    this.config.logUrl = this.logUrl;
    this.config.audienceCreateRoom = this.audienceCreateRoom;
    this.config.audio = this.audio;
    this.config.audioInput = this.audioInput;
    this.config.video = this.video;
    this.config.videoInput = this.videoInput;
    this.config.videoQuality = this.videoQuality * 1;
    this.config.horizontal = this.horizontal;
    this.config.muted = this.muted;

    if (this.navCtrl.canGoBack()) {
      this.navCtrl.pop();
    } else {
      this.navCtrl.goToRoot({
        animate: true
      });
    }
  }


  /**
   *
   * 判断是否有点击修改
   * **/
  isChange(): boolean {
    if (
      this.config.idName !== this.idName ||
      this.config.appId !== this.appId ||
      this.config.nickName !== this.nickName ||
      this.config.logLevel !== this.logLevel ||
      this.config.logUrl !== this.logUrl ||
      this.config.audienceCreateRoom !== this.audienceCreateRoom ||
      this.config.audio !== this.audio ||
      this.config.audioInput !== this.audioInput ||
      this.config.video !== this.video ||
      this.config.videoInput !== this.videoInput ||
      this.config.videoQuality != this.videoQuality ||
      this.config.horizontal !== this.horizontal ||
      this.config.muted !== this.muted) {
      return true;
    } else {
      return false
    }
  }

}

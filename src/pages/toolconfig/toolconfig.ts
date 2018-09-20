import {Component, OnInit} from '@angular/core';
import {AlertController, ModalController, NavController} from 'ionic-angular';
import {LogProvider} from "../../providers/logProvider";
import {Storage} from '@ionic/storage';
import {ConfigProvider} from "../../providers/configProvider";
import {QrCodeModal} from "../qrCodeModal";
import {CommonUtil} from "../../util/commonUtil";
import {HomePage} from "../home/home";

@Component ({
  selector: 'page-tool',
  templateUrl: 'toolconfig.html'
})
export class ToolConfigPage implements OnInit {
  
  title: string = '';
  appKey: string = '';
  testenv: boolean = false;
  businessType: number;
  appId: number;
  
  constructor (public navCtrl: NavController, private logger: LogProvider, private config: ConfigProvider,
               private alertCtr: AlertController, private storage: Storage, public modalCtrl: ModalController) {
    console.log ('ToolConfigPage start');
  }
  
  ngOnInit () {
    this.storage.get ('toolConfig').then (toolConfig => {
      if (toolConfig) {
        this.appId = toolConfig['appid'];
        this.appKey = toolConfig['appkey'];
        this.testenv = toolConfig['testenv'];
        this.businessType = toolConfig['businesstype'];
        this.title = toolConfig['title'];
      }
    });
    
  }
  
  openQRCode () {
    const value = {
      data: {
        "appid": this.appId * 1,
        "businesstype": this.businessType * 1,
        "appkey": this.appKey,
        "testenv": this.testenv,
        "title": this.title
      },
      "type": "ac"
    };
    
    this.storage.set ('toolConfig', value.data).then (() => {
      const param = CommonUtil.utf16to8 (JSON.stringify (value));
      this.logger.info ('toolconfig:' + param);
      let profileModal = this.modalCtrl.create (QrCodeModal, {text: decodeURIComponent (param)}, {
        showBackdrop: true,
        enableBackdropDismiss: true
      });
      profileModal.present ();
    });
    
  }
  
  goback () {
    if (this.navCtrl.canGoBack ()) {
      this.navCtrl.pop ();
    } else {
      this.navCtrl.push (HomePage);
    }
    
  }
  
  
}

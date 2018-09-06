///<reference path="../../node_modules/ionic-angular/components/alert/alert-controller.d.ts"/>
import {Component, ContentChild, ElementRef, ViewChild} from '@angular/core';
import {
  NavParams,
  ViewController
} from 'ionic-angular';

/**
 * Generated class for the DetailPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@Component ({
  styles: [
      `ion-content {
      background: white;
    }
    
    img {
      margin-top: 10%;
    }
    `
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>
           demo设置页面配置参数（ios，android）
        </ion-title>
        <ion-buttons start>
          <button ion-button (click)="dismiss()">
            <span ion-text color="primary" showWhen="ios">取消</span>
            <ion-icon name="md-close" showWhen="android, windows"></ion-icon>
          </button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-grid>
        <ion-row>
          <ion-col></ion-col>
          <ion-col> 扫一扫</ion-col>
          <ion-col></ion-col>
        </ion-row>
        <ion-row>
          <ion-col></ion-col>
          <ion-col>
            <div #qrData></div>
          </ion-col>
          <ion-col></ion-col>
        </ion-row>
        <!--<ion-row>-->
          <!--<ion-col></ion-col>-->
          <!--<ion-col>-->
            <!--<p>微信里点“发现”，扫一下</p>-->
            <!--<p>二维码便可将本文分享至朋友圈。</p>-->
          <!--</ion-col>-->
          <!--<ion-col></ion-col>-->
        <!---->
        <!--</ion-row>-->
      </ion-grid>
    
    </ion-content>
  `,
})
export class QrCodeModal {
   @ViewChild('qrData')
   qrData:ElementRef;
  
  constructor (private params: NavParams, public viewCtrl: ViewController) {
  
  }
  
  
  ngAfterViewInit(){
    jQuery(this.qrData.nativeElement).qrcode({
      text: this.params.get('text'),
      width: 200,
      height: 200,
      colorDark : "#000000",
      colorLight : "#ffffff",
      //correctLevel : jQuery.CorrectLevel.H
    });
  }
  
  dismiss(){
    this.viewCtrl.dismiss();
  }
}

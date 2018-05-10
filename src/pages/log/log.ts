import {Component} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {ConfigProvider} from "../../providers/configProvider";
import {LogfigProvider} from "../../providers/logProvider";

declare let ZegoClient: any;

@Component({
  selector: 'page-setting',
  templateUrl: 'log.html'
})
export class LogPage {

  logArray: string[] = [];
  typeArray: string[] = [];
  selectOption = {};
  _typeID = '';

  constructor(public navCtrl: NavController, private log: LogfigProvider, private config: ConfigProvider, public alertCtrl: AlertController) {

  }

  get typeID() {
    return this._typeID;
  }

  set typeID(value) {
    if (value === '###') {
      this.logArray = this.log.statck.filter(item => {
        return this.isOther(item);
      });
      this.logArray.reverse();

    } else if (value) {
      this.logArray = this.log.statck.filter(item => {
        return item.indexOf('#' + value + '#') > -1;
      });
      this.logArray.reverse();
    } else {
      this.ngAfterViewInit();
    }

  }

  isOther(value: string): boolean {
    let _result = true;
    for (let i = 0; i < this.typeArray.length; i++) {
      if (value.indexOf(`#${this.typeArray[i]}#`) > -1) {
        _result = false;
        break;
      }
    }
    return _result;

  }

  ngAfterViewInit() {
    this.logArray = [...this.log.statck];
    this.logArray.reverse();
    this.typeArray = Array.from(this.log._set);
    // this.log.sub.subscribe(result => {
    //   this.logArray.push(result as string);
    // });
  }


  showDetail(value:string){
     this.alertCtrl.create({
       message:value
     }).present();
  }

  sendLog() {
    if (this.config.logUrl) {
      this.log.sendLog().subscribe(result => {
        this.logArray = [];
        this.log.statck = [];
      })
    } else {
      this.alertCtrl.create({
        title: '请先配置日志服务器',
        message: '',
        buttons: [
          {
            text: '确定',
            handler: () => {
              console.log('Disagree clicked');
            }
          }
        ]
      }).present();
    }
  }

}

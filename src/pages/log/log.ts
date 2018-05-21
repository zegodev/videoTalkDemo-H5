import {Component} from '@angular/core';
import {AlertController, NavController} from 'ionic-angular';
import {ConfigProvider} from "../../providers/configProvider";
import {LogProvider} from "../../providers/logProvider";
import {Subscription} from "rxjs/Subscription";



@Component({
  selector: 'page-setting',
  templateUrl: 'log.html'
})
export class LogPage{

  logArray: string[] = [];
  typeArray: string[] = [];
  selectOption = {};
  _typeID = '';

  subscription:Subscription;

  /**
   *
   * 初始化
   * **/
  constructor(public navCtrl: NavController, private log: LogProvider, private config: ConfigProvider, public alertCtrl: AlertController) {
    this.myInit();
  }


  /**
   *
   * 订阅日志，日志的刷新，依赖rxjs6.0  https://cn.rx.js.org/
   * **/
  myInit(){
    this.subscription = this.log.sub.subscribe(log=>{
      if(this.typeID  === '###'){
        if(this.isOther(log))this.logArray.unshift(log);
      }else if(!!this.typeID){
        log.indexOf('#' + this.typeID + '#') > -1 && this.logArray.unshift(log);
      }else{
        this.logArray.unshift(log);
      }
    })
  }


  /**
   *
   *  路由钩子，在constructor后自执行
   * **/

  ngAfterViewInit() {
    this.logArray = [...this.log.statck];
    this.logArray.reverse();
    this.typeArray = Array.from(this.log._set);
  }

  refreshStatus = 'stop';
  /**
   *
   * 取消订阅日志和重新订阅
   * **/
  toggleRefresh(){
    if(this.refreshStatus === 'stop'){
      this.refreshStatus = 'refresh';
      this.subscription.unsubscribe();
    }else{
      this.refreshStatus = 'stop';
      this.typeID = this._typeID;
      this.myInit();
    }

  }


  /**typeID 双向绑定操作拆解  start  * **/
  get typeID() {
    return this._typeID;
  }

  set typeID(value) {
    this._typeID = value;
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
  /**typeID 双向绑定操作拆解  end  * **/


  /**
   *
   * 过滤非推拉流相关日志
   * **/
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


  /**
   * 销毁组建钩子
   */
  ionViewWillUnload() {
    this.subscription.unsubscribe();
  }
}

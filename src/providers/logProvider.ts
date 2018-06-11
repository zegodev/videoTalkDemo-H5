///<reference path="../util/timeUtil.ts"/>

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ConfigProvider} from "./configProvider";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {TimeUtil} from "../util/timeUtil";

/*
 Generated class for the IndexProvider provider.

 See https://angular.io/guide/dependency-injection for more info on providers
 and Angular DI.
 */
@Injectable()
export class LogProvider {

  statck = [];
  sub = new BehaviorSubject('0');
  //_replaySub = new ReplaySubject(1000);

  nativeConsole:any;

  constructor(public http: HttpClient, private config: ConfigProvider) {
    console.log('Hello LogfigProvider Provider');
    this.sub.subscribe(result=>{//防止数据过大
      if(this.statck.length>500){
        this.statck.shift();
      }else{
        this.statck.push(result);
      }
    });


    let that = this;
    this.nativeConsole =  {
      log:window.console.log.bind(window),
      debug:window.console.debug.bind(window),
      warn:window.console.warn.bind(window),
      error:window.console.error.bind(window)
    }


    let consoleOverWiter = function(level_n:'debug'|'log'|'warn'|'error',level:'debug'|'info'|'warning'|'errors'){
      return function(){
        let _result = [];
        [...Array.prototype.slice.call(arguments)].forEach(item=>{
          if(typeof item === 'string'){
            _result.push(item);
          }else if(typeof item === 'object'){
            try {
              _result.push(JSON.stringify(item));
            }catch (e) {
              that.nativeConsole[level_n](item);
            }
          }else{
            that.nativeConsole[level_n](item);
          }
        });
        that[level](_result.join(','));
      }
    }

    window.console.debug =  consoleOverWiter('debug','debug');

    window.console.info =  consoleOverWiter('log','info');

    window.console.log =  consoleOverWiter('log','info');

    window.console.warn =   consoleOverWiter('warn','warning');

    window.console.error =  consoleOverWiter('error','errors');

  }




  sendLog() {
    //xmlhttp.open("GET", loginTokenUrl + "?app_id=" + appid + "&id_name=" + idName, true);
    return this.http.post(this.config.logUrl, this.statck.join(','));
  }

  debug(value: string) {
    this.typeLog(value);
    if (this.config.logLevel != 100 && this.config.logLevel <= 0 && value) {
      this.sub.next(TimeUtil.format('hh:mm:ss S')+'|debug'+'|'+value);
    }
    this.nativeConsole.debug(value);
  }

  info(value: string) {
    this.typeLog(value);
    if (this.config.logLevel != 100 && this.config.logLevel <= 1 && value) {
      this.sub.next(TimeUtil.format('hh:mm:ss S')+'|info'+'|'+value);
    }
    this.nativeConsole.log(value);
  }

  warning(value: string) {
    this.typeLog(value);
    if (this.config.logLevel != 100 && this.config.logLevel <= 2 && value) {
      this.sub.next(TimeUtil.format('hh:mm:ss S')+'|warning'+'|'+value);
    }
    this.nativeConsole.warn(value);
  }

  errors(value: string) {
    this.typeLog(value);
    if (this.config.logLevel != 100 && this.config.logLevel <= 3 && value) {
      this.sub.next(TimeUtil.format('hh:mm:ss S')+'|errors'+'|'+value);
    }
    this.nativeConsole.error(value);
  }

  _set = new Set([]);
  _reg = /#.+#/;

  typeLog(val: string) {
    if (!!val && this.config.logLevel != 100) {
      let temp = this._reg.exec(val);
      temp&&temp.length>0&&this._set.add(temp[0].replace(/#/g, ''));
    }
  }


}





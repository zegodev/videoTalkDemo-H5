import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CommonUtil} from "../util/commonUtil";
import {ZegoClient} from "choui-zego-rtc";
/*
 Generated class for the IndexProvider provider.

 See https://angular.io/guide/dependency-injection for more info on providers
 and Angular DI.
 */

@Injectable()
export class ConfigProvider {

  zg: any;

  constructor(public http: HttpClient) {
    this.init();
  }

  init() {
    if (typeof ZegoClient !== 'undefined') {
      this.zg = new ZegoClient();
      this.initEnumDevices();
    } else {
      setTimeout(() => {
        this.init();
      }, 1000)
    }
  }


  config = {
    appId: 229059616,
    idName: '',
    nickName: '',
    server: '',
    loginTokenUrl: '',
    logUrl: '',
    videoQuality: 2,
    logLevel: 0,
    audienceCreateRoom: false,
    audio: true,
    audioInput: null,
    video: true,
    videoInput: null,
    horizontal: true,
    muted: false
  }

  get appId() {
    return this.config.appId || 229059616;
  }

  set appId(value: number) {
    value && (this.config.appId = value);
  }

  get idName() {
    if (!this.config.idName) {
      this.config.idName = ("" + new Date().getTime() + Math.floor(Math.random() * 100000));
    }
    return this.config.idName;
  }

  set idName(value: string) {
    this.config.idName = value;
  }


  get nickName() {
    return this.config.nickName || ('u' + this.idName);
  }

  set nickName(value: string) {
    value && (this.config.nickName = value)
  }


  get server() {
    return this.config.server || ('wss://wsliveroom' + this.appId + '-api.zego.im:8282/ws');
  }

  set server(value: string) {
    value && (this.config.server = value)
  }

  get loginTokenUrl() {
    return this.config.loginTokenUrl || ('https://wsliveroom' + this.appId + '-api.zego.im:8282/token');
  }

  set loginTokenUrl(value: string) {
    value && (this.config.loginTokenUrl = value)
  }

  get logUrl() {
    return this.config.logUrl || '';
  }

  set logUrl(value: string) {
    value && (this.config.logUrl = value)
  }

  get logLevel() {
    return this.config.logLevel;
  }

  set logLevel(value: number) {
    value && (this.config.logLevel = value)
  }

  get audienceCreateRoom() {
    return this.config.audienceCreateRoom;
  }

  set audienceCreateRoom(value: boolean) {
    this.config.audienceCreateRoom = value;
  }

  get audio() {
    return this.config.audio;
  }

  set audio(value: boolean) {
    this.config.audio = value;
  }

  get audioInput() {
    return this.config.audioInput;
  }

  set audioInput(value: string) {
    value && (this.config.audioInput = value)
  }

  get video() {
    return this.config.video;
  }

  set video(value: boolean) {
    this.config.video = value;
  }

  get videoInput() {

    return this.config.videoInput;
  }

  set videoInput(value: string) {
    value && (this.config.videoInput = value)
  }

  get horizontal() {
    return this.config.horizontal;
  }

  set horizontal(value: boolean) {
    this.config.horizontal = value;
  }

  get muted() {
    return this.config.muted;
  }

  set muted(value: boolean) {
    this.config.muted = value;
  }


  get videoQuality() {
    return this.config.videoQuality || 2;
  }

  set videoQuality(value: number) {
    value && (this.config.videoQuality = value)
  }

  getParameterByName(name, url?) {
    if (!url) url = window.location.href;
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  getToken(support?:string) {
    //xmlhttp.open("GET", loginTokenUrl + "?app_id=" + appid + "&id_name=" + idName, true);
    let cgi_token = '';
    if(support){
      (cgi_token = CommonUtil.generateTokenInfo(this.appId));
      this.loginTokenUrl = "https://wsliveroom-demo.zego.im:8282/token";
    }
    return this.http.get(this.loginTokenUrl, {
      params: {
        app_id: this.appId + '',
        id_name: this.idName,
        cgi_token
      },
      responseType: 'text'
    });
  }

  count = 0;
  audioInputList = [];
  videoInputList = [];

  initEnumDevices() {
    this.audioInputList = [];
    this.videoInputList = [];
    let defaultIndex = 0;
    this.zg.enumDevices(deviceInfo => {
      console.log('enumDevices' + JSON.stringify(deviceInfo));
      if (deviceInfo.microphones) {
        for (let i = 0; i < deviceInfo.microphones.length; i++) {
          i === 0 ? this.audioInput = deviceInfo.microphones[i].deviceId : null;
          if (!deviceInfo.microphones[i].label) {
            deviceInfo.microphones[i].label = 'microphone' + i;
          }
          this.audioInputList.push(deviceInfo.microphones[i]);
          console.log("microphone: " + deviceInfo.microphones[i].label);
        }
      }

      if (deviceInfo.cameras) {
        if (CommonUtil.isIphone() && CommonUtil.isSafari()&& deviceInfo.cameras.length>0) {
          defaultIndex = deviceInfo.cameras.length - 1;
        }
        this.videoInput = deviceInfo.cameras[defaultIndex].deviceId;
        for (let i = 0; i < deviceInfo.cameras.length; i++) {
          if (!deviceInfo.cameras[i].label) {
            deviceInfo.cameras[i].label = 'camera' + i;
          }
          this.videoInputList.push(deviceInfo.cameras[i]);
          console.log("camera: " + deviceInfo.cameras[i].label);
        }
      }
    }, function (error) {
      console.error("enum device error: " + error);
    });
  }


  toggleVideo(index: 0 | 1) {
    if (this.videoInputList && this.videoInputList[index]) {
      return this.videoInputList[index].deviceId;
    } else if (this.videoInputList.length === 1) {
      return this.videoInputList[0].deviceId;
    } else {
      return null;
    }
  }
}





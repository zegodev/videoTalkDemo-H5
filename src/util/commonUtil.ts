
export class CommonUtil {

  static isSupportWebRtc() :boolean{
    if (!navigator.getUserMedia  || !RTCPeerConnection) {
      return false;
    } else {
      return true;
    }
  }

  static isPC() :boolean{
    //平台、设备和操作系统
    let system ={
      win : false,
      mac : false,
      xll : false
    };
    //检测平台
    var p = navigator.platform;
    system.win = p.indexOf("Win") == 0;
    system.mac = p.indexOf("Mac") == 0;
    system.xll = (p == "X11") || (p.indexOf("Linux") == 0);
    //跳转语句
    if(system.win||system.mac||system.xll){
      return true;
    }else{
      return false;
    }
  }

  static isIphone():boolean{
    const ua = navigator.userAgent.toLowerCase();
    return ua.indexOf("ipad") != -1 || ua.indexOf("iphone os") != -1;;
  }

  static isSafari():boolean{
    const ua = navigator.userAgent;
    return ua.indexOf("Safari") != -1 && ua.indexOf("Version") != -1;;
  }




}

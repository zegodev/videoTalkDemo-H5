export class CommonUtil {
  
  static isSupportWebRtc (): boolean {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !RTCPeerConnection) {
      return false;
    } else {
      return true;
    }
  }
  
  static isPC (): boolean {
    //平台、设备和操作系统
    let system = {
      win: false,
      mac: false,
      xll: false
    };
    //检测平台
    var p = navigator.platform;
    system.win = p.indexOf ("Win") == 0;
    system.mac = p.indexOf ("Mac") == 0;
    system.xll = (p == "X11") || (p.indexOf ("Linux") == 0);
    //跳转语句
    if (system.win || system.mac || system.xll) {
      return true;
    } else {
      return false;
    }
  }
  
  static isIphone (): boolean {
    const ua = navigator.userAgent.toLowerCase ();
    return ua.indexOf ("ipad") != -1 || ua.indexOf ("iphone os") != -1;
    ;
  }
  
  static isSafari (): boolean {
    const ua = navigator.userAgent;
    return ua.indexOf ("Safari") != -1 && ua.indexOf ("Version") != -1;
    
  }
  
  static utf16to8 (str: string): string {
    let out, i, len, c;
    out = "";
    len = str.length;
    for (i = 0; i < len; i++) {
      c = str.charCodeAt (i);
      if ((c >= 0x0001) && (c <= 0x007F)) {
        out += str.charAt (i);
      } else if (c > 0x07FF) {
        out += String.fromCharCode (0xE0 | ((c >> 12) & 0x0F));
        out += String.fromCharCode (0x80 | ((c >> 6) & 0x3F));
        out += String.fromCharCode (0x80 | ((c >> 0) & 0x3F));
      } else {
        out += String.fromCharCode (0xC0 | ((c >> 6) & 0x1F));
        out += String.fromCharCode (0x80 | ((c >> 0) & 0x3F));
      }
    }
    return out;
  }
  
  static msgTranse(_msg){
    switch (_msg){
      case 'dispatch request error':
        return '该流已断开退出';
      case 'login token error':
        return '网络没有响应，请切换网络重试';
    }
  }
}

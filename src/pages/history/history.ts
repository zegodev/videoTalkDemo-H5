import {Component, ViewChild} from '@angular/core';
import {AlertController, Navbar, NavController} from 'ionic-angular';

@Component ({
  selector: 'page-history',
  templateUrl: 'histroy.html'
})
export class HistoryPage {
  
  items = [
    {
      version: '1.1.4',
      details: [
        '火狐浏览器在预览途中，退出预览；导致后续不能再退出',
        '解决房间名称为no name问题',
        '混流接口优化',
        '推拉流添加鉴权',
        '拉流创建session参数type纠正',
        '消息category改为与native一致',
        '预览接口兼容火狐最新版',
        '同房间流名冲突，拉流不报错，内部直接重新拉流',
        'gw服务重试次数5次调整为3次',
      ]
    },
    {
      version: '1.1.3',
      details: [
        '解决测试环境推流成功回调失败问题',
      ]
    },
    {
      version: '1.1.2',
      details: [
        '拉流改为offer模式',
      ]
    }
  ];
  
  constructor (public navCtrl: NavController, public alertCtrl: AlertController) {
  
  }
  
  @ViewChild (Navbar) navBar: Navbar;
  
  
  /**
   *
   * 路由跳转钩子回掉，跳转到该页面，自动执行
   * **/
  ngAfterViewInit () {
    this.navBar.backButtonClick = (e: UIEvent) => {
      this.navCtrl.pop ();
    }
  }
}


///<reference path="../util/pipe/slidePipe.ts"/>
///<reference path="../providers/logProvider.ts"/>
///<reference path="../pages/log/log.ts"/>
///<reference path="../pages/developer/developer.ts"/>
import {NgModule, ErrorHandler} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {IonicApp, IonicModule, IonicErrorHandler} from 'ionic-angular';
import {MyApp} from './app.component';
import {SettingtPage} from '../pages/setting/setting';
import {HomePage} from '../pages/home/home';

import {StatusBar} from '@ionic-native/status-bar';
import {SplashScreen} from '@ionic-native/splash-screen';
import {ConfigProvider} from '../providers/configProvider';
// import { IndexProvider } from '../providers/index/index';
import {HttpClientModule} from '@angular/common/http';
import {RoomPage} from '../pages/room/room';
import {SlidePipe} from "../util/pipe/slidePipe";
import {LogProvider} from "../providers/logProvider";
import {LogPage} from "../pages/log/log";
import {DeveloperPage} from "../pages/developer/developer";
// import { TagSearchPage } from '../pages/tag-search/tag-search';
// import { MarkdownModule } from 'angular2-markdown';
import { IonicStorageModule } from '@ionic/storage';
import {screenShareRoomPage} from "../pages/screeshare/screenshare";
import {DevRoomPage} from "../pages/devroom/room";
import {SupportPage} from "../pages/support/support";
import {SupportRoomPage} from "../pages/supportRoom/room";

@NgModule({
  declarations: [
    MyApp,
    SettingtPage,
    HomePage,
    RoomPage,
    DevRoomPage,
    LogPage,
    SlidePipe,
    DeveloperPage,
    screenShareRoomPage,
    SupportPage,
    SupportRoomPage,
    // TagSearchPage
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicStorageModule.forRoot(),
    IonicModule.forRoot(MyApp, {},{
      links: [
        {component: DeveloperPage, name: 'developer', segment: 'test'},
        {component: SupportPage, name: 'support', segment: 'support'}
      ]
    })
    // MarkdownModule
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    SettingtPage,
    HomePage,
    RoomPage,
    DevRoomPage,
    LogPage,
    screenShareRoomPage,
    DeveloperPage,
    SupportPage,
    SupportRoomPage,
    // TagSearchPage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    ConfigProvider,
    LogProvider,
    SlidePipe
  ]
})
export class AppModule {
}

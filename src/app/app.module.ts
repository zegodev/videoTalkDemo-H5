///<reference path="../util/pipe/slidePipe.ts"/>
///<reference path="../providers/logProvider.ts"/>
///<reference path="../pages/log/log.ts"/>
///<reference path="../pages/developer/developer.ts"/>
import {NgModule, ErrorHandler} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {IonicApp, IonicModule, IonicErrorHandler} from 'ionic-angular';
import {MyApp} from './app.component';
import {StatusBar} from '@ionic-native/status-bar';
import {SplashScreen} from '@ionic-native/splash-screen';
import {ConfigProvider} from '../providers/configProvider';
import {HttpClientModule} from '@angular/common/http';
import {SlidePipe} from "../util/pipe/slidePipe";
import {LogProvider} from "../providers/logProvider";
import {DeveloperPage} from "../pages/developer/developer";
import { IonicStorageModule } from '@ionic/storage';
import {pageArr } from "../pages";

import {ToolConfigPage} from "../pages/toolconfig/toolconfig";
import {HistoryPage} from "../pages/history/history";

@NgModule({
  declarations: [
    MyApp,
    ...pageArr,
    SlidePipe
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicStorageModule.forRoot(),
    IonicModule.forRoot(MyApp, {},{
      links: [
        {component: DeveloperPage, name: 'developer', segment: 'test'},
        {component: ToolConfigPage, name: 'config', segment: 'config'},
        {component: HistoryPage, name: 'sdk', segment: 'sdk'}
        ]
    })
    // MarkdownModule
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    ...pageArr,
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

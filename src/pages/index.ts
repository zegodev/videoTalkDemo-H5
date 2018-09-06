import {HomePage} from "./home/home";
import {DevRoomPage} from "./devroom/room";
import {SupportPage} from "./support/support";
import {LogPage} from "./log/log";
import {RoomPage} from "./room/room";
import {screenShareRoomPage} from "./screeshare/screenshare";
import {SettingtPage} from "./setting/setting";
import {SupportRoomPage} from "./supportRoom/room";
import {HistoryPage} from "./history/history";
import {DeveloperPage} from "./developer/developer";
import {QrCodeModal} from "./qrCodeModal";
import {ToolConfigPage} from "./toolconfig/toolconfig";

export const pageArr = [
  SettingtPage,
  HomePage,
  RoomPage,
  DevRoomPage,
  LogPage,
  DeveloperPage,
  screenShareRoomPage,
  SupportPage,
  SupportRoomPage,
  HistoryPage,
  ToolConfigPage,
  QrCodeModal
];


export const pageObj = {
  SettingtPage,
  HomePage,
  RoomPage,
  DevRoomPage,
  LogPage,
  screenShareRoomPage,
  DeveloperPage,
  SupportPage,
  SupportRoomPage,
  HistoryPage
}

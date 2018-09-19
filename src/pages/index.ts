import {HomePage} from "./home/home";
import {DevRoomPage} from "./devroom/room";
import {LogPage} from "./log/log";
import {RoomPage} from "./room/room";
import {screenShareRoomPage} from "./screeshare/screenshare";
import {SettingtPage} from "./setting/setting";
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
  HistoryPage
}

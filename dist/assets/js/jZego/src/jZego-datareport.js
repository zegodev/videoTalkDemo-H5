/**
   ZegoDataReport
*/

export default function ZegoDataReport(logger) {
    this.logger = logger;

    this.dataStatistics = {};
}

ZegoDataReport.prototype.newReport = function(seq) {
    this.dataStatistics[seq] = {
        abs_time: Date.now(),
        time_consumed: 0,
        error: 0,
        events: [],
    };
};

ZegoDataReport.prototype.addMsgExt = function(seq, msg_ext) {
    if (!this.dataStatistics[seq]) {
        return;
    }

    this.dataStatistics[seq].msg_ext = msg_ext;
};

/*
 *    "zd.es.0": "ZegoDataReport.eventStart"
 */
ZegoDataReport.prototype.eventStart = function (seq, event_name) {
    if (!this.dataStatistics[seq]) {
        this.logger.info("zd.es.0 no seq match");
        return;
    }

    if (this.dataStatistics[seq].events == undefined) {
        this.logger.info("zd.es.0 no events");
        return;
    }

    this.dataStatistics[seq].events.push({
        event: event_name,
        abs_time: Date.now(),
        time_consumed: 0
    });
};

/*
 *    "zd.ee.0": "ZegoDataReport.eventStart"
 */
ZegoDataReport.prototype.eventEnd = function (seq, event_name) {
    if (!this.dataStatistics[seq]) {
        this.logger.info("zd.ee.0 no seq match");
        return;
    }

    var events = this.dataStatistics[seq].events;
    if (events == undefined) {
        this.logger.info("zd.ee.0 no events");
        return;
    }

    for (var i = events.length - 1; i >= 0; i--) {
        if (events[i].event == event_name && events[i].time_consumed != undefined) {
            events[i].time_consumed = Date.now() - events[i].abs_time;
            break;
        }
    }
};

ZegoDataReport.prototype.eventEndWithMsg = function (seq, event_name, msg_ext) {
    if (!this.dataStatistics[seq]) {
        this.logger.info("zd.ee.0 no seq match");
        return;
    }

    var events = this.dataStatistics[seq].events;
    if (events == undefined) {
        this.logger.info("zd.ee.0 no events");
        return;
    }

    for (var i = events.length - 1; i >= 0; i--) {
        if (events[i].event == event_name && events[i].time_consumed != undefined) {
            events[i].time_consumed = Date.now() - events[i].abs_time;

            if (events[i].msg_ext == undefined) {
                events[i].msg_ext = {};
            }

            for (var item in msg_ext) {
                events[i].msg_ext[item] = msg_ext[item];
            }
            break;
        }
    }
};

/*
 *    "zd.aei.0": "ZegoDataReport.addEventInfo"
 */
ZegoDataReport.prototype.addEventInfo = function (seq, event_name, key, value){
    if (!this.dataStatistics[seq]) {
        this.logger.info("zd.aei.0 no seq match");
        return;
    }

    var events = this.dataStatistics[seq].events;
    if (events == undefined) {
        this.logger.info("zd.aei.0 no events");
        return;
    }

    for (var i = events.length - 1; i >= 0; i--) {
        if (events[i].event == event_name && events[i].time_consumed != undefined) {
            if (events[i].event == event_name && events[i].time_consumed != undefined) {
                if (events[i].msg_ext == undefined) {
                    events[i].msg_ext = {};
                }

                events[i].msg_ext[key] = value;
                break;
            }
        }
    }
};

/*
 *    "zd.ae.0": "ZegoDataReport.addEvent"
 */
ZegoDataReport.prototype.addEvent = function (seq, event_name, msg_ext) {
    if (!this.dataStatistics[seq]) {
        this.logger.info("zd.ae.0 no seq match");
        return;
    }

    if (this.dataStatistics[seq].events == undefined) {
        return;
    }

    if (msg_ext) {
        this.dataStatistics[seq].events.push({
            event: event_name,
            abs_time: Date.now(),
            msg_ext: msg_ext
        });
    }
    else {
        this.dataStatistics[seq].events.push({
            event: event_name,
            abs_time: Date.now(),
        });
    }
};

ZegoDataReport.prototype.uploadReport = function(seq, itemType) {
    var reportInfo = this.dataStatistics[seq];
    if (reportInfo == undefined) {
        return;
    }

    reportInfo.itemtype = itemType;
    reportInfo.time_consumed = Date.now() - reportInfo.abs_time;

    this.logger.report(reportInfo);

    delete this.dataStatistics[seq];
};

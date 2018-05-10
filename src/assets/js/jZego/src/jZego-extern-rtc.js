export var playErrorList = {
    DISPATCH_ERROR: {
        code: "ZegoPlay.Error.Dispatch",
        msg: "dispatch request error"
    },
    DISPATCH_TIMEOUT: {
        code: "ZegoPlay.Timeout.Dispatch",
        msg: "dispatch request timeout"
    },
    TOKEN_ERROR: {
        code: "ZegoPlay.Error.Token",
        msg: "login token error"
    },
    SEND_SESSION_TIMEOUT: {
        code: "ZegoPlay.Timeout.Session",
        msg: "send session request timeout"
    },
    CREATE_SESSION_ERROR: {
        code: "ZegoPlay.Error.Session",
        msg: "create session error"
    },
    SERVER_MEDIA_DESC_TIMEOUT: {
        code: "ZegoPlay.Timeout.RemoteOffer",
        msg: "wating server mediaDesc timeout"
    },
    SET_REMOTE_DESC_ERROR: {
        code: "ZegoPlay.Error.RemoteOffer",
        msg: "other side offer error"
    },
    CREATE_ANSWER_ERROR: {
        code: "ZegoPlay.Error.CreateAnswer",
        msg: "create offer error"
    },
    SET_LOCAL_DESC_ERROR: {
        code: "ZegoPlay.Error.LocalDesc",
        msg: "setLocalDescription error"
    },
    SEND_MEDIA_DESC_TIMEOUT: {
        code: "ZegoPlay.Timeout.Desc",
        msg: "send mediaDesc timeout"
    },
    SEND_CANDIDATE_TIMEOUT: {
        code: "ZegoPlay.Timeout.Candidate",
        msg: "send candidate timeout"
    },
    SERVER_CANDIDATE_TIMEOUT: {
        code: "ZegoPlay.Timeout.ServerCandidate",
        msg: "waiting candidate timeout"
    },
    SERVER_CANDIDATE_ERROR: {
        code: "ZegoPlay.Error.ServerCandidate",
        msg: "recv candidate error"
    },
    MEDIA_CONNECTION_FAILED: {
        code: "ZegoPlay.Error.ConnectionFailed",
        msg: "ice Connection state failed"
    },
    MEDIA_CONNECTION_CLOSED: {
        code: "ZegoPlay.Error.ConnectionClosed",
        msg: "ice connection state closed"
    },
    SESSION_CLOSED: {
        code: "ZegoPlay.Error.SessionClosed",
        msg: "server session closed"
    },
    WEBSOCKET_ERROR: {
        code: "ZegoPlay.Error.SocketError",
        msg: "network error"
    }
};

export var publishErrorList = {
    DISPATCH_ERROR: {
        code: "ZegoPublish.Error.Dispatch",
        msg: "dispatch request error"
    },
    DISPATCH_TIMEOUT: {
        code: "ZegoPublish.Timeout.Dispatch",
        msg: "dispatch request timeout"
    },
    TOKEN_ERROR: {
        code: "ZegoPublish.Error.Token",
        msg: "login token error"
    },
    SEND_SESSION_TIMEOUT: {
        code: "ZegoPublish.Timeout.Session",
        msg: "send session request timeout"
    },
    CREATE_SESSION_ERROR: {
        code: "ZegoPublish.Error.Session",
        msg: "create session error"
    },
    CREATE_OFFER_ERROR: {
        code: "ZegoPublish.Error.CreateOffer",
        msg: "create offer error"
    },
    SET_LOCAL_DESC_ERROR: {
        code: "ZegoPublish.Error.LocalDesc",
        msg: "setLocalDescription error"
    },
    SEND_MEDIA_DESC_TIMEOUT: {
        code: "ZegoPublish.Timeout.Desc",
        msg: "send mediaDesc timeout"
    },
    SERVER_MEDIA_DESC_TIMEOUT: {
        code: "ZegoPublish.Timeout.ServerAnswer",
        msg: "waiting server mediaDesc timeout"
    },
    SERVER_MEDIA_DESC_ERROR: {
        code: "ZegoPublish.Error.ServerAnswer",
        msg: "server mediaDesc type error"
    },
    SET_REMOTE_DESC_ERROR: {
        code: "ZegoPublish.Error.RemoteDesc",
        msg: "other side offer error"
    },
    SEND_CANDIDATE_TIMEOUT: {
        code: "ZegoPublish.Timeout.Candidate",
        msg: "sendIceCandidate error"
    },
    SERVER_CANDIDATE_TIMEOUT: {
        code: "ZegoPublish.Timeout.ServerCandidate",
        msg: "waiting candidate timeout"
    },
    SERVER_CANDIDATE_ERROR: {
        code: "ZegoPublish.Error.ServerCandidate",
        msg: "recv candidate error"
    },
    SESSION_CLOSED: {
        code: "ZegoPublish.Error.SessionClosed",
        msg: "server session closed"
    },
    MEDIA_CONNECTION_FAILED: {
        code: "ZegoPublish.Error.IConnectionFailed",
        msg: "Iice Connection state failed"
    },
    MEDIA_CONNECTION_CLOSED: {
        code: "ZegoPublish.Error.ConnectionClosed",
        msg: "ice connection state closed"
    },
    WEBSOCKET_ERROR: {
        code: "ZegoPublish.Error.SocketError",
        msg: "network error"
    }
};

export var ENUM_PUBLISH_STATE_UPDATE = {
    start: 0,
    error: 1,
    retry: 2
};

export var ENUM_PLAY_STATE_UPDATE = {
    start: 0,
    error: 1,
    retry: 2
};

export var ENUM_RETRY_STATE = {
    didNotStart: 0,
    retrying: 1,
    finished: 2
};

export var getSeq = (function() {
    var seq = 1;

    return function() { return seq++; };
})();
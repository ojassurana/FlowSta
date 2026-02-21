window.FlowState = window.FlowState || {};

window.FlowState.eeg = (function () {
  var ws = null;
  var reconnectTimer = null;
  var connected = false;
  var intentionalClose = false;

  var onMetrics = null;
  var onStatusChange = null;

  function connect() {
    if (ws && ws.readyState <= 1) return; // CONNECTING or OPEN
    intentionalClose = false;

    var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    var url = protocol + "//" + window.location.host + "/ws/eeg";

    ws = new WebSocket(url);

    ws.onopen = function () {
      connected = true;
      clearReconnectTimer();
      if (onStatusChange) onStatusChange("connected");
    };

    ws.onmessage = function (event) {
      try {
        var metrics = JSON.parse(event.data);
        if (onMetrics) onMetrics(metrics);
      } catch (e) {
        // ignore parse errors
      }
    };

    ws.onclose = function () {
      connected = false;
      if (onStatusChange) onStatusChange("disconnected");
      if (!intentionalClose) {
        scheduleReconnect();
      }
    };

    ws.onerror = function () {
      // onclose will fire after this
    };
  }

  function disconnect() {
    intentionalClose = true;
    clearReconnectTimer();
    if (ws) {
      ws.close();
      ws = null;
    }
    connected = false;
    if (onStatusChange) onStatusChange("disconnected");
  }

  function isConnected() {
    return connected;
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    reconnectTimer = setTimeout(function () {
      connect();
    }, 3000);
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  return {
    connect: connect,
    disconnect: disconnect,
    isConnected: isConnected,
    set onMetrics(fn) { onMetrics = fn; },
    get onMetrics() { return onMetrics; },
    set onStatusChange(fn) { onStatusChange = fn; },
    get onStatusChange() { return onStatusChange; },
  };
})();

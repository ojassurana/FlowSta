window.FlowState = window.FlowState || {};

window.FlowState.mic = (function () {
  var mediaRecorder = null;
  var audioChunks = [];
  var stream = null;
  var listening = false;
  var mimeType = "";

  // Callback set by app.js
  var onAudioCaptured = null;

  function getSupportedMime() {
    var types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "";
  }

  async function startListening() {
    if (listening) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      FlowState.toast.show(
        "Your browser doesn't support microphone access. Use the text input instead.",
        "error"
      );
      showTextFallback();
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      FlowState.toast.show(
        "Microphone access denied. You can type your instruction instead.",
        "warning"
      );
      showTextFallback();
      return;
    }

    mimeType = getSupportedMime();
    if (!mimeType) {
      FlowState.toast.show(
        "Audio recording not supported in this browser. Use text input.",
        "error"
      );
      showTextFallback();
      releaseStream();
      return;
    }

    audioChunks = [];
    listening = true;
    updateButtonState("listening");

    mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });

    mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = function () {
      var blob = new Blob(audioChunks, { type: mimeType });
      audioChunks = [];
      releaseStream();

      if (blob.size > 0 && onAudioCaptured) {
        updateButtonState("processing");
        onAudioCaptured(blob);
      } else {
        updateButtonState("idle");
      }
    };

    mediaRecorder.start(250);
  }

  function stopListening() {
    if (!listening) return;
    listening = false;

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  function releaseStream() {
    if (stream) {
      stream.getTracks().forEach(function (t) {
        t.stop();
      });
      stream = null;
    }
  }

  function isListening() {
    return listening;
  }

  function updateButtonState(state) {
    var btn = document.getElementById("mic-btn");
    var micIcon = document.getElementById("mic-icon");
    var stopIcon = document.getElementById("mic-stop-icon");
    var spinner = document.getElementById("mic-spinner");

    btn.className = "mic-" + state;

    micIcon.hidden = state !== "idle";
    stopIcon.hidden = state !== "listening";
    spinner.hidden = state !== "processing";
  }

  function showTextFallback() {
    document.getElementById("text-fallback").hidden = false;
    document.getElementById("text-input").focus();
  }

  function setIdleState() {
    updateButtonState("idle");
  }

  return {
    startListening: startListening,
    stopListening: stopListening,
    isListening: isListening,
    setIdleState: setIdleState,
    set onAudioCaptured(fn) {
      onAudioCaptured = fn;
    },
  };
})();

window.FlowState = window.FlowState || {};

window.FlowState.toast = (function () {
  const container = document.getElementById("toast-container");

  function show(message, type, duration) {
    type = type || "info";
    duration = duration || 4000;

    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(function () {
      el.classList.add("toast-out");
      el.addEventListener("animationend", function () {
        el.remove();
      });
    }, duration);

    return el;
  }

  function showTranscript(text) {
    return show('"' + text + '"', "transcript", 5000);
  }

  function showAmbiguity(note) {
    return show(note, "ambiguity", 8000);
  }

  function showFocusSummary(text) {
    return show(text, "focus-summary", 4000);
  }

  return { show: show, showTranscript: showTranscript, showAmbiguity: showAmbiguity, showFocusSummary: showFocusSummary };
})();

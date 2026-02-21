window.FlowState = window.FlowState || {};

window.FlowState.lockedIn = (function () {
  var FOCUS_THRESHOLD = 1.2;
  var SUSTAINED_MS = 8000;
  var COOLDOWN_MS = 60000;
  var PROMPT_DISMISS_MS = 10000;

  var focusStartTime = null;
  var lastDismissTime = 0;
  var promptVisible = false;
  var promptEl = null;
  var dismissTimer = null;

  function handleMetrics(metrics) {
    if (promptVisible) return;

    // Only track when signal is good
    if (metrics.signal_quality !== "good") {
      focusStartTime = null;
      return;
    }

    if (metrics.focus_index >= FOCUS_THRESHOLD) {
      if (!focusStartTime) {
        focusStartTime = Date.now();
      } else if (Date.now() - focusStartTime >= SUSTAINED_MS) {
        // Check cooldown
        if (Date.now() - lastDismissTime >= COOLDOWN_MS) {
          showPrompt();
          focusStartTime = null;
        }
      }
    } else {
      focusStartTime = null;
    }
  }

  function showPrompt() {
    if (promptVisible) return;
    promptVisible = true;

    promptEl = document.createElement("div");
    promptEl.id = "locked-in-prompt";
    promptEl.innerHTML =
      '<div class="locked-in-prompt-content">' +
        '<div class="locked-in-prompt-icon">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>' +
            '<circle cx="12" cy="12" r="3"/>' +
          '</svg>' +
        '</div>' +
        '<p class="locked-in-prompt-text">You seem locked in. Open focused reader?</p>' +
        '<div class="locked-in-prompt-actions">' +
          '<button class="locked-in-yes">Yes</button>' +
          '<button class="locked-in-no">Not now</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(promptEl);

    // Force reflow for animation
    promptEl.offsetHeight;
    promptEl.classList.add("visible");

    promptEl.querySelector(".locked-in-yes").addEventListener("click", function () {
      hidePrompt();
      openReader();
    });

    promptEl.querySelector(".locked-in-no").addEventListener("click", function () {
      lastDismissTime = Date.now();
      hidePrompt();
    });

    dismissTimer = setTimeout(function () {
      lastDismissTime = Date.now();
      hidePrompt();
    }, PROMPT_DISMISS_MS);
  }

  function hidePrompt() {
    promptVisible = false;
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    if (promptEl) {
      promptEl.classList.remove("visible");
      setTimeout(function () {
        if (promptEl && promptEl.parentNode) {
          promptEl.parentNode.removeChild(promptEl);
        }
        promptEl = null;
      }, 300);
    }
  }

  function openReader() {
    var FS = window.FlowState;
    var text = "";

    // Try to extract content from current page
    var blocks = FS.session ? FS.session.getExtractedBlocks() : null;
    var scoredMap = FS.session ? FS.session.getScoredMap() : null;

    if (blocks && blocks.length > 0) {
      var relevant = blocks;
      if (scoredMap) {
        relevant = blocks.filter(function (b) {
          var entry = scoredMap[b.id];
          return !entry || entry.score >= 0.4;
        });
      }
      text = relevant
        .map(function (b) { return b.text_content; })
        .filter(function (t) { return t && t.trim(); })
        .join("\n\n");
    }

    // Fallback: grab text from iframe
    if (!text && FS.urlLoader) {
      var root = FS.urlLoader.getContentRoot();
      if (root && root.body) {
        text = root.body.innerText || root.body.textContent || "";
      }
    }

    if (text) {
      try {
        localStorage.setItem("flowsta-reader-content", text);
      } catch (e) {
        // localStorage might be full
      }
    }

    window.open("/reader.html", "_blank");
  }

  // Allow manual trigger
  function openReaderManual() {
    openReader();
  }

  return {
    handleMetrics: handleMetrics,
    showPrompt: showPrompt,
    openReader: openReaderManual,
  };
})();

(function () {
  var FS = window.FlowState;

  // DOM references
  var urlForm = document.getElementById("url-form");
  var urlInput = document.getElementById("url-input");
  var micBtn = document.getElementById("mic-btn");
  var textForm = document.getElementById("text-form");
  var textInput = document.getElementById("text-input");
  var textFallback = document.getElementById("text-fallback");
  var textFallbackClose = document.getElementById("text-fallback-close");
  var resetBtn = document.getElementById("reset-btn");
  var focusViewToggle = document.getElementById("focus-view-toggle");
  var focusViewPanel = document.getElementById("focus-view-panel");
  var focusViewClose = document.getElementById("focus-view-close");
  var focusViewMeta = document.getElementById("focus-view-meta");
  var focusViewContent = document.getElementById("focus-view-content");
  var processing = false;

  // --- URL Loading ---
  urlForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var url = urlInput.value.trim();
    if (!url) return;

    try {
      hideFocusView(true);
      await FS.urlLoader.loadPage(url);
      FS.toast.show("Page loaded. Use the mic to set your focus.", "info", 3000);
    } catch (err) {
      FS.toast.show(err.message, "error");
    }
  });

  // --- Mic Button (toggle on/off, always available) ---
  micBtn.addEventListener("click", function () {
    if (FS.mic.isListening()) {
      FS.mic.stopListening();
    } else {
      FS.mic.startListening();
    }
  });

  // Audio captured callback (fires when user toggles mic OFF)
  FS.mic.onAudioCaptured = function (audioBlob) {
    handleFocusCommand(audioBlob, null);
  };

  // --- Text Fallback ---
  textForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = textInput.value.trim();
    if (!text) return;
    textInput.value = "";
    handleFocusCommand(null, text);
  });

  textFallbackClose.addEventListener("click", function () {
    textFallback.hidden = true;
  });

  // --- Keyboard Shortcuts ---
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === "F") {
      e.preventDefault();
      micBtn.click();
    }
    if (e.ctrlKey && e.shiftKey && e.key === "T") {
      e.preventDefault();
      textFallback.hidden = false;
      textInput.focus();
    }
  });

  // --- Reset Button ---
  resetBtn.addEventListener("click", function () {
    var root = getViewerRoot();
    if (root) {
      FS.transformer.resetAll(root);
      FS.session.reset();
      resetBtn.hidden = true;
      hideFocusView(true);
      FS.toast.show("Focus cleared.", "info", 2000);
      announce("Focus cleared. All content is now visible.");
    }
  });

  focusViewToggle.addEventListener("click", function () {
    if (!focusViewPanel.hidden) {
      hideFocusView(false);
      return;
    }
    renderAndShowFocusView();
  });

  focusViewClose.addEventListener("click", function () {
    hideFocusView(false);
  });

  // --- Main Pipeline ---
  async function handleFocusCommand(audioBlob, directText) {
    processing = true;
    hideFocusView(false);

    try {
      // Step 1: Transcribe
      var transcript;
      if (directText) {
        transcript = directText;
      } else {
        var result = await FS.api.transcribeAudio(audioBlob);
        transcript = result.transcript;
      }

      FS.mic.setIdleState();

      if (!transcript || transcript.trim().length === 0) {
        FS.toast.show(
          "I didn't catch that. Try again or use the text input.",
          "warning"
        );
        processing = false;
        return;
      }

      // Step 2: Show what the user said
      FS.toast.showTranscript(transcript);

      // Step 3: Interpret intent
      var priorIntent = FS.session.getActiveIntent();
      var interpretResult = await FS.api.interpretTranscript(
        transcript,
        priorIntent
      );
      var intent = interpretResult.intent;

      // Check ambiguity
      if (intent.confidence < 0.7 && intent.ambiguity_note) {
        FS.toast.showAmbiguity(intent.ambiguity_note);
      }

      // Check reset
      if (FS.session.isResetCommand(intent)) {
        var root = getViewerRoot();
        if (root) FS.transformer.resetAll(root);
        FS.session.reset();
        resetBtn.hidden = true;
        hideFocusView(true);
        FS.toast.show("Focus cleared — showing everything.", "info");
        announce("Focus cleared. All content is now visible.");
        processing = false;
        return;
      }

      // Step 4: Show what the AI will focus on, then wait before dimming
      var topicLabels = intent.topics
        .map(function (t) {
          return t.label;
        })
        .join(", ");

      var summaryPrefix =
        intent.merge_strategy === "ADD"
          ? "Adding focus: "
          : intent.merge_strategy === "SUBTRACT"
          ? "Removing focus: "
          : "Focusing on: ";

      FS.toast.showFocusSummary(summaryPrefix + topicLabels);

      // Brief pause so user can read the summary before the page changes
      await delay(2000);

      // Step 5: Merge intent
      FS.session.mergeIntent(intent);

      // Step 6: Extract content blocks
      var root = getViewerRoot();
      if (!root) {
        FS.toast.show("No page loaded. Enter a URL first.", "warning");
        processing = false;
        return;
      }

      var blocks = FS.session.getExtractedBlocks();
      if (!blocks) {
        blocks = FS.extractor.extractBlocks(root);
        FS.session.setExtractedBlocks(blocks);
      }

      if (blocks.length < 5) {
        FS.toast.show(
          "This page doesn't have enough content to filter.",
          "info"
        );
        processing = false;
        return;
      }

      // Step 7: Score (streaming — elements update as each batch completes)
      FS.transformer.showLoadingOverlay(root);
      var activeIntent = FS.session.getActiveIntent();
      var scoredMap = {};

      var scoreResult = await FS.api.scoreBlocksStreaming(
        activeIntent,
        blocks,
        function onBatch(batchScores) {
          batchScores.forEach(function (s) {
            scoredMap[s.id] = { score: s.score, reasoning: s.reasoning };
          });
          FS.transformer.applyScores(scoredMap, root);
        }
      );

      // Ensure final map is complete
      var scores = scoreResult.scores;
      scores.forEach(function (s) {
        scoredMap[s.id] = { score: s.score, reasoning: s.reasoning };
      });
      FS.session.setScoredMap(scoredMap);

      // Step 8: Final transform + hide overlay
      FS.transformer.applyScores(scoredMap, root);
      FS.transformer.hideLoadingOverlay(root);

      // Step 9: Scroll to first relevant
      FS.transformer.scrollToFirstRelevant(scoredMap, root);

      // Show reset button
      resetBtn.hidden = false;
      focusViewToggle.hidden = false;

      // Summary announcement
      var highlighted = scores.filter(function (s) {
        return s.score >= 0.9;
      }).length;
      var dimmed = scores.filter(function (s) {
        return s.score < 0.4;
      }).length;

      var allTopics = activeIntent.topics
        .map(function (t) {
          return t.label;
        })
        .join(", ");

      FS.toast.show(
        "Done — " + highlighted + " sections highlighted, " + dimmed + " dimmed.",
        "info",
        4000
      );
      announce(
        "Focus applied. Showing " +
          allTopics +
          ". " +
          highlighted +
          " sections highlighted, " +
          dimmed +
          " sections dimmed."
      );
    } catch (err) {
      var errorRoot = getViewerRoot();
      if (errorRoot) FS.transformer.hideLoadingOverlay(errorRoot);
      FS.toast.show(
        err.message || "Something went wrong. Please try again.",
        "error"
      );
      FS.mic.setIdleState();
    } finally {
      processing = false;
    }
  }

  function getViewerRoot() {
    var doc = FS.urlLoader.getContentRoot();
    return doc ? doc.body : null;
  }

  function announce(text) {
    var announcer = document.getElementById("aria-announcer");
    if (announcer) announcer.textContent = text;
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function hideFocusView(hideButton) {
    focusViewPanel.hidden = true;
    focusViewToggle.classList.remove("active");
    if (hideButton) {
      focusViewToggle.hidden = true;
    }
  }

  function renderAndShowFocusView() {
    var blocks = FS.session.getExtractedBlocks() || [];
    var scoredMap = FS.session.getScoredMap() || {};
    var activeIntent = FS.session.getActiveIntent();
    var topics = activeIntent
      ? activeIntent.topics
          .map(function (t) {
            return t.label;
          })
          .join(", ")
      : "current focus";

    var selected = blocks.filter(function (b) {
      var entry = scoredMap[b.id];
      return entry && entry.score >= 0.7;
    });

    focusViewContent.innerHTML = "";

    if (!selected.length) {
      focusViewMeta.textContent = "No focused sections found for this filter.";
      focusViewPanel.hidden = false;
      focusViewToggle.classList.add("active");
      return;
    }

    selected.forEach(function (block) {
      var card = document.createElement("article");
      card.className = "focus-view-card";

      var header = document.createElement("div");
      header.className = "focus-view-card-header";
      header.textContent =
        block.context && block.context.parent_heading
          ? block.context.parent_heading
          : block.element_type;

      var body = document.createElement("div");
      body.className = "focus-view-card-body";
      body.textContent = block.text_content || "[Non-text content]";

      card.appendChild(header);
      card.appendChild(body);
      focusViewContent.appendChild(card);
    });

    focusViewMeta.textContent =
      "Showing " +
      selected.length +
      " focused blocks for: " +
      topics +
      ".";
    focusViewPanel.hidden = false;
    focusViewToggle.classList.add("active");
  }
})();

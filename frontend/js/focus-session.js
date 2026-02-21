window.FlowState = window.FlowState || {};

window.FlowState.session = (function () {
  var state = {
    url: null,
    baseUrl: null,
    title: null,
    history: [],
    activeIntent: null,
    scoredMap: null,
    isActive: false,
    extractedBlocks: null,
  };

  function setPage(url, baseUrl, title) {
    state.url = url;
    state.baseUrl = baseUrl;
    state.title = title;
    state.history = [];
    state.activeIntent = null;
    state.scoredMap = null;
    state.isActive = false;
    state.extractedBlocks = null;
  }

  function mergeIntent(newIntent) {
    if (!state.activeIntent || newIntent.merge_strategy === "REPLACE") {
      state.activeIntent = JSON.parse(JSON.stringify(newIntent));
    } else if (newIntent.merge_strategy === "ADD") {
      var merged = JSON.parse(JSON.stringify(state.activeIntent));
      merged.topics = merged.topics.concat(newIntent.topics);
      state.activeIntent = merged;
    } else if (newIntent.merge_strategy === "SUBTRACT") {
      var merged = JSON.parse(JSON.stringify(state.activeIntent));
      var removeLabels = newIntent.topics.map(function (t) {
        return t.label.toLowerCase();
      });
      merged.topics = merged.topics.filter(function (t) {
        var label = t.label.toLowerCase();
        return !removeLabels.some(function (rl) {
          return label.indexOf(rl) !== -1 || rl.indexOf(label) !== -1;
        });
      });
      state.activeIntent = merged;
    }

    state.history.push(JSON.parse(JSON.stringify(newIntent)));
    state.isActive = true;
  }

  function undo() {
    if (state.history.length < 2) {
      return null;
    }
    state.history.pop();
    var prev = state.history[state.history.length - 1];
    state.activeIntent = JSON.parse(JSON.stringify(prev));
    return state.activeIntent;
  }

  function reset() {
    state.activeIntent = null;
    state.scoredMap = null;
    state.isActive = false;
  }

  function isResetCommand(intent) {
    return (
      intent.topics.length === 0 && intent.merge_strategy === "REPLACE"
    );
  }

  function getActiveIntent() {
    return state.activeIntent
      ? JSON.parse(JSON.stringify(state.activeIntent))
      : null;
  }

  function getScoredMap() {
    return state.scoredMap;
  }

  function setScoredMap(map) {
    state.scoredMap = map;
  }

  function isActive() {
    return state.isActive;
  }

  function setExtractedBlocks(blocks) {
    state.extractedBlocks = blocks;
  }

  function getExtractedBlocks() {
    return state.extractedBlocks;
  }

  return {
    setPage: setPage,
    mergeIntent: mergeIntent,
    undo: undo,
    reset: reset,
    isResetCommand: isResetCommand,
    getActiveIntent: getActiveIntent,
    getScoredMap: getScoredMap,
    setScoredMap: setScoredMap,
    isActive: isActive,
    setExtractedBlocks: setExtractedBlocks,
    getExtractedBlocks: getExtractedBlocks,
  };
})();

window.FlowState = window.FlowState || {};

window.FlowState.api = (function () {
  async function request(url, options) {
    var resp;
    try {
      resp = await fetch(url, options);
    } catch (err) {
      throw new Error("Network error: check your connection and try again.");
    }

    if (!resp.ok) {
      var body;
      try {
        body = await resp.json();
      } catch (_) {
        throw new Error("Request failed with status " + resp.status);
      }
      throw new Error(body.detail || body.error || "Request failed");
    }

    return resp.json();
  }

  async function fetchPage(url) {
    return request("/api/fetch-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url }),
    });
  }

  async function transcribeAudio(audioBlob) {
    var formData = new FormData();
    var ext = "webm";
    if (audioBlob.type && audioBlob.type.indexOf("ogg") !== -1) ext = "ogg";
    if (audioBlob.type && audioBlob.type.indexOf("mp4") !== -1) ext = "mp4";
    formData.append("audio", audioBlob, "recording." + ext);

    return request("/api/transcribe", {
      method: "POST",
      body: formData,
    });
  }

  async function interpretTranscript(transcript, priorIntent) {
    return request("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: transcript,
        prior_intent: priorIntent || null,
      }),
    });
  }

  async function scoreBlocks(intent, blocks) {
    return request("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: intent,
        blocks: blocks,
      }),
    });
  }

  async function scoreBlocksStreaming(intent, blocks, onBatch) {
    var resp;
    try {
      resp = await fetch("/api/score-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intent, blocks: blocks }),
      });
    } catch (err) {
      throw new Error("Network error: check your connection and try again.");
    }

    if (!resp.ok) {
      var body;
      try { body = await resp.json(); } catch (_) {}
      throw new Error((body && (body.detail || body.error)) || "Scoring failed");
    }

    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var allScores = [];

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      var lines = buffer.split("\n");
      buffer = lines.pop();

      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
          var data = JSON.parse(lines[i]);
          allScores = allScores.concat(data.scores);
          if (onBatch) onBatch(data.scores, allScores);
        }
      }
    }

    if (buffer.trim()) {
      var data = JSON.parse(buffer);
      allScores = allScores.concat(data.scores);
      if (onBatch) onBatch(data.scores, allScores);
    }

    return { scores: allScores };
  }

  return {
    fetchPage: fetchPage,
    transcribeAudio: transcribeAudio,
    interpretTranscript: interpretTranscript,
    scoreBlocks: scoreBlocks,
    scoreBlocksStreaming: scoreBlocksStreaming,
  };
})();

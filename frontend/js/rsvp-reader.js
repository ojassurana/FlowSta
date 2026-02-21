(function () {
  var words = [];
  var currentIndex = 0;
  var playing = false;
  var wpm = 300;
  var timer = null;

  // DOM refs
  var wordDisplay = document.getElementById("rsvp-word");
  var paragraphView = document.getElementById("rsvp-paragraph");
  var playBtn = document.getElementById("rsvp-play");
  var speedSlider = document.getElementById("rsvp-speed");
  var speedLabel = document.getElementById("rsvp-speed-label");
  var backBtn = document.getElementById("rsvp-back");
  var forwardBtn = document.getElementById("rsvp-forward");
  var exitBtn = document.getElementById("rsvp-exit");
  var progressBar = document.getElementById("rsvp-progress-fill");

  function init() {
    var content = "";
    try {
      content = localStorage.getItem("flowsta-reader-content") || "";
    } catch (e) {
      // ignore
    }

    if (!content) {
      wordDisplay.textContent = "No content loaded";
      return;
    }

    // Tokenize into words
    words = content.split(/\s+/).filter(function (w) { return w.length > 0; });
    if (words.length === 0) {
      wordDisplay.textContent = "No content loaded";
      return;
    }

    buildParagraphView();
    showWord(0);
    setupControls();
    setupKeyboard();
  }

  function buildParagraphView() {
    paragraphView.innerHTML = "";
    for (var i = 0; i < words.length; i++) {
      var span = document.createElement("span");
      span.className = "rsvp-word-item";
      span.textContent = words[i] + " ";
      span.dataset.index = i;
      span.addEventListener("click", function () {
        var idx = parseInt(this.dataset.index, 10);
        pause();
        showWord(idx);
      });
      paragraphView.appendChild(span);
    }
  }

  function showWord(index) {
    if (index < 0) index = 0;
    if (index >= words.length) {
      index = words.length - 1;
      pause();
    }
    currentIndex = index;

    var word = words[currentIndex];
    renderORPWord(word);
    highlightParagraph();
    updateProgress();
  }

  function renderORPWord(word) {
    wordDisplay.innerHTML = "";
    if (!word) return;

    // ORP: Optimal Recognition Point
    // For short words (1-4), fixate on first letter
    // For 5-8, fixate on second letter
    // For 9+, fixate on third letter
    var orpIndex = 0;
    var len = word.length;
    if (len <= 4) orpIndex = 0;
    else if (len <= 8) orpIndex = 1;
    else orpIndex = 2;

    var before = word.substring(0, orpIndex);
    var orp = word.charAt(orpIndex);
    var after = word.substring(orpIndex + 1);

    if (before) {
      var span1 = document.createElement("span");
      span1.textContent = before;
      wordDisplay.appendChild(span1);
    }

    var orpSpan = document.createElement("span");
    orpSpan.className = "orp-letter";
    orpSpan.textContent = orp;
    wordDisplay.appendChild(orpSpan);

    if (after) {
      var span2 = document.createElement("span");
      span2.textContent = after;
      wordDisplay.appendChild(span2);
    }
  }

  function highlightParagraph() {
    var items = paragraphView.querySelectorAll(".rsvp-word-item");
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (i === currentIndex) {
        item.classList.add("current");
        item.classList.remove("dimmed");
        // Scroll into view in paragraph
        item.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        item.classList.remove("current");
        item.classList.add("dimmed");
      }
    }
  }

  function updateProgress() {
    if (words.length > 0) {
      var pct = ((currentIndex + 1) / words.length) * 100;
      progressBar.style.width = pct + "%";
    }
  }

  function play() {
    if (playing) return;
    if (currentIndex >= words.length - 1) {
      currentIndex = 0;
    }
    playing = true;
    playBtn.textContent = "Pause";
    playBtn.classList.add("active");
    tick();
  }

  function pause() {
    playing = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    playBtn.textContent = "Play";
    playBtn.classList.remove("active");
  }

  function togglePlay() {
    if (playing) pause();
    else play();
  }

  function tick() {
    if (!playing) return;
    showWord(currentIndex + 1);
    if (currentIndex >= words.length - 1) {
      pause();
      return;
    }
    var ms = 60000 / wpm;
    timer = setTimeout(tick, ms);
  }

  function setSpeed(newWpm) {
    wpm = Math.max(100, Math.min(800, newWpm));
    speedSlider.value = wpm;
    speedLabel.textContent = wpm + " WPM";
    // If playing, restart timing
    if (playing) {
      if (timer) clearTimeout(timer);
      var ms = 60000 / wpm;
      timer = setTimeout(tick, ms);
    }
  }

  function stepBack() {
    pause();
    showWord(currentIndex - 1);
  }

  function stepForward() {
    pause();
    showWord(currentIndex + 1);
  }

  function setupControls() {
    playBtn.addEventListener("click", togglePlay);

    speedSlider.value = wpm;
    speedLabel.textContent = wpm + " WPM";
    speedSlider.addEventListener("input", function () {
      setSpeed(parseInt(this.value, 10));
    });

    backBtn.addEventListener("click", stepBack);
    forwardBtn.addEventListener("click", stepForward);

    exitBtn.addEventListener("click", function () {
      window.close();
      // Fallback if window.close doesn't work
      window.location.href = "/";
    });
  }

  function setupKeyboard() {
    document.addEventListener("keydown", function (e) {
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          stepBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          stepForward();
          break;
        case "ArrowUp":
          e.preventDefault();
          setSpeed(wpm + 25);
          break;
        case "ArrowDown":
          e.preventDefault();
          setSpeed(wpm - 25);
          break;
        case "Escape":
          e.preventDefault();
          window.close();
          window.location.href = "/";
          break;
      }
    });
  }

  // Init on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

window.FlowState = window.FlowState || {};

window.FlowState.transformer = (function () {
  var ACCENT_COLOR = "#4F46E5";

  function computeOpacity(score) {
    if (score >= 0.7) return 1.0;
    if (score >= 0.4) return 0.25 + (score - 0.4) * 2.5;
    if (score >= 0.15) return 0.10 + (score - 0.15) * 0.6;
    return 0.06;
  }

  function computeFilter(score) {
    if (score >= 0.7) return "none";
    if (score >= 0.4) return "grayscale(50%)";
    return "grayscale(80%) blur(0.5px)";
  }

  function applyScores(scoredMap, rootElement) {
    // First, propagate scores
    propagateScores(scoredMap, rootElement);

    // Apply visual treatment to each scored element
    var elements = rootElement.querySelectorAll("[data-flowstate-id]");
    elements.forEach(function (el) {
      var id = el.getAttribute("data-flowstate-id");
      var entry = scoredMap[id];
      if (!entry) return;

      var score = entry.score;
      var opacity = computeOpacity(score);
      var filter = computeFilter(score);

      el.style.opacity = opacity;
      el.style.filter = filter;
      el.style.pointerEvents = score < 0.4 ? "none" : "auto";

      // Accent border for highly relevant content
      if (score >= 0.9) {
        el.style.borderLeft = "3px solid " + ACCENT_COLOR;
        el.style.paddingLeft = el.style.paddingLeft || "8px";
      } else {
        el.style.borderLeft = "";
      }
    });
  }

  function propagateScores(scoredMap, rootElement) {
    // Rule: headings influence siblings
    var headings = rootElement.querySelectorAll("h1[data-flowstate-id],h2[data-flowstate-id],h3[data-flowstate-id],h4[data-flowstate-id],h5[data-flowstate-id],h6[data-flowstate-id]");

    headings.forEach(function (heading) {
      var hId = heading.getAttribute("data-flowstate-id");
      var hEntry = scoredMap[hId];
      if (!hEntry || hEntry.score < 0.7) return;

      // Boost siblings that follow this heading
      var sibling = heading.nextElementSibling;
      while (sibling) {
        if (/^H[1-6]$/.test(sibling.tagName)) break; // Stop at next heading
        var sId = sibling.getAttribute("data-flowstate-id");
        if (sId && scoredMap[sId] && scoredMap[sId].score < 0.5) {
          scoredMap[sId].score = 0.5;
        }
        // Also check children of the sibling
        var children = sibling.querySelectorAll("[data-flowstate-id]");
        children.forEach(function (child) {
          var cId = child.getAttribute("data-flowstate-id");
          if (cId && scoredMap[cId] && scoredMap[cId].score < 0.5) {
            scoredMap[cId].score = 0.5;
          }
        });
        sibling = sibling.nextElementSibling;
      }
    });

    // Rule: ul/ol inherits max score of li children
    var lists = rootElement.querySelectorAll("ul[data-flowstate-id], ol[data-flowstate-id]");
    lists.forEach(function (list) {
      var listId = list.getAttribute("data-flowstate-id");
      if (!listId || !scoredMap[listId]) return;

      var maxChildScore = 0;
      var items = list.querySelectorAll("li[data-flowstate-id]");
      items.forEach(function (li) {
        var liId = li.getAttribute("data-flowstate-id");
        if (liId && scoredMap[liId]) {
          maxChildScore = Math.max(maxChildScore, scoredMap[liId].score);
        }
      });
      if (maxChildScore > scoredMap[listId].score) {
        scoredMap[listId].score = maxChildScore;
      }
    });

    // Rule: if any child >= 0.9, container gets at least 0.7
    var containers = rootElement.querySelectorAll("[data-flowstate-id]");
    containers.forEach(function (container) {
      var cId = container.getAttribute("data-flowstate-id");
      if (!cId || !scoredMap[cId]) return;

      var children = container.querySelectorAll("[data-flowstate-id]");
      var hasHighChild = false;
      children.forEach(function (child) {
        var childId = child.getAttribute("data-flowstate-id");
        if (childId && scoredMap[childId] && scoredMap[childId].score >= 0.9) {
          hasHighChild = true;
        }
      });
      if (hasHighChild && scoredMap[cId].score < 0.7) {
        scoredMap[cId].score = 0.7;
      }
    });
  }

  function resetAll(rootElement) {
    var elements = rootElement.querySelectorAll("[data-flowstate-id]");
    elements.forEach(function (el) {
      el.style.opacity = "";
      el.style.filter = "";
      el.style.pointerEvents = "";
      el.style.borderLeft = "";
      el.style.paddingLeft = "";
    });
  }

  function scrollToFirstRelevant(scoredMap, rootElement) {
    // Find the first element in DOM order with score >= 0.9
    var elements = rootElement.querySelectorAll("[data-flowstate-id]");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (var i = 0; i < elements.length; i++) {
      var id = elements[i].getAttribute("data-flowstate-id");
      if (scoredMap[id] && scoredMap[id].score >= 0.9) {
        elements[i].scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "center",
        });
        return;
      }
    }
  }

  function showLoadingOverlay(rootElement) {
    var doc = rootElement.ownerDocument;
    if (rootElement.querySelector("#fs-loading-overlay")) return;

    // Inject keyframes if not already present
    if (!doc.getElementById("fs-loading-styles")) {
      var style = doc.createElement("style");
      style.id = "fs-loading-styles";
      style.textContent = "@keyframes fs-spin{to{transform:rotate(360deg)}}@keyframes fs-pulse{0%,100%{opacity:1}50%{opacity:.5}}";
      doc.head.appendChild(style);
    }

    var overlay = doc.createElement("div");
    overlay.id = "fs-loading-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.65);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);transition:opacity 0.3s ease;";

    var inner = doc.createElement("div");
    inner.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:14px;";

    var spinner = doc.createElement("div");
    spinner.style.cssText = "width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#4F46E5;border-radius:50%;animation:fs-spin 0.6s linear infinite;";

    var label = doc.createElement("div");
    label.style.cssText = "font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#475569;font-weight:500;animation:fs-pulse 1.5s ease-in-out infinite;";
    label.textContent = "Applying focus\u2026";

    inner.appendChild(spinner);
    inner.appendChild(label);
    overlay.appendChild(inner);
    rootElement.appendChild(overlay);
  }

  function hideLoadingOverlay(rootElement) {
    var overlay = rootElement.querySelector("#fs-loading-overlay");
    if (!overlay) return;
    overlay.style.opacity = "0";
    setTimeout(function () { overlay.remove(); }, 300);
  }

  return {
    applyScores: applyScores,
    resetAll: resetAll,
    scrollToFirstRelevant: scrollToFirstRelevant,
    showLoadingOverlay: showLoadingOverlay,
    hideLoadingOverlay: hideLoadingOverlay,
  };
})();

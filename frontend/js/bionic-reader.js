window.FlowState = window.FlowState || {};

window.FlowState.bionic = (function () {
  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1,
    SVG: 1, MATH: 1, NOSCRIPT: 1,
  };
  var MARKER_ATTR = "data-bionic-processed";
  var enabled = false;
  var originalNodes = [];

  function enable(root) {
    if (enabled) return;
    if (!root) return;
    enabled = true;
    originalNodes = [];
    walkTextNodes(root);
  }

  function disable(root) {
    if (!enabled) return;
    enabled = false;
    // Restore original text nodes
    for (var i = 0; i < originalNodes.length; i++) {
      var entry = originalNodes[i];
      if (entry.wrapper && entry.wrapper.parentNode) {
        entry.wrapper.parentNode.replaceChild(entry.original, entry.wrapper);
      }
    }
    originalNodes = [];
    // Remove markers
    if (root) {
      var marked = root.querySelectorAll("[" + MARKER_ATTR + "]");
      for (var j = 0; j < marked.length; j++) {
        marked[j].removeAttribute(MARKER_ATTR);
      }
    }
  }

  function isEnabled() {
    return enabled;
  }

  function walkTextNodes(node) {
    if (!node) return;
    if (node.nodeType === 1) {
      if (SKIP_TAGS[node.tagName]) return;
      if (node.hasAttribute(MARKER_ATTR)) return;
      var children = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < children.length; i++) {
        walkTextNodes(children[i]);
      }
    } else if (node.nodeType === 3) {
      processTextNode(node);
    }
  }

  function processTextNode(textNode) {
    var text = textNode.textContent;
    if (!text || !text.trim()) return;

    var words = text.split(/(\s+)/);
    if (words.length <= 1 && !text.trim()) return;

    var span = document.createElement("span");
    span.setAttribute(MARKER_ATTR, "1");

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (!word) continue;

      if (/^\s+$/.test(word)) {
        span.appendChild(document.createTextNode(word));
        continue;
      }

      var boldLen = getBoldLength(word);
      if (boldLen > 0 && boldLen < word.length) {
        var b = document.createElement("b");
        b.className = "bionic-bold";
        b.textContent = word.substring(0, boldLen);
        span.appendChild(b);
        span.appendChild(document.createTextNode(word.substring(boldLen)));
      } else {
        span.appendChild(document.createTextNode(word));
      }
    }

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(span, textNode);
      originalNodes.push({ wrapper: span, original: textNode });
    }
  }

  function getBoldLength(word) {
    // Strip punctuation for length calc
    var letters = word.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, "");
    var len = letters.length;
    if (len <= 1) return 0;
    if (len <= 3) return 1;
    return Math.ceil(len / 2);
  }

  return {
    enable: enable,
    disable: disable,
    isEnabled: isEnabled,
  };
})();

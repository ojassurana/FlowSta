window.FlowState = window.FlowState || {};

window.FlowState.extractor = (function () {
  var BLOCK_TAGS = [
    "h1","h2","h3","h4","h5","h6",
    "p",
    "li",
    "tr",
    "img",
    "figure",
    "blockquote",
    "pre",
    "form",
    "video","audio",
    "details",
    "summary",
    "table",
  ];

  var STRUCTURAL_TAGS = ["nav", "aside", "footer", "header"];

  var AD_PATTERNS = /\b(ad|ads|advert|banner|sponsor|promo|cookie|consent|popup|modal|newsletter|subscribe)\b/i;

  var DEFAULT_SCORES = {
    navigation: 0.3,
    sidebar: 0.2,
    footer: 0.15,
    ad: 0.05,
    header: 0.5,
    content: 0.5,
  };

  var MAX_BLOCKS = 500;

  function extractBlocks(rootElement) {
    var blocks = [];
    var taggedElements = new Set();
    var counter = 0;

    // First, tag structural containers
    STRUCTURAL_TAGS.forEach(function (tag) {
      var elements = rootElement.querySelectorAll(tag);
      elements.forEach(function (el) {
        if (counter >= MAX_BLOCKS) return;
        var id = "fs-block-" + counter++;
        el.setAttribute("data-flowstate-id", id);
        taggedElements.add(el);
        blocks.push(buildBlock(el, id, rootElement));
      });
    });

    // Then, tag content blocks
    var selector = BLOCK_TAGS.join(",");
    var elements = rootElement.querySelectorAll(selector);

    elements.forEach(function (el) {
      if (counter >= MAX_BLOCKS) return;
      if (taggedElements.has(el)) return;

      // Skip elements inside already-tagged leaf blocks (p, li, etc.)
      var dominated = false;
      taggedElements.forEach(function (tagged) {
        if (tagged !== el && tagged.contains(el) && isLeafBlock(tagged)) {
          dominated = true;
        }
      });
      if (dominated) return;

      // Skip elements with no meaningful content
      var text = getTextContent(el);
      if (!text && el.tagName.toLowerCase() !== "img") return;

      var id = "fs-block-" + counter++;
      el.setAttribute("data-flowstate-id", id);
      taggedElements.add(el);
      blocks.push(buildBlock(el, id, rootElement));
    });

    // Also tag significant divs/sections that have direct text
    if (counter < MAX_BLOCKS) {
      var containers = rootElement.querySelectorAll("section, article, div, main");
      containers.forEach(function (el) {
        if (counter >= MAX_BLOCKS) return;
        if (taggedElements.has(el)) return;

        // Only tag if it has substantial direct text content not covered by children
        var directText = getDirectText(el);
        if (directText.length < 30) return;

        var id = "fs-block-" + counter++;
        el.setAttribute("data-flowstate-id", id);
        taggedElements.add(el);
        blocks.push(buildBlock(el, id, rootElement));
      });
    }

    return blocks;
  }

  function buildBlock(el, id, root) {
    var tag = el.tagName.toLowerCase();
    var textContent = getTextContent(el);

    // For images, use alt text
    if (tag === "img") {
      textContent = (el.getAttribute("alt") || "") + " " + (el.getAttribute("title") || "");
      textContent = textContent.trim();
    }

    // Truncate to 500 chars for API efficiency
    if (textContent.length > 500) {
      textContent = textContent.substring(0, 500) + "...";
    }

    return {
      id: id,
      element_type: tag,
      text_content: textContent,
      context: {
        parent_heading: findNearestHeading(el, root),
        section_path: buildSectionPath(el, root),
        surrounding_text: getSurroundingText(el),
      },
      structural_role: classifyRole(el),
      default_score: DEFAULT_SCORES[classifyRole(el)] || 0.5,
    };
  }

  function classifyRole(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === "nav") return "navigation";
    if (tag === "aside") return "sidebar";
    if (tag === "footer") return "footer";
    if (tag === "header") return "header";

    var classId = ((el.className || "") + " " + (el.id || "")).toLowerCase();
    if (AD_PATTERNS.test(classId)) return "ad";

    var role = el.getAttribute("role");
    if (role === "banner") return "header";
    if (role === "navigation") return "navigation";
    if (role === "contentinfo") return "footer";
    if (role === "complementary") return "sidebar";

    // Check ancestors for structural context
    var ancestor = el.closest("nav");
    if (ancestor) return "navigation";
    ancestor = el.closest("aside");
    if (ancestor) return "sidebar";
    ancestor = el.closest("footer");
    if (ancestor) return "footer";
    ancestor = el.closest("header");
    if (ancestor) return "header";

    return "content";
  }

  function getTextContent(el) {
    return (el.innerText || el.textContent || "").trim();
  }

  function getDirectText(el) {
    var text = "";
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
        text += el.childNodes[i].textContent;
      }
    }
    return text.trim();
  }

  function isLeafBlock(el) {
    var tag = el.tagName.toLowerCase();
    return ["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "img", "blockquote", "pre", "summary"].indexOf(tag) !== -1;
  }

  function findNearestHeading(el, root) {
    // Walk backwards through previous siblings and ancestors
    var current = el;
    while (current && current !== root) {
      var prev = current.previousElementSibling;
      while (prev) {
        if (/^H[1-6]$/.test(prev.tagName)) {
          return getTextContent(prev);
        }
        prev = prev.previousElementSibling;
      }
      current = current.parentElement;
    }
    return "";
  }

  function buildSectionPath(el, root) {
    var path = [];
    var current = el.parentElement;
    while (current && current !== root) {
      // Check for heading children at the start of sections
      var firstHeading = current.querySelector("h1,h2,h3,h4,h5,h6");
      if (firstHeading && !current.querySelector("[data-flowstate-id]")) {
        var headingText = getTextContent(firstHeading);
        if (headingText && path.indexOf(headingText) === -1) {
          path.unshift(headingText);
        }
      }
      current = current.parentElement;
    }
    return path.slice(0, 5); // Limit depth
  }

  function getSurroundingText(el) {
    var parts = [];
    var prev = el.previousElementSibling;
    if (prev) {
      var t = getTextContent(prev);
      if (t) parts.push(t.substring(0, 50));
    }
    var next = el.nextElementSibling;
    if (next) {
      var t2 = getTextContent(next);
      if (t2) parts.push(t2.substring(0, 50));
    }
    return parts.join(" ... ");
  }

  return { extractBlocks: extractBlocks };
})();

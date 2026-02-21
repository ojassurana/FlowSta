window.FlowState = window.FlowState || {};

window.FlowState.urlLoader = (function () {
  var viewer = document.getElementById("viewer");
  var viewerContainer = document.getElementById("viewer-container");
  var emptyState = document.getElementById("empty-state");
  var loadingIndicator = document.getElementById("loading-indicator");
  var micBtn = document.getElementById("mic-btn");
  var iframe = null;
  var currentBlobUrl = null;

  function getContentRoot() {
    if (!iframe || !iframe.contentDocument) return null;
    return iframe.contentDocument;
  }

  async function loadPage(url) {
    loadingIndicator.hidden = false;
    micBtn.disabled = true;

    try {
      var result = await FlowState.api.fetchPage(url);

      FlowState.session.setPage(url, result.base_url, result.title);

      // Clean up old iframe and blob URL
      if (iframe) {
        iframe.remove();
      }
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }

      // Inject FlowState transition styles into the page HTML
      var transitionStyles =
        "<style id='fs-transform-styles'>" +
        "[data-flowstate-id] {" +
        "  transition: opacity 150ms ease-out," +
        "              filter 150ms ease-out," +
        "              border-left 150ms ease-out;" +
        "}" +
        "@media (prefers-reduced-motion: reduce) {" +
        "  [data-flowstate-id] {" +
        "    transition-duration: 0ms !important;" +
        "  }" +
        "}" +
        "</style>";

      var html = result.html;
      var headCloseIdx = html.indexOf("</head>");
      if (headCloseIdx !== -1) {
        html = html.slice(0, headCloseIdx) + transitionStyles + html.slice(headCloseIdx);
      } else {
        html = transitionStyles + html;
      }

      // Use blob URL instead of srcdoc — handles large pages better
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      currentBlobUrl = URL.createObjectURL(blob);

      iframe = document.createElement("iframe");
      iframe.id = "fs-viewer-frame";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.style.display = "block";
      iframe.src = currentBlobUrl;

      viewer.innerHTML = "";
      viewer.appendChild(iframe);

      viewerContainer.classList.add("has-content");
      emptyState.style.display = "none";

      // Wait for iframe to load
      await new Promise(function (resolve) {
        iframe.onload = resolve;
        setTimeout(resolve, 10000);
      });

      micBtn.disabled = false;

      if (result.title) {
        document.title = "FlowState - " + result.title;
      }
    } finally {
      loadingIndicator.hidden = true;
    }
  }

  return {
    loadPage: loadPage,
    getContentRoot: getContentRoot,
  };
})();

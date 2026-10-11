/**
 * DDBI Utilities Extension: Foundry bridge (content script).
 *
 * Registered only for Foundry sites the user connected in the popup. Relays between the
 * DDB Importer module in the page (window.postMessage on this window) and the background worker,
 * which holds the cookie access. The cookie is only sent in answer to the module's request.
 */
(() => {
  if (globalThis.__ddbiFoundryBridge) return;
  globalThis.__ddbiFoundryBridge = true;

  const PAGE_SOURCE = "ddb-importer";
  const EXTENSION_SOURCE = "ddbi-utilities-extension";
  const version = chrome.runtime.getManifest().version;

  const post = (type, data = {}) => {
    window.postMessage({ source: EXTENSION_SOURCE, type, ...data }, window.location.origin);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.source !== PAGE_SOURCE) return;

    if (data.type === "ddbi-hello") {
      post("ddbi-ready", { version });
    } else if (data.type === "ddbi-cobalt-request") {
      chrome.runtime.sendMessage({ type: "get-cobalt" })
        .then((response) => post("ddbi-cobalt", { requestId: data.requestId, cobalt: response?.cobalt ?? null }))
        .catch(() => post("ddbi-cobalt", { requestId: data.requestId, cobalt: null }));
    }
  });

  // requests from D&D Beyond pages, routed here by the background worker
  const ACK_TIMEOUT_MS = 3000;
  const RESULT_TIMEOUT_MS = 10 * 60 * 1000;
  const requests = new Map();
  let nextRequestId = 1;

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.source !== PAGE_SOURCE) return;
    const request = requests.get(data.requestId);
    if (!request) return;
    if (data.type === "ddbi-request-ack") {
      if (request.detach) {
        request.finish({ success: true, message: "Started in Foundry. DDB Importer shows its progress there." });
        return;
      }
      clearTimeout(request.timer);
      request.timer = setTimeout(() => request.finish({ success: false, message: "DDB Importer did not finish in time." }), RESULT_TIMEOUT_MS);
    } else if (data.type === "ddbi-request-result") {
      request.finish({ success: Boolean(data.success), message: String(data.message ?? ""), data: data.data });
    }
  });

  function relayRequest(request, payload, detach) {
    return new Promise((resolve) => {
      const requestId = `ext-${nextRequestId++}`;
      const entry = {
        detach,
        // no acknowledgement means no module here to handle it: answer null so other tabs are tried
        timer: setTimeout(() => entry.finish(null), ACK_TIMEOUT_MS),
        finish: (result) => {
          clearTimeout(entry.timer);
          requests.delete(requestId);
          resolve(result);
        },
      };
      requests.set(requestId, entry);
      post("ddbi-request", { requestId, request, payload });
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "cobalt-changed") {
      post("ddbi-cobalt-changed");
      return false;
    }
    if (message?.type === "extension-request") {
      relayRequest(message.request, message.payload, Boolean(message.detach)).then(sendResponse);
      return true;
    }
    return false;
  });

  // the module may have said hello before this script loaded
  post("ddbi-ready", { version });
})();

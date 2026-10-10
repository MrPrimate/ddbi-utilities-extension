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

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "cobalt-changed") post("ddbi-cobalt-changed");
  });

  // the module may have said hello before this script loaded
  post("ddbi-ready", { version });
})();

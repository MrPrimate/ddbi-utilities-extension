/**
 * DDBI Utilities Extension: sheet refresh
 *
 * Runs in the page context of a D&D Beyond character sheet, before the sheet's own scripts. The
 * sheet opens a game-log WebSocket for the character's campaign; DDB's server broadcasts
 * `character-sheet/character-update/fulfilled` on it after every character-service write, but the
 * sheet has no handler for that event, so changes made elsewhere (another tab, DDB Maps, the
 * ddb-importer Foundry sync) only show after a manual reload. This script listens on the sheet's
 * own socket and reloads the page when the open character is changed from somewhere else, which
 * is what DDB Maps does for the sheet it embeds.
 */
(() => {
  const GAME_LOG_SOCKET = /^wss:\/\/game-log-api-[a-z]+\.dndbeyond\.com\//;
  const CHARACTER_SERVICE = /^https:\/\/character-service\.dndbeyond\.com\//;
  const UPDATE_EVENT = "character-sheet/character-update/fulfilled";

  // DDB broadcasts about a second after a write; a sheet edit is ignored for this long after its
  // request finishes so the sheet does not reload after its own changes.
  const OWN_WRITE_GRACE_MS = 4000;
  // Bursts of writes (a sync sending HP, slots and items together) settle into one reload.
  const DEBOUNCE_MS = 1500;

  /**
   * The character id of a sheet URL, or null for other pages (the builder, listings).
   * @param {string} pathname
   * @returns {string|null}
   */
  function sheetCharacterId(pathname) {
    const match = /^\/(?:profile\/[^/]+\/)?characters\/(\d+)\/?$/.exec(pathname);
    return match ? match[1] : null;
  }

  /**
   * Whether a game-log message reports a change to this character.
   * @param {unknown} message parsed socket payload
   * @param {string} characterId
   * @returns {boolean}
   */
  function isCharacterUpdate(message, characterId) {
    if (!message || typeof message !== "object") return false;
    return message.eventType === UPDATE_EVENT
      && message.entityType === "character"
      && String(message.entityId) === characterId;
  }

  /**
   * Whether a broadcast arriving now is the echo of the sheet's own write.
   * @param {{ inFlight: number, lastWriteEnd: number }} writes
   * @param {number} now
   * @returns {boolean}
   */
  function isOwnWriteEcho(writes, now) {
    return writes.inFlight > 0 || now - writes.lastWriteEnd < OWN_WRITE_GRACE_MS;
  }

  /**
   * Whether reloading now would interrupt the user: the tab is hidden or they are typing.
   * @param {Document} doc
   * @returns {boolean}
   */
  function shouldWait(doc) {
    if (doc.hidden) return true;
    const el = doc.activeElement;
    if (!el) return false;
    return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
  }

  const core = { sheetCharacterId, isCharacterUpdate, isOwnWriteEcho, shouldWait, OWN_WRITE_GRACE_MS, DEBOUNCE_MS };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
    return;
  }

  const characterId = sheetCharacterId(window.location.pathname);
  if (!characterId) return;

  const log = (...args) => console.debug("[DDBI Utilities] sheet refresh:", ...args);
  const writes = { inFlight: 0, lastWriteEnd: 0 };
  let debounceTimer = null;
  let waiting = false;

  const isWrite = (method, url) => !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase())
    && CHARACTER_SERVICE.test(String(url));

  function trackWrite(promise) {
    writes.inFlight += 1;
    const done = () => {
      writes.inFlight -= 1;
      writes.lastWriteEnd = Date.now();
    };
    promise.then(done, done);
  }

  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    const result = nativeFetch.apply(this, arguments);
    const url = typeof input === "string" ? input : input?.url;
    const method = init?.method ?? (typeof input === "object" ? input?.method : undefined);
    if (isWrite(method, url)) trackWrite(result);
    return result;
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ddbSheetRefreshWrite = isWrite(method, url);
    return nativeOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__ddbSheetRefreshWrite) {
      trackWrite(new Promise((resolve) => this.addEventListener("loadend", resolve, { once: true })));
    }
    return nativeSend.apply(this, arguments);
  };

  function reloadWhenIdle() {
    if (shouldWait(document)) {
      if (waiting) return;
      waiting = true;
      log("change pending, waiting for the tab to be visible and idle");
      const retry = () => {
        if (shouldWait(document)) return;
        document.removeEventListener("visibilitychange", retry);
        document.removeEventListener("focusout", deferredRetry);
        waiting = false;
        reloadWhenIdle();
      };
      // focusout fires before focus moves, so check once the new element is active
      const deferredRetry = () => setTimeout(retry, 0);
      document.addEventListener("visibilitychange", retry);
      document.addEventListener("focusout", deferredRetry);
      return;
    }
    log("reloading for a change made elsewhere");
    window.location.reload();
  }

  function onGameLogMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!isCharacterUpdate(message, characterId)) return;
    if (isOwnWriteEcho(writes, Date.now())) {
      log("ignoring the echo of this sheet's own change");
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(reloadWhenIdle, DEBOUNCE_MS);
  }

  const NativeWebSocket = window.WebSocket;
  class GameLogAwareWebSocket extends NativeWebSocket {
    constructor(url, protocols) {
      super(url, protocols);
      if (GAME_LOG_SOCKET.test(String(url))) this.addEventListener("message", onGameLogMessage);
    }
  }
  window.WebSocket = GameLogAwareWebSocket;
})();

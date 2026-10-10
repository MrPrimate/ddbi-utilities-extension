/**
 * DDBI Utilities Extension: send a monster's biography to DDB Importer (content script).
 *
 * Some D&D Beyond monsters (many 2024 Monster Manual entries) have no biography or lair text in
 * the data DDB Importer imports, although their page shows it. On a monster page with a biography
 * this adds a button that sends the biography to DDB Importer in a connected Foundry tab, which
 * imports or updates that monster in its compendium with the text (and parses the lair section).
 */
(() => {
  const BIOGRAPHY = ".mon-details__description-block-content";
  const NAME = ".mon-stat-block-2024__name, .mon-stat-block__name";

  /**
   * The monster id of a monster page path, or null for other pages.
   * @param {string} pathname e.g. `/monsters/5194875-adult-red-dragon`
   * @returns {string|null}
   */
  function monsterIdFromPath(pathname) {
    const match = /^\/monsters\/(\d+)(?:-[^/]*)?\/?$/.exec(pathname);
    return match ? match[1] : null;
  }

  /** Whether a biography block has any text worth sending. */
  function hasBiography(element) {
    return Boolean(element && element.textContent.trim() !== "");
  }

  const core = { monsterIdFromPath, hasBiography };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
    return;
  }

  const monsterId = monsterIdFromPath(window.location.pathname);
  const biography = document.querySelector(BIOGRAPHY);
  if (!monsterId || !hasBiography(biography)) return;

  const bar = document.createElement("div");
  bar.className = "ddbi-utilities-monster-biography";
  bar.style.cssText = "display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px;";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Send biography to DDB Importer";
  button.title = "Import or update this monster in your Foundry monster compendium with this biography and lair text";
  button.style.cssText = "padding:4px 10px;cursor:pointer;";
  const status = document.createElement("span");
  status.setAttribute("role", "status");
  bar.append(button, status);
  biography.before(bar);

  const show = (text, ok) => {
    status.textContent = text;
    status.style.color = ok === undefined ? "" : ok ? "#1a7f37" : "#b42318";
  };

  button.addEventListener("click", async () => {
    button.disabled = true;
    show("Sending to Foundry...");
    try {
      const name = document.querySelector(NAME)?.textContent.trim() ?? "";
      const result = await chrome.runtime.sendMessage({
        type: "monster-biography",
        payload: { monsterId, name, html: biography.innerHTML },
      });
      show(result?.message ?? "No answer from the extension.", Boolean(result?.success));
    } catch (error) {
      console.error("[DDBI Utilities] monster biography failed:", error);
      show("Could not reach the extension. Reload this page and try again.", false);
    } finally {
      button.disabled = false;
    }
  });
})();

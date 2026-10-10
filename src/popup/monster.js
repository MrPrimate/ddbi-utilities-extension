/**
 * DDBI Utilities Extension: import a monster from its D&D Beyond page (popup).
 *
 * When the popup opens on a monster page it offers to import or reimport that monster into
 * DDB Importer's monster compendium in a connected Foundry tab. Some monsters (many 2024 Monster
 * Manual entries) have no biography or lair text in the data DDB Importer imports, although the
 * page shows it, so the page's biography goes along: "Import/reimport" adds it only where DDB's
 * data has none, "Send biography" always uses it (and the lair section is parsed as lair features).
 */
(() => {
  /**
   * The monster id of a monster page path, or null for other pages.
   * @param {string} pathname e.g. `/monsters/5194875-adult-red-dragon`
   * @returns {string|null}
   */
  function monsterIdFromPath(pathname) {
    const match = /^\/monsters\/(\d+)(?:-[^/]*)?\/?$/.exec(pathname);
    return match ? match[1] : null;
  }

  /**
   * Reads the monster and its biography from a D&D Beyond monster page. Runs inside that tab
   * through `scripting.executeScript`, so it must not use anything from this file's scope.
   * @returns {{ monsterId: string, name: string, html: string } | null} null when the page is not a
   * monster page; `html` is empty when the page has no biography text
   */
  function readMonsterBiography() {
    const match = /^\/monsters\/(\d+)(?:-[^/]*)?\/?$/.exec(window.location.pathname);
    if (!match) return null;
    const block = document.querySelector(".mon-details__description-block-content");
    const html = block && block.textContent.trim() !== "" ? block.innerHTML : "";
    const name = document.querySelector(".mon-stat-block-2024__name, .mon-stat-block__name")?.textContent.trim() ?? "";
    return { monsterId: match[1], name, html };
  }

  const core = { monsterIdFromPath, readMonsterBiography };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
    return;
  }

  const section = document.getElementById("monster");
  const heading = document.getElementById("monster-name");
  const importButton = document.getElementById("import-monster");
  const biographyButton = document.getElementById("send-biography");
  const biographyHint = document.getElementById("send-biography-hint");
  const status = document.getElementById("monster-status");
  let page = null;

  const show = (text, kind) => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  /** Sends the monster to DDB Importer; `biography` is "fill" (only where DDB has none) or "replace". */
  async function send(biography) {
    importButton.disabled = true;
    biographyButton.disabled = true;
    show("Sending to Foundry...", "");
    try {
      const result = await chrome.runtime.sendMessage({ type: "monster-import", payload: { ...page, biography } });
      show(result?.message ?? "No answer from the extension.", result?.success ? "ok" : "error");
    } catch (error) {
      console.error("[DDBI Utilities] monster import failed:", error);
      show("Could not send the monster, see the extension console.", "error");
    } finally {
      importButton.disabled = false;
      biographyButton.disabled = false;
    }
  }

  importButton.addEventListener("click", () => send("fill"));
  biographyButton.addEventListener("click", () => send("replace"));

  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const url = new URL(tab.url);
    if (url.hostname !== "www.dndbeyond.com" || !monsterIdFromPath(url.pathname)) return;
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readMonsterBiography })
      .catch(() => []);
    page = injection?.result ?? null;
    if (!page) return;
    const name = page.name || "this monster";
    heading.textContent = name;
    importButton.textContent = `Import/reimport ${name}`;
    biographyButton.hidden = page.html === "";
    biographyHint.hidden = page.html === "";
    section.hidden = false;
  })();
})();

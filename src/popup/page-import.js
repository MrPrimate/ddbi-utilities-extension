/**
 * DDBI Utilities Extension: import a D&D Beyond entry from its page (popup).
 *
 * When the popup opens on a D&D Beyond monster, spell, feat, species, equipment, magic item,
 * background or class page, it offers to import or reimport that entry into DDB Importer's
 * compendiums in a connected Foundry tab. The id comes from the page URL.
 *
 * Monsters also send the page's biography block: some (many 2024 Monster Manual entries) have no
 * biography or lair text in the data DDB Importer imports, although the page shows it.
 * "Import/reimport" adds it only where DDB's data has none, "Send biography" always uses it (and
 * the lair section is parsed as lair features).
 */
(() => {
  /** First URL path segment of each importable page type, and what DDB Importer calls it. */
  const PAGE_TYPES = {
    "monsters": { type: "monster", label: "monster" },
    "spells": { type: "spell", label: "spell" },
    "feats": { type: "feat", label: "feat" },
    "species": { type: "species", label: "species" },
    "equipment": { type: "item", label: "item" },
    "magic-items": { type: "item", label: "magic item" },
    "backgrounds": { type: "background", label: "background" },
    "classes": { type: "class", label: "class" },
  };

  /**
   * The importable entry a D&D Beyond page path points at, or null for other pages.
   * @param {string} pathname e.g. `/spells/2367-abi-dalzims-horrid-wilting`
   * @returns {{ type: string, label: string, id: string } | null}
   */
  function pageEntryFromPath(pathname) {
    const match = /^\/([a-z-]+)\/(\d+)(?:-[^/]*)?\/?$/.exec(pathname);
    const pageType = match ? PAGE_TYPES[match[1]] : undefined;
    return pageType ? { ...pageType, id: match[2] } : null;
  }

  /**
   * Reads the entry's name, and for monsters the biography block, from the open D&D Beyond page.
   * Runs inside that tab through `scripting.executeScript`, so it must not use anything from this
   * file's scope.
   * @returns {{ name: string, html: string }} `html` is empty off monster pages and when the
   * monster page has no biography text
   */
  function readPage() {
    const heading = document.querySelector(".mon-stat-block-2024__name, .mon-stat-block__name, h1.page-title")?.textContent.trim();
    // most page titles read "<Name> - <Section> - D&D Beyond"; species and class titles are longer
    const name = heading || document.title.split(" - ")[0].trim();
    const block = document.querySelector(".mon-details__description-block-content");
    const html = block && block.textContent.trim() !== "" ? block.innerHTML : "";
    return { name, html };
  }

  const core = { PAGE_TYPES, pageEntryFromPath, readPage };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
    return;
  }

  const section = document.getElementById("page-import");
  const heading = document.getElementById("page-import-name");
  const importButton = document.getElementById("import-entry");
  const importHint = document.getElementById("import-entry-hint");
  const biographyButton = document.getElementById("send-biography");
  const biographyHint = document.getElementById("send-biography-hint");
  const status = document.getElementById("page-import-status");
  let entry = null;

  const show = (text, kind) => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  /** Sends the entry to DDB Importer; `biography` ("fill" or "replace") only applies to monsters. */
  async function send(biography) {
    importButton.disabled = true;
    biographyButton.disabled = true;
    show("Sending to Foundry...", "");
    try {
      const payload = { type: entry.type, id: entry.id, name: entry.name };
      if (entry.type === "monster") Object.assign(payload, { html: entry.html, biography });
      const result = await chrome.runtime.sendMessage({ type: "ddb-import", payload });
      show(result?.message ?? "No answer from the extension.", result?.success ? "ok" : "error");
    } catch (error) {
      console.error("[DDBI Utilities] page import failed:", error);
      show("Could not send the import, see the extension console.", "error");
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
    const pageEntry = url.hostname === "www.dndbeyond.com" ? pageEntryFromPath(url.pathname) : null;
    if (!pageEntry) return;
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPage })
      .catch(() => []);
    const page = injection?.result ?? { name: "", html: "" };
    entry = { ...pageEntry, name: page.name || `this ${pageEntry.label}`, html: page.html };

    const isMonster = entry.type === "monster";
    heading.textContent = entry.name;
    importButton.textContent = `Import/reimport ${entry.name}`;
    importHint.textContent = isMonster
      ? "Imports this monster into your Foundry monster compendium, or reimports it, adding this page's biography and lair text where D&D Beyond's data has none."
      : entry.type === "class"
        ? "Imports this class and the subclasses D&D Beyond offers from its book into your Foundry compendiums, or reimports them. This takes a few minutes; Foundry shows when it is done."
        : `Imports this ${entry.label} into your Foundry compendiums, or reimports it.`;
    const showBiography = isMonster && entry.html !== "";
    biographyButton.hidden = !showBiography;
    biographyHint.hidden = !showBiography;
    section.hidden = false;
  })();
})();

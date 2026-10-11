/**
 * DDBI Utilities Extension: add a D&D Beyond entry to Foundry from its page (popup).
 *
 * When the popup opens on a D&D Beyond monster, spell, feat, species, equipment, magic item,
 * background or class page, or on a book (its index or a chapter page), it offers to add that entry
 * to DDB Importer's compendiums in a connected Foundry tab, or update it. The id (or book path)
 * comes from the page URL. Classes first ask which subclasses to add.
 *
 * Monsters also send the page's biography block: some (many 2024 Monster Manual entries) have no
 * biography or lair text in the data DDB Importer imports, although the page shows it. "Add to
 * Foundry" uses it only where DDB's data has none, "Send biography" always uses it (and the lair
 * section is parsed as lair features).
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
   * @returns {{ type: string, label: string, id?: string, path?: string } | null} books carry their
   * `sources/<publisher>/<book>` path instead of an id
   */
  function pageEntryFromPath(pathname) {
    // book pages: the index (/sources/dnd/au) and every chapter under it identify the same book
    const book = /^\/(sources\/[a-z0-9-]+\/[a-z0-9-]+)(?:\/|$)/.exec(pathname);
    if (book) return { type: "adventure", label: "book", path: book[1] };
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

  /**
   * The subclasses to show for the ticked source books: those with at least one ticked book.
   * @param {{ id: number, name: string, sourceIds: number[] }[]} subclasses
   * @param {Set<number>} sourceIds ticked source book ids
   */
  function subclassesForSources(subclasses, sourceIds) {
    return subclasses.filter((subclass) => subclass.sourceIds.some((id) => sourceIds.has(id)));
  }

  const core = { PAGE_TYPES, pageEntryFromPath, readPage, subclassesForSources };

  const HINTS = {
    monster: "Adds this monster to your Foundry monster compendium, or updates it, with this page's biography and lair text where D&D Beyond's data has none.",
    class: "Adds this class with the subclasses you choose to your Foundry compendiums, or updates them. This takes a few minutes; Foundry shows when it is done.",
    adventure: "Adds this book to Foundry with DDB Importer's adventure import. It shows its progress in Foundry and may ask questions there, such as which scenes to add or whether to detect scene grids.",
  };
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
  const picker = document.getElementById("subclass-picker");
  const sourceList = document.getElementById("subclass-sources");
  const subclassList = document.getElementById("subclass-list");
  const importClassButton = document.getElementById("import-class");
  let entry = null;
  let subclassData = null;
  // subclasses the user unticked; everything else starts ticked and keeps its tick while a source
  // filter hides it
  const unticked = new Set();

  const show = (text, kind) => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  /** Names the entry in the heading and the add button. */
  function setName(name) {
    entry.name = name;
    heading.textContent = name;
    importButton.textContent = entry.type === "class" ? `Add ${name} to Foundry: choose subclasses` : `Add ${name} to Foundry`;
  }

  /**
   * Sends the entry to DDB Importer. `biography` ("fill" or "replace") only applies to monsters,
   * `subclassIds` only to classes.
   */
  async function send(biography, subclassIds = []) {
    importButton.disabled = true;
    biographyButton.disabled = true;
    show("Sending to Foundry...", "");
    try {
      const payload = { type: entry.type, id: entry.id, path: entry.path, name: entry.name };
      if (entry.type === "monster") Object.assign(payload, { html: entry.html, biography });
      if (entry.type === "class") payload.subclassIds = subclassIds;
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

  /**
   * Asks DDB Importer in the connected Foundry tab whether this entry can be imported (a GM with a
   * Cobalt cookie, plus the Patreon tier, and for feats, backgrounds, species and classes the mule
   * character). The buttons stay disabled until it says yes.
   */
  async function checkReady() {
    importButton.disabled = true;
    biographyButton.disabled = true;
    show("Checking DDB Importer in Foundry...", "");
    try {
      const result = await chrome.runtime.sendMessage({ type: "ddb-import-status", payload: { type: entry.type, path: entry.path } });
      // DDB Importer names books itself: a chapter page's heading is the chapter, not the book
      if (result?.data?.name) setName(result.data.name);
      if (result?.success) {
        importButton.disabled = false;
        biographyButton.disabled = false;
        show("", "");
      } else {
        show(result?.message ?? "No answer from the extension.", "error");
      }
    } catch (error) {
      console.error("[DDBI Utilities] import status check failed:", error);
      show("Could not reach DDB Importer, see the extension console.", "error");
    }
  }

  const checkedValues = (list) => new Set([...list.querySelectorAll("input:checked")].map((input) => Number(input.value)));

  /** Shows the subclasses of the ticked books, keeping each one's tick, and updates the import button. */
  function renderSubclasses() {
    const visible = subclassesForSources(subclassData.subclasses, checkedValues(sourceList));
    const names = new Map(subclassData.sources.map((source) => [source.id, source.name]));
    subclassList.replaceChildren(...visible.map((subclass) => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = String(subclass.id);
      box.checked = !unticked.has(subclass.id);
      box.addEventListener("change", () => {
        if (box.checked) unticked.delete(subclass.id);
        else unticked.add(subclass.id);
        updateClassButton();
      });
      const text = document.createElement("span");
      text.textContent = subclass.name;
      const source = document.createElement("span");
      source.className = "source-name";
      source.textContent = subclass.sourceIds.map((id) => names.get(id)).filter(Boolean).join(", ");
      text.append(" ", source);
      label.append(box, text);
      item.append(label);
      return item;
    }));
    updateClassButton();
  }

  function updateClassButton() {
    const count = checkedValues(subclassList).size;
    importClassButton.disabled = count === 0;
    importClassButton.textContent = count === 0
      ? "Choose at least one subclass"
      : `Add ${entry.name} with ${count} subclass${count === 1 ? "" : "es"} to Foundry`;
  }

  /** Fetches the class's subclasses from DDB Importer and shows the picker. */
  async function openSubclassPicker() {
    importButton.disabled = true;
    show("Getting the subclasses from D&D Beyond...", "");
    try {
      const result = await chrome.runtime.sendMessage({ type: "ddb-class-subclasses", payload: { id: entry.id } });
      if (!result?.success || !result.data) {
        show(result?.message ?? "No answer from the extension.", "error");
        importButton.disabled = false;
        return;
      }
      subclassData = result.data;
      if (subclassData.subclasses.length === 0) {
        show("D&D Beyond offers no subclasses for this class on your account.", "error");
        importButton.disabled = false;
        return;
      }
      sourceList.replaceChildren(...subclassData.sources.map((source) => {
        const item = document.createElement("li");
        const label = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = String(source.id);
        box.checked = true;
        box.addEventListener("change", renderSubclasses);
        const text = document.createElement("span");
        text.textContent = source.description || source.name;
        label.append(box, text);
        item.append(label);
        return item;
      }));
      unticked.clear();
      renderSubclasses();
      show("", "");
      importButton.hidden = true;
      importHint.hidden = true;
      picker.hidden = false;
      document.body.classList.add("wide");
    } catch (error) {
      console.error("[DDBI Utilities] subclass list failed:", error);
      show("Could not get the subclasses, see the extension console.", "error");
      importButton.disabled = false;
    }
  }

  function closeSubclassPicker() {
    picker.hidden = true;
    importButton.hidden = false;
    importHint.hidden = false;
    importButton.disabled = false;
    document.body.classList.remove("wide");
  }

  document.getElementById("subclass-all").addEventListener("click", (event) => {
    event.preventDefault();
    subclassList.querySelectorAll("input").forEach((box) => {
      box.checked = true;
      unticked.delete(Number(box.value));
    });
    updateClassButton();
  });
  document.getElementById("subclass-none").addEventListener("click", (event) => {
    event.preventDefault();
    subclassList.querySelectorAll("input").forEach((box) => {
      box.checked = false;
      unticked.add(Number(box.value));
    });
    updateClassButton();
  });
  document.getElementById("cancel-class").addEventListener("click", closeSubclassPicker);
  importClassButton.addEventListener("click", async () => {
    importClassButton.disabled = true;
    await send("fill", [...checkedValues(subclassList)]);
    closeSubclassPicker();
  });

  importButton.addEventListener("click", () => (entry.type === "class" ? openSubclassPicker() : send("fill")));
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
    setName(entry.name);
    importHint.textContent = HINTS[entry.type] ?? `Adds this ${entry.label} to your Foundry compendiums, or updates it if it is already there.`;
    const showBiography = isMonster && entry.html !== "";
    biographyButton.hidden = !showBiography;
    biographyHint.hidden = !showBiography;
    section.hidden = false;
    await checkReady();
  })();
})();

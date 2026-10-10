/**
 * DDBI Utilities Extension: connect Foundry sites (popup).
 *
 * Connecting the current tab's site grants the extension access to it and registers the Foundry
 * bridge there, so the DDB Importer module on that site can ask for the D&D Beyond login.
 */
(() => {
  const sites = globalThis.DDBIFoundrySites;
  const section = document.getElementById("foundry");
  const current = document.getElementById("foundry-current");
  const connectButton = document.getElementById("connect-site");
  const list = document.getElementById("connected-sites");
  const status = document.getElementById("foundry-status");
  let activeTab = null;
  let activePattern = null;

  const show = (text, kind) => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  async function render() {
    const connected = await sites.connectedSites(chrome.scripting);
    list.replaceChildren(...connected.map((pattern) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = pattern.replace(/\/\*$/, "");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Disconnect";
      remove.addEventListener("click", () => disconnect(pattern));
      item.append(label, remove);
      return item;
    }));

    if (!activePattern) {
      current.textContent = "Open your Foundry tab, then this popup, to connect it.";
      connectButton.hidden = true;
    } else if (connected.includes(activePattern)) {
      current.textContent = `${activePattern.replace(/\/\*$/, "")} is connected.`;
      connectButton.hidden = true;
    } else {
      current.textContent = `Let DDB Importer on ${activePattern.replace(/\/\*$/, "")} use your D&D Beyond login?`;
      connectButton.hidden = false;
    }
  }

  async function connect() {
    try {
      const origins = [activePattern];
      const granted = await chrome.permissions.contains({ origins }) || await chrome.permissions.request({ origins });
      if (!granted) {
        show("Access to the site was not granted.", "error");
        return;
      }
      const id = sites.scriptId(activePattern);
      const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
      if (!existing.length) {
        await chrome.scripting.registerContentScripts([{
          id,
          matches: [activePattern],
          js: [sites.BRIDGE_SCRIPT],
          runAt: "document_idle",
          persistAcrossSessions: true,
        }]);
      }
      // start the bridge in the open tab too, so it works without a reload
      await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: [sites.BRIDGE_SCRIPT] });
      show("Connected. DDB Importer will ask before using your login.", "ok");
    } catch (error) {
      console.error("[DDBI Utilities] connect failed:", error);
      show("Could not connect this site, see the extension console.", "error");
    }
    await render();
  }

  async function disconnect(pattern) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [sites.scriptId(pattern)] });
      await chrome.permissions.remove({ origins: [pattern] });
      show(`Disconnected ${pattern.replace(/\/\*$/, "")}.`, "ok");
    } catch (error) {
      console.error("[DDBI Utilities] disconnect failed:", error);
      show("Could not disconnect the site, see the extension console.", "error");
    }
    await render();
  }

  connectButton.addEventListener("click", connect);

  (async () => {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activePattern = activeTab?.url ? sites.sitePattern(activeTab.url) : null;
    section.hidden = false;
    await render();
  })();
})();

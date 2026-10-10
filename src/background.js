/**
 * DDBI Utilities Extension: background worker.
 *
 * Hands the D&D Beyond `CobaltSession` cookie to the Foundry bridge, but only for tabs on a site
 * the user connected, and tells those tabs when the D&D Beyond login changes (without the cookie;
 * the module asks for it if it wants it).
 */
if (typeof importScripts === "function") importScripts("foundry-sites.js");

const COOKIE = { name: "CobaltSession", url: "https://www.dndbeyond.com/" };
const CHANGE_DEBOUNCE_MS = 1000;
let changeTimer = null;

async function senderIsConnected(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab?.url) return false;
  const sites = await globalThis.DDBIFoundrySites.connectedSites(chrome.scripting);
  return globalThis.DDBIFoundrySites.isConnectedUrl(sender.tab.url, sites);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "get-cobalt") return false;
  (async () => {
    if (!(await senderIsConnected(sender))) return { cobalt: null };
    const cookie = await chrome.cookies.get(COOKIE);
    return { cobalt: cookie?.value ?? null };
  })()
    .then(sendResponse)
    .catch(() => sendResponse({ cobalt: null }));
  return true;
});

/**
 * Sends a request from a D&D Beyond page to DDB Importer in a connected Foundry tab. Tabs whose
 * module does not acknowledge it (no world open, an older module) are skipped; the first success
 * wins, otherwise the first failure message is returned.
 */
async function sendToFoundry(request, payload) {
  const sites = await globalThis.DDBIFoundrySites.connectedSites(chrome.scripting);
  if (!sites.length) {
    return { success: false, message: "Connect your Foundry site in the DDBI Utilities popup first." };
  }
  const tabs = await chrome.tabs.query({ url: sites });
  if (!tabs.length) return { success: false, message: "Open your connected Foundry world in a tab first." };
  const failures = [];
  for (const tab of tabs) {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "extension-request", request, payload }).catch(() => null);
    if (!result) continue;
    if (result.success) return result;
    failures.push(result.message);
  }
  return {
    success: false,
    message: failures[0] ?? "DDB Importer did not answer. Is your world open with DDB Importer enabled?",
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "monster-biography") return false;
  if (sender.id !== chrome.runtime.id || !/^https:\/\/www\.dndbeyond\.com\/monsters\//.test(sender.tab?.url ?? "")) {
    sendResponse({ success: false, message: "Not a D&D Beyond monster page." });
    return false;
  }
  sendToFoundry("monster-biography", message.payload)
    .then(sendResponse)
    .catch((error) => sendResponse({ success: false, message: String(error?.message ?? error) }));
  return true;
});

chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (cookie.name !== COOKIE.name || !/(^|\.)dndbeyond\.com$/.test(cookie.domain.replace(/^\./, ""))) return;
  clearTimeout(changeTimer);
  changeTimer = setTimeout(async () => {
    const sites = await globalThis.DDBIFoundrySites.connectedSites(chrome.scripting);
    if (!sites.length) return;
    const tabs = await chrome.tabs.query({ url: sites });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: "cobalt-changed" }).catch(() => {});
    }
  }, CHANGE_DEBOUNCE_MS);
});

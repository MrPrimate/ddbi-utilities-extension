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

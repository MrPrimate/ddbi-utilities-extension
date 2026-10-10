/**
 * DDBI Utilities Extension: shared helpers for connected Foundry sites.
 *
 * A Foundry site is connected by granting the extension access to its origin and registering the
 * bridge content script (src/foundry-bridge.js) for it. Loaded by the background worker, the popup
 * and the Node tests.
 */
(() => {
  const BRIDGE_SCRIPT = "src/foundry-bridge.js";
  const SCRIPT_ID_PREFIX = "ddbi-foundry-bridge:";

  /**
   * The match pattern covering a site. Match patterns carry no port, so this covers every port on
   * that host, which is what a Foundry install on localhost needs anyway.
   * @param {string} url any URL on the site
   * @returns {string|null} e.g. `http://localhost/*`, or null for pages that cannot be connected
   */
  function sitePattern(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (/(^|\.)dndbeyond\.com$/.test(parsed.hostname)) return null;
    return `${parsed.protocol}//${parsed.hostname}/*`;
  }

  /** The registered content script id for a site pattern. */
  function scriptId(pattern) {
    return `${SCRIPT_ID_PREFIX}${pattern}`;
  }

  /** The site pattern of a registered bridge script id, or null for other scripts. */
  function patternFromScriptId(id) {
    return typeof id === "string" && id.startsWith(SCRIPT_ID_PREFIX) ? id.slice(SCRIPT_ID_PREFIX.length) : null;
  }

  /**
   * Whether a URL belongs to one of the connected site patterns.
   * @param {string} url
   * @param {string[]} patterns
   */
  function isConnectedUrl(url, patterns) {
    const pattern = sitePattern(url);
    return pattern !== null && patterns.includes(pattern);
  }

  /**
   * The connected site patterns, read from the registered bridge scripts.
   * @param {{ getRegisteredContentScripts: Function }} scripting the `chrome.scripting` API
   * @returns {Promise<string[]>}
   */
  async function connectedSites(scripting) {
    const scripts = await scripting.getRegisteredContentScripts();
    return scripts.map((script) => patternFromScriptId(script.id)).filter(Boolean);
  }

  const api = { BRIDGE_SCRIPT, sitePattern, scriptId, patternFromScriptId, isConnectedUrl, connectedSites };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.DDBIFoundrySites = api;
})();

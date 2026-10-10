/**
 * DDBI Utilities Extension: Cobalt cookie copy (popup).
 *
 * Reads the D&D Beyond `CobaltSession` cookie and copies it to the clipboard so it can be pasted
 * into DDB Importer's settings in Foundry VTT.
 */
(() => {
  const COOKIE = { name: "CobaltSession", domain: ".dndbeyond.com" };
  const ORIGINS = ["https://dndbeyond.com/*", "https://*.dndbeyond.com/*"];

  /**
   * The CobaltSession cookie value, or null when the browser holds none (not logged in).
   * @param {{ getAll: Function }} cookies the `chrome.cookies` API
   * @returns {Promise<string|null>}
   */
  function getCobaltCookie(cookies) {
    return new Promise((resolve) => {
      cookies.getAll(COOKIE, (found) => resolve(found?.length ? found[0].value : null));
    });
  }

  /**
   * Makes sure the extension may read dndbeyond.com cookies. Firefox can leave host permissions
   * ungranted after install, so ask for them; this must run from a user gesture.
   * @param {{ contains: Function, request: Function }} permissions the `chrome.permissions` API
   * @returns {Promise<boolean>}
   */
  async function ensureHostAccess(permissions) {
    if (await permissions.contains({ origins: ORIGINS })) return true;
    return permissions.request({ origins: ORIGINS });
  }

  const core = { getCobaltCookie, ensureHostAccess, COOKIE, ORIGINS };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
    return;
  }

  const button = document.getElementById("copy-cobalt");
  const status = document.getElementById("status");
  const show = (text, kind) => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  button.addEventListener("click", async () => {
    try {
      if (!(await ensureHostAccess(chrome.permissions))) {
        show("Access to dndbeyond.com is needed to read the cookie.", "error");
        return;
      }
      const cobalt = await getCobaltCookie(chrome.cookies);
      if (!cobalt) {
        show("No D&D Beyond login found. Log in at dndbeyond.com and try again.", "error");
        return;
      }
      await navigator.clipboard.writeText(cobalt);
      show("Copied. Paste it into DDB Importer's Cobalt Cookie setting.", "ok");
    } catch (error) {
      console.error("[DDBI Utilities] cobalt copy failed:", error);
      show("Could not copy the cookie, see the extension console.", "error");
    }
  });
})();

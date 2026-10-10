# DDBI Utilities Extension

Browser helpers for D&D Beyond, for use alongside the DDB Importer Foundry VTT module.

## Features

### Share your D&D Beyond login with DDB Importer

DDB Importer can take your Cobalt cookie straight from the browser you are logged in to D&D Beyond
with, so you never paste it by hand.

1. Open your Foundry tab, click the extension's toolbar button and press **Connect this Foundry**.
   The browser asks for access to that site; the extension only ever talks to sites you connect,
   and the list in the popup lets you disconnect them.
2. DDB Importer asks once whether to use the login (DDB Importer module setting "Use the D&D Beyond
   login from the DDBI Utilities Extension": Ask, Always, Never).

- **GMs** get the login when the world loads and again whenever it changes on D&D Beyond (logging
  in again, or as another account). A login D&D Beyond rejects is ignored.
- **Players** only from the **Use D&D Beyond login from this browser** button on their character's
  Advanced tab, or when they open their character without a working cookie. It is saved for that
  character only.

The cookie goes from the extension to the Foundry page in your browser and nowhere else: no server
is involved. The extension sends it only when DDB Importer asks, and only to a connected site; a
login change is announced without it.

### Copy Cobalt cookie

Click the extension's toolbar button, then "Copy Cobalt Cookie", to copy your D&D Beyond
`CobaltSession` cookie to the clipboard for DDB Importer's Cobalt Cookie setting in Foundry VTT.
Log in at dndbeyond.com first. This replaces the older
[ddb-importer-chrome](https://github.com/MrPrimate/ddb-importer-chrome) extension.

The cookie is read with the browser's cookies API and only ever copied to your clipboard; it is not
stored or sent anywhere. In Firefox the popup asks for access to dndbeyond.com the first time if it
was not granted at install.

### Sheet refresh

Reloads an open D&D Beyond character sheet when the character is changed somewhere else: another
tab, DDB Maps, or Foundry VTT through ddb-importer's dynamic sync.

D&D Beyond's server broadcasts `character-sheet/character-update/fulfilled` to the campaign's game
log after every change to a character. DDB Maps listens for it and refreshes, but the character
sheet ignores it, so changes made elsewhere only appear after a manual reload. This feature listens
on the game-log socket the sheet already opens and reloads the sheet for it, which is what DDB Maps
does for the sheet it embeds.

How it works (`src/sheet-refresh.js`):

- A content script runs in the page (`world: "MAIN"`, `document_start`) on
  `dndbeyond.com/characters/<id>` and `dndbeyond.com/profile/<user>/characters/<id>`. It wraps
  `window.WebSocket` to read the sheet's own game-log socket. It opens no connection of its own
  and never sees your login token.
- Changes made on the sheet itself are ignored: the sheet's writes to the character service are
  tracked, and the broadcast they cause is skipped for 4 seconds after each one.
- A burst of changes becomes one reload (1.5 second debounce).
- If the tab is hidden or you are typing in a field, the reload waits until the tab is visible and
  focus leaves the field.

Limits:

- The character must be in a campaign. The game log is per campaign, so a character outside one
  gets no broadcasts.
- An outside change that lands within 4 seconds of an edit on the sheet is skipped along with that
  edit's echo; the next change picks it up.
- A reload closes any open sidebar or dialog on the sheet.

## Permissions

- `cookies` and access to `dndbeyond.com`: read the `CobaltSession` cookie and notice login changes.
- `clipboardWrite`: put the cookie on the clipboard for the copy button.
- `scripting`, `activeTab` and optional access to other sites: connect a Foundry site. Access is
  requested per site when you press Connect, never up front.
- The sheet refresh content script needs no permissions of its own.

## Install (unpacked)

Download the zip for your browser from the releases page and unzip it.

- Chrome / Edge: `ddbi-utilities-extension-chrome.zip`. `chrome://extensions`, enable Developer
  mode, "Load unpacked", pick the unzipped folder (a checkout of this repo works too).
- Firefox 128+: `ddbi-utilities-extension-firefox.zip`. `about:debugging#/runtime/this-firefox`,
  "Load Temporary Add-on", pick its `manifest.json`. From a checkout, run `npm run build` and use
  `dist/firefox/manifest.json`.

## Development

Content-script features live in `src/` (one script per feature, listed in `manifest.json`); the
toolbar popup lives in `src/popup/`. Login sharing is `src/background.js` (cookie access, gated on
connected sites), `src/foundry-bridge.js` (registered per connected site, relays
`window.postMessage` traffic with the module) and `src/foundry-sites.js` (shared helpers); the
module side is `src/lib/CobaltExtension.ts` in ddb-importer. Tests are in `test/<feature>.test.js`. Pushing to `main`
runs the tests and publishes a release zip tagged with the `manifest.json` version.

```bash
npm test        # node:test unit tests
npm run build   # dist/chrome and dist/firefox
```

`manifest.json` is the Chrome/Edge manifest. The Firefox build swaps the background service worker
for event-page scripts (Firefox has no extension service workers, and Chrome rejects
`background.scripts` in Manifest V3) and adds the gecko id; see `tools/build.mjs`.

A feature script exports its pure helpers when loaded by Node (for the tests) and runs normally in
the browser.

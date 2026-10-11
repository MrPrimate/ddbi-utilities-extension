# DDBI Utilities Extension privacy policy

Effective 11 October 2026.

DDBI Utilities Extension ("the extension") is an unofficial companion for the DDB Importer module
for Foundry Virtual Tabletop. It is not affiliated with D&D Beyond or Wizards of the Coast.

The extension has no server, sends nothing over the network itself, contains no analytics or
tracking, and never sells or shares your data. Everything below happens inside your own browser.

## What the extension handles

### Your D&D Beyond login cookie (authentication information)

The extension can read the `CobaltSession` cookie your browser holds for dndbeyond.com. It reads it
only:

- when you press **Copy Cobalt Cookie** in its popup, to put it on your clipboard; or
- when the DDB Importer module, running in a Foundry site you have connected in the popup, asks for
  it. The cookie is then handed to that Foundry page in your browser and to no other site or page.

To connect a Foundry site you press **Connect this Foundry** on it, and your browser asks you to
grant access to that one site. You can disconnect it from the popup at any time. The extension
gives the cookie to connected sites only.

When your D&D Beyond login changes, the extension tells connected Foundry pages that it changed,
without sending the cookie. The DDB Importer module asks you before it first uses the login, and
lets you turn this off.

What the DDB Importer module does with the cookie once it has it (storing it in your Foundry world
or browser and using it to fetch your D&D Beyond content through the DDB Importer proxy) is the
module's existing behaviour, the same as when you paste the cookie by hand. See the
[DDB Importer documentation](https://github.com/MrPrimate/ddb-importer) for that.

### D&D Beyond page content

- **Monster, spell, feat, species, equipment, magic item, background, class and book pages.** When
  you open the popup on one, the extension reads the entry's id or book (from the page address) and
  name, and on monster pages the biography text. They are sent only when you press **Add to
  Foundry** or **Send biography**, and only to DDB Importer in your connected Foundry tab, which adds
  the entry to your Foundry world. For class pages, the list of subclasses to choose from comes from
  DDB Importer.
- **Character sheets.** On D&D Beyond character sheet pages, the extension watches the update
  notices the sheet itself already receives from D&D Beyond, and the sheet's own saves, to decide
  when to reload the sheet. Nothing is stored or sent anywhere.

### Tab addresses

When you open the popup, the extension looks at the address of the current tab to see whether it
is a D&D Beyond page it can import or a Foundry site you could connect. It does not keep or send it.

## What the extension stores

Only the list of Foundry sites you have connected, which your browser keeps as the extension's
registered scripts and permissions. Disconnecting a site in the popup, or removing the extension,
deletes it. The extension stores no cookies, page content or browsing history.

## Contact and changes

Questions and reports: <https://github.com/MrPrimate/ddbi-utilities-extension/issues>. Changes to
this policy are published in this file, with a new effective date.

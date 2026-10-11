const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/popup/page-import.js");

test("pageEntryFromPath maps each importable page type and its URL id", () => {
  const cases = [
    ["/monsters/5194875-adult-red-dragon", "monster", "5194875"],
    ["/spells/2367-abi-dalzims-horrid-wilting", "spell", "2367"],
    ["/feats/2346185-aberrant-anatomy", "feat", "2346185"],
    ["/species/1751434-aasimar", "species", "1751434"],
    ["/equipment/6-abacus", "item", "6"],
    ["/magic-items/2188377-abracadabrus", "item", "2188377"],
    ["/backgrounds/511053-aberrant-heir", "background", "511053"],
    ["/classes/2190875-barbarian", "class", "2190875"],
    ["/spells/2367", "spell", "2367"],
  ];
  for (const [path, type, id] of cases) {
    const entry = core.pageEntryFromPath(path);
    assert.equal(entry?.type, type, path);
    assert.equal(entry?.id, id, path);
  }
});

test("pageEntryFromPath ignores pages that are not single entries", () => {
  for (const path of ["/spells", "/monsters?filter-search=dragon", "/characters/172173081", "/classes/barbarian", "/campaigns/8176796", "/sources/dnd/phb-2024"]) {
    assert.equal(core.pageEntryFromPath(path), null, path);
  }
});

function withPage(title, elements, run) {
  const saved = globalThis.document;
  globalThis.document = { title, querySelector: (selector) => elements[selector] ?? null };
  try {
    return run();
  } finally {
    globalThis.document = saved;
  }
}

test("readPage takes the name from the page title, or a monster stat block", () => {
  assert.deepEqual(withPage("Abacus - Equipment - D&D Beyond", {}, core.readPage), { name: "Abacus", html: "" });
  const monster = withPage("Test Wyrm - Monsters - D&D Beyond", {
    ".mon-stat-block-2024__name, .mon-stat-block__name, h1.page-title": { textContent: " Test Wyrm " },
    ".mon-details__description-block-content": { textContent: "Wyrms hoard spoons.", innerHTML: "<p>Wyrms hoard spoons.</p>" },
  }, core.readPage);
  assert.deepEqual(monster, { name: "Test Wyrm", html: "<p>Wyrms hoard spoons.</p>" });
});

test("readPage prefers the page heading over a long page title", () => {
  const result = withPage("The Test Folk Species for Dungeons & Dragons (D&D) Fifth Edition (5e) - D&D Beyond", {
    ".mon-stat-block-2024__name, .mon-stat-block__name, h1.page-title": { textContent: "Test Folk" },
  }, core.readPage);
  assert.equal(result.name, "Test Folk");
});

test("readPage leaves the biography empty when the block has no text", () => {
  const result = withPage("Test Wyrm - Monsters - D&D Beyond", {
    ".mon-details__description-block-content": { textContent: "  ", innerHTML: " " },
  }, core.readPage);
  assert.equal(result.html, "");
});

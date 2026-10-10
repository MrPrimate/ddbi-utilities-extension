const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/popup/monster.js");

test("monsterIdFromPath reads monster page paths only", () => {
  assert.equal(core.monsterIdFromPath("/monsters/5194875-adult-red-dragon"), "5194875");
  assert.equal(core.monsterIdFromPath("/monsters/5194875"), "5194875");
  assert.equal(core.monsterIdFromPath("/monsters/5194875-adult-red-dragon/"), "5194875");
  assert.equal(core.monsterIdFromPath("/monsters"), null);
  assert.equal(core.monsterIdFromPath("/characters/172173081"), null);
});

function withPage(pathname, elements, run) {
  const saved = { window: globalThis.window, document: globalThis.document };
  globalThis.window = { location: { pathname } };
  globalThis.document = { querySelector: (selector) => elements[selector] ?? null };
  try {
    return run();
  } finally {
    globalThis.window = saved.window;
    globalThis.document = saved.document;
  }
}

test("readMonsterBiography returns the id, name and biography HTML", () => {
  const result = withPage("/monsters/1001-test-wyrm", {
    ".mon-details__description-block-content": { textContent: "Wyrms hoard spoons.", innerHTML: "<p>Wyrms hoard spoons.</p>" },
    ".mon-stat-block-2024__name, .mon-stat-block__name": { textContent: " Test Wyrm " },
  }, core.readMonsterBiography);
  assert.deepEqual(result, { monsterId: "1001", name: "Test Wyrm", html: "<p>Wyrms hoard spoons.</p>" });
});

test("readMonsterBiography gives an empty biography when the page has none", () => {
  const empty = { ".mon-details__description-block-content": { textContent: "  ", innerHTML: " " } };
  assert.deepEqual(withPage("/monsters/1001-test-wyrm", empty, core.readMonsterBiography), { monsterId: "1001", name: "", html: "" });
  assert.deepEqual(withPage("/monsters/1001-test-wyrm", {}, core.readMonsterBiography), { monsterId: "1001", name: "", html: "" });
});

test("readMonsterBiography returns null off monster pages", () => {
  const block = { ".mon-details__description-block-content": { textContent: "Text", innerHTML: "Text" } };
  assert.equal(withPage("/characters/1", block, core.readMonsterBiography), null);
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/monster-biography.js");

test("monsterIdFromPath reads monster page paths only", () => {
  assert.equal(core.monsterIdFromPath("/monsters/5194875-adult-red-dragon"), "5194875");
  assert.equal(core.monsterIdFromPath("/monsters/5194875"), "5194875");
  assert.equal(core.monsterIdFromPath("/monsters/5194875-adult-red-dragon/"), "5194875");
  assert.equal(core.monsterIdFromPath("/monsters"), null);
  assert.equal(core.monsterIdFromPath("/monsters?filter-search=dragon"), null);
  assert.equal(core.monsterIdFromPath("/characters/172173081"), null);
});

test("hasBiography needs a block with text", () => {
  assert.equal(core.hasBiography(null), false);
  assert.equal(core.hasBiography({ textContent: "  \n " }), false);
  assert.equal(core.hasBiography({ textContent: "Dragons hoard things." }), true);
});

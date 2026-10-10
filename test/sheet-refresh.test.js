const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/sheet-refresh.js");

test("sheetCharacterId reads sheet URLs only", () => {
  assert.equal(core.sheetCharacterId("/characters/172173081"), "172173081");
  assert.equal(core.sheetCharacterId("/characters/172173081/"), "172173081");
  assert.equal(core.sheetCharacterId("/profile/MrPrimate/characters/172173081"), "172173081");
  assert.equal(core.sheetCharacterId("/characters/172173081/builder"), null);
  assert.equal(core.sheetCharacterId("/characters"), null);
  assert.equal(core.sheetCharacterId("/campaigns/8176796"), null);
});

test("isCharacterUpdate matches the update broadcast for this character", () => {
  const message = {
    eventType: "character-sheet/character-update/fulfilled",
    entityType: "character",
    entityId: "172173081",
    data: { characterId: 172173081 },
  };
  assert.equal(core.isCharacterUpdate(message, "172173081"), true);
  assert.equal(core.isCharacterUpdate({ ...message, entityId: "1" }, "172173081"), false);
  assert.equal(core.isCharacterUpdate({ ...message, eventType: "dice/roll/fulfilled" }, "172173081"), false);
  assert.equal(core.isCharacterUpdate({ ...message, entityType: "user" }, "172173081"), false);
  assert.equal(core.isCharacterUpdate(null, "172173081"), false);
});

test("isOwnWriteEcho covers in-flight writes and the grace period after one", () => {
  const now = 100000;
  assert.equal(core.isOwnWriteEcho({ inFlight: 1, lastWriteEnd: 0 }, now), true);
  assert.equal(core.isOwnWriteEcho({ inFlight: 0, lastWriteEnd: now - 1000 }, now), true);
  assert.equal(core.isOwnWriteEcho({ inFlight: 0, lastWriteEnd: now - core.OWN_WRITE_GRACE_MS }, now), false);
  assert.equal(core.isOwnWriteEcho({ inFlight: 0, lastWriteEnd: 0 }, now), false);
});

test("shouldWait while hidden or typing", () => {
  const doc = (hidden, activeElement) => ({ hidden, activeElement });
  assert.equal(core.shouldWait(doc(true, null)), true);
  assert.equal(core.shouldWait(doc(false, { tagName: "INPUT" })), true);
  assert.equal(core.shouldWait(doc(false, { tagName: "TEXTAREA" })), true);
  assert.equal(core.shouldWait(doc(false, { tagName: "DIV", isContentEditable: true })), true);
  assert.equal(core.shouldWait(doc(false, { tagName: "BUTTON" })), false);
  assert.equal(core.shouldWait(doc(false, null)), false);
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/popup/cobalt.js");

test("getCobaltCookie returns the DDB session cookie value", async () => {
  let filter;
  const cookies = { getAll: (f, callback) => { filter = f; callback([{ value: "abc" }]); } };
  assert.equal(await core.getCobaltCookie(cookies), "abc");
  assert.deepEqual(filter, { name: "CobaltSession", domain: ".dndbeyond.com" });
});

test("getCobaltCookie returns null when not logged in", async () => {
  assert.equal(await core.getCobaltCookie({ getAll: (_f, callback) => callback([]) }), null);
  assert.equal(await core.getCobaltCookie({ getAll: (_f, callback) => callback(undefined) }), null);
});

test("ensureHostAccess only asks when access is missing", async () => {
  let asked = 0;
  const granted = { contains: async () => true, request: async () => { asked += 1; return true; } };
  assert.equal(await core.ensureHostAccess(granted), true);
  assert.equal(asked, 0);

  const missing = { contains: async () => false, request: async ({ origins }) => { asked += 1; return origins.length === 2; } };
  assert.equal(await core.ensureHostAccess(missing), true);
  assert.equal(asked, 1);

  const refused = { contains: async () => false, request: async () => false };
  assert.equal(await core.ensureHostAccess(refused), false);
});

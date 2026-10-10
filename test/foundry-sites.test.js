const { test } = require("node:test");
const assert = require("node:assert/strict");
const sites = require("../src/foundry-sites.js");

test("sitePattern covers the whole host and refuses non-web and D&D Beyond pages", () => {
  assert.equal(sites.sitePattern("http://localhost:30000/game"), "http://localhost/*");
  assert.equal(sites.sitePattern("https://foundry.example.org/join"), "https://foundry.example.org/*");
  assert.equal(sites.sitePattern("https://mygame.forge-vtt.com/game"), "https://mygame.forge-vtt.com/*");
  assert.equal(sites.sitePattern("https://www.dndbeyond.com/characters/1"), null);
  assert.equal(sites.sitePattern("https://dndbeyond.com/"), null);
  assert.equal(sites.sitePattern("chrome://extensions"), null);
  assert.equal(sites.sitePattern("not a url"), null);
});

test("script ids round trip to their site pattern", () => {
  const id = sites.scriptId("http://localhost/*");
  assert.equal(sites.patternFromScriptId(id), "http://localhost/*");
  assert.equal(sites.patternFromScriptId("something-else"), null);
});

test("isConnectedUrl matches only connected sites", () => {
  const connected = ["http://localhost/*"];
  assert.equal(sites.isConnectedUrl("http://localhost:31412/game", connected), true);
  assert.equal(sites.isConnectedUrl("https://localhost/game", connected), false);
  assert.equal(sites.isConnectedUrl("http://evil.example/game", connected), false);
});

test("connectedSites reads the registered bridge scripts", async () => {
  const scripting = {
    getRegisteredContentScripts: async () => [
      { id: sites.scriptId("http://localhost/*") },
      { id: "unrelated" },
      { id: sites.scriptId("https://foundry.example.org/*") },
    ],
  };
  assert.deepEqual(await sites.connectedSites(scripting), ["http://localhost/*", "https://foundry.example.org/*"]);
});

// Builds browser packages into dist/<browser>/ from the repo files.
// manifest.json is the Chrome/Edge manifest (also used by "Load unpacked" on the repo folder).
// Firefox has no extension service workers, so its copy loads the background as event-page
// scripts and carries the gecko id; Chrome rejects background.scripts in Manifest V3.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FILES = ["src", "icons", "LICENSE", "README.md"];

const FIREFOX = {
  background: { scripts: ["src/foundry-sites.js", "src/background.js"] },
  browser_specific_settings: {
    gecko: {
      id: "ddbi-utilities-extension@mrprimate.co.uk",
      strict_min_version: "128.0",
      // nothing leaves the browser: the cookie only goes to the user's own connected Foundry page
      data_collection_permissions: { required: ["none"] },
    },
  },
};

function build(browser) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  if (browser === "firefox") Object.assign(manifest, FIREFOX);
  const out = path.join(ROOT, "dist", browser);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const file of FILES) fs.cpSync(path.join(ROOT, file), path.join(out, file), { recursive: true });
  fs.writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`built dist/${browser}`);
}

const targets = process.argv.slice(2);
for (const browser of targets.length ? targets : ["chrome", "firefox"]) build(browser);

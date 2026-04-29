import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

assert.match(appJs, /primaryPositionPill\.classList\.toggle\("is-long-position", primaryPosition\.length > 3\)/, "Roster cards should mark long position labels such as Coach");
assert.match(stylesCss, /\.roster-grid \.player-position-pill\.is-long-position \{[\s\S]*font-size: 0\.95rem;[\s\S]*white-space: nowrap;/, "Long roster position labels should fit inside the desktop badge");
assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.roster-grid \.player-position-pill\.is-long-position \{[\s\S]*font-size: 0\.74rem;/, "Long roster position labels should fit inside the mobile badge");

console.log("Roster long position badge checks passed.");

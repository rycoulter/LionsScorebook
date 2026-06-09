import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const calendarCellsBody = functionBody(appJs, "buildScheduleCalendarCells");

assert.match(
  calendarCellsBody,
  /const games = outsideMonth \? \[\] : \(gamesByDate\.get\(dateValue\) \|\| \[\]\)/,
  "Outside-month calendar cells should not render games from neighboring months"
);
assert.match(
  calendarCellsBody,
  /<div class="schedule-calendar-date">\$\{outsideMonth \? "" : escapeHtml\(String\(cellDate\.getUTCDate\(\)\)\)\}<\/div>/,
  "Outside-month calendar cells should not show date numbers"
);
assert.match(
  calendarCellsBody,
  /<div class="schedule-calendar-date-label">\$\{outsideMonth \? "" : escapeHtml\(mobileDateLabel\)\}<\/div>/,
  "Outside-month calendar cells should not show mobile date labels"
);

console.log("Schedule calendar month checks passed.");

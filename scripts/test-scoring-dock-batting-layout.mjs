import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

function mustMatch(source, pattern, label) {
  assert.match(source, pattern, label);
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

mustMatch(indexHtml, /id="scoringDockSummary"/, "Scoring dock should expose a layout state container");
mustMatch(indexHtml, /id="dockPitcherCard"/, "Opponent batting dock should keep the pitcher section");
mustMatch(indexHtml, /id="dockBatterNumber"/, "Lions batting dock should show the batter number badge");
mustMatch(indexHtml, /id="dockSeasonCard"[\s\S]*id="dockBatterSeasonLine"/, "Lions batting dock should include season stats");
mustMatch(indexHtml, /id="dockViewLineupBtn"[\s\S]*View Lineup/, "Lions batting dock should include View Lineup");
mustMatch(indexHtml, /id="dockOpponentLineupBtn"[\s\S]*<strong>Lineup<\/strong>/, "Opponent At Bat section should include a compact Lineup button");
const opponentLineupButtonMarkup = indexHtml.slice(
  indexHtml.indexOf('id="dockOpponentLineupBtn"'),
  indexHtml.indexOf("</button>", indexHtml.indexOf('id="dockOpponentLineupBtn"')) + "</button>".length
);
assert.equal(opponentLineupButtonMarkup.includes("<svg"), false, "Opponent Lineup button should be text-only");
const pitchModeStart = indexHtml.indexOf('id="scoringStepPanel"');
const dockFooterStart = indexHtml.indexOf('id="scoringDockFooter"');
const opponentLineupButton = indexHtml.indexOf('id="dockOpponentLineupBtn"');
assert.ok(opponentLineupButton > dockFooterStart, "Opponent Lineup button should live in the scoring dock");
assert.equal(
  indexHtml.slice(pitchModeStart, dockFooterStart).includes('id="dockOpponentLineupBtn"'),
  false,
  "Opponent Lineup button should not be inside Pitch Mode controls"
);

const renderDockBody = functionBody(appJs, "renderScoringDockUtilities");
mustMatch(renderDockBody, /const lionsBatting = isLionsAtBat\(game\)/, "Dock render should detect Lions batting state");
mustMatch(renderDockBody, /classList\.toggle\("is-lions-batting", lionsBatting\)/, "Dock should apply the Lions batting layout class");
mustMatch(renderDockBody, /classList\.toggle\("is-opponent-batting", opponentBatting\)/, "Dock should apply the opponent batting layout class");
mustMatch(renderDockBody, /dockPitcherCard\) els\.dockPitcherCard\.hidden = lionsBatting/, "Pitcher card should hide when Lions are batting");
mustMatch(renderDockBody, /dockSeasonCard\) els\.dockSeasonCard\.hidden = opponentBatting/, "Season card should hide when opponent is batting");
mustMatch(renderDockBody, /dockViewLineupBtn\) els\.dockViewLineupBtn\.hidden = opponentBatting/, "Lineup button should hide when opponent is batting");
mustMatch(renderDockBody, /dockBatterNumber\) els\.dockBatterNumber\.hidden = opponentBatting/, "Batter number badge should hide when opponent is batting");
mustMatch(renderDockBody, /dockOpponentLineupBtn\) els\.dockOpponentLineupBtn\.hidden = lionsBatting/, "Opponent Lineup button should hide when Lions are batting");
mustMatch(renderDockBody, /dockOpponentLineupBtn\.disabled = !canScore \|\| lionsBatting/, "Opponent Lineup button should only be active during opponent scoring");
mustMatch(renderDockBody, /setAttribute\("aria-label", `Edit \$\{game\.opponent \|\| "opponent"\} lineup`\)/, "Opponent Lineup button should expose an accessible edit label");
mustMatch(renderDockBody, /dockChangePitcherBtn\.disabled = !canScore \|\| lionsBatting/, "Pitcher Change button should be disabled outside opponent scoring");
mustMatch(renderDockBody, /dockViewLineupBtn\.disabled = !game \|\| opponentBatting/, "View Lineup should be disabled outside Lions batting");

mustMatch(appJs, /dockOpponentLineupBtn\?\.addEventListener\("click", openOpponentLineupFocusModal\)/, "Opponent Lineup button should open the lineup editor modal");
const openOpponentBody = functionBody(appJs, "openOpponentLineupFocusModal");
mustMatch(openOpponentBody, /if \(!game \|\| !isOpponentAtBat\(game\)\) return/, "Opponent lineup editor should only open while opponent is batting");
mustMatch(openOpponentBody, /openLineupFocusModal\(\)/, "Opponent lineup editor should reuse the lineup modal");

mustMatch(stylesCss, /scoring-dock-summary\.is-lions-batting \.scoring-dock-pitcher-card/, "Lions layout should suppress the pitcher section");
mustMatch(stylesCss, /scoring-dock-summary\.is-opponent-batting[\s\S]*grid-template-areas: "count pitcher batter"/, "Opponent layout should use Count/Pitcher/At Bat grid");
mustMatch(stylesCss, /scoring-dock-summary\.is-opponent-batting \.scoring-dock-season-card/, "Opponent layout should suppress Lions season stats");
mustMatch(stylesCss, /scoring-dock-summary\.is-opponent-batting \.scoring-dock-lineup-card/, "Opponent layout should suppress Lions lineup button");
mustMatch(stylesCss, /scoring-dock-opponent-lineup-btn[\s\S]*cursor: pointer/, "Opponent Lineup button should feel clickable");
assert.equal(
  /score-field-control-stack \.scoring-dock-summary\s*\{[\s\S]{0,220}grid-template-areas: "count pitcher batter"/.test(stylesCss),
  false,
  "Opponent Count/Pitcher/At Bat grid should not apply to every scoring dock"
);

console.log("Scoring dock batting layout checks passed.");

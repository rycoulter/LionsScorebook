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
  const match = new RegExp(`function\\s+${functionName}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

mustMatch(indexHtml, /id="boxScoreEditBtn"[\s\S]*Edit Box Score/, "Desktop box score should have an edit button");
mustMatch(indexHtml, /id="boxScoreMobileEditBtn"[\s\S]*Edit/, "Mobile box score should have an edit button");
mustMatch(indexHtml, /id="boxScoreEditModal"[\s\S]*Edit Box Score/, "Box score edit modal should exist");
mustMatch(indexHtml, /id="boxScoreEditFields"/, "Box score edit modal should have dynamic fields");
mustMatch(indexHtml, /id="boxScoreEditForm"/, "Box score edit modal should have a save form");

mustMatch(appJs, /boxScoreEditBtn: document\.getElementById\("boxScoreEditBtn"\)/, "Box score edit button should be registered");
mustMatch(appJs, /boxScoreMobileEditBtn: document\.getElementById\("boxScoreMobileEditBtn"\)/, "Mobile box score edit button should be registered");
mustMatch(appJs, /boxScoreLineEdits/, "Game-level box score line edit storage should exist");

const renderBody = functionBody(appJs, "renderBoxScore");
mustMatch(renderBody, /setBoxScoreEditButtonsVisible\(false\)/, "Edit buttons should hide when no game is selected");
mustMatch(renderBody, /setBoxScoreEditButtonsVisible\(isAdminMode\(\)\)/, "Edit buttons should only display in admin mode");

const openBody = functionBody(appJs, "openBoxScoreEditModal");
mustMatch(openBody, /requireAdminAccess\("Admin sign-in required to edit box scores\."\)/, "Opening the editor should require admin access");
mustMatch(openBody, /renderBoxScoreEditForm\(game\)/, "Opening the editor should render current game values");

const lineBody = functionBody(appJs, "boxScoreLineForTeam");
mustMatch(lineBody, /boxScoreLineEditForTeam\(game, team\.key\)/, "Line score should look up saved box score edits");
mustMatch(lineBody, /normalizeBoxScoreLineEdit\(edit, innings, computedLine\)/, "Line score should apply normalized overrides");

const teamFormBody = functionBody(appJs, "renderBoxScoreEditTeam");
["data-box-score-edit-inning", "data-box-score-edit-field=\"runs\"", "data-box-score-edit-field=\"hits\"", "data-box-score-edit-field=\"errors\""].forEach((snippet) => {
  mustMatch(teamFormBody, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Editor should include ${snippet}`);
});

const saveBody = functionBody(appJs, "saveBoxScoreEdit");
mustMatch(saveBody, /collectBoxScoreEditForTeam\("lions", innings\)/, "Saving should collect Lions line score edits");
mustMatch(saveBody, /collectBoxScoreEditForTeam\("opponent", innings\)/, "Saving should collect opponent line score edits");
mustMatch(saveBody, /game\.score = \{[\s\S]*lions: lionsEdit\.runs,[\s\S]*opponent: opponentEdit\.runs/, "Saving should update total runs on game.score");
mustMatch(saveBody, /syncScoreBySide\(game\)/, "Saving should keep side-based score fields aligned");
mustMatch(saveBody, /markSharedGamesDirty\(game\.id\)/, "Saving should mark the game dirty for shared sync");
mustMatch(saveBody, /queueCompletedGameSync\(game\.id, \{ reason: "box-score-edit" \}\)/, "Saving a final game should queue completed-game sync");
mustMatch(saveBody, /requestSharedSnapshotSync\("box-score-edit"\)/, "Saving should request shared snapshot sync");

mustMatch(stylesCss, /\.box-score-edit-modal-card/, "Box score edit modal should be styled");
mustMatch(stylesCss, /\.box-score-edit-innings[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(58px, 1fr\)\)/, "Inning inputs should use a responsive grid");
mustMatch(stylesCss, /\.box-score-edit-totals[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, "Total inputs should use a three-column grid");

console.log("Box score line editing checks passed.");

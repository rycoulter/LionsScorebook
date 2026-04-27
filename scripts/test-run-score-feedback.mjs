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

mustMatch(indexHtml, /id="runScoreFeedbackLayer"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/, "Field should include an accessible run-score feedback layer");
mustMatch(appJs, /runScoreFeedbackLayer: document\.getElementById\("runScoreFeedbackLayer"\)/, "Run-score feedback layer should be registered");
mustMatch(appJs, /let runScoreFeedback = null/, "Run-score feedback should use local state");
mustMatch(appJs, /let pendingBatterIntroKey = ""/, "Batter intro should support delayed rendering while run-score feedback is active");
mustMatch(appJs, /const RUN_SCORE_FEEDBACK_DURATION_MS = 1500/, "Run-score feedback duration should be 1500ms");

const addRunsBody = functionBody(appJs, "addRunsForBattingTeam");
mustMatch(addRunsBody, /const runsAdded = Number\(runs\) \|\| 0/, "addRunsForBattingTeam should normalize runs added");
mustMatch(addRunsBody, /if \(!runsAdded\) return/, "Run-score feedback should not trigger for zero-run plays");
mustMatch(addRunsBody, /const feedback = runScoreFeedbackForBattingTeam\(game, runsAdded\)/, "Scoring team should be captured before score mutation");
mustMatch(addRunsBody, /syncScoreBySide\(game\);[\s\S]*triggerRunScoreFeedback\(feedback\)/, "Run-score feedback should trigger after the existing score update");

const scoringTeamBody = functionBody(appJs, "runScoreFeedbackForBattingTeam");
mustMatch(scoringTeamBody, /const battingSide = sideForHalf\(game\)/, "Scoring team should come from the half-inning batting side");
mustMatch(scoringTeamBody, /teamId = battingSide === lionsSide\(game\) \? "lions" : "opponent"/, "Scoring team id should distinguish Lions from opponent");
mustMatch(scoringTeamBody, /logoUrl: scoreboardTeamLogo\(teamName, battingSide, game\)/, "Run-score feedback should show the scoring team's logo");
mustMatch(scoringTeamBody, /runs: Number\(runs\) \|\| 0/, "Run-score feedback should carry the combined run count");

const renderBody = functionBody(appJs, "renderRunScoreFeedbackLayer");
mustMatch(renderBody, /runScoreFeedback\.teamId === "lions"[\s\S]*"LIONS SCORED"/, "Lions runs should show the Lions scored label");
mustMatch(renderBody, /\+`\$\{runs\}|`\+\$\{runs\}/, "Run-score feedback should show +N runs");
mustMatch(renderBody, /runs === 1 \? "RUN" : "RUNS"/, "Run-score feedback should pluralize RUN/RUNS");
mustMatch(renderBody, /run-score-feedback-logo/, "Run-score feedback should render a logo");
mustMatch(renderBody, /--run-score-color/, "Run-score feedback should use team color CSS variables");

const triggerBody = functionBody(appJs, "triggerRunScoreFeedback");
mustMatch(triggerBody, /if \(!runs\) return/, "Run-score feedback should not trigger for zero runs");
mustMatch(triggerBody, /runScoreFeedbackSequence/, "Repeated run-score feedback should retrigger with unique ids");
mustMatch(triggerBody, /setTimeout\(\(\) => clearRunScoreFeedback\(feedbackId\), RUN_SCORE_FEEDBACK_DURATION_MS\)/, "Run-score feedback should auto-clear");

const batterIntroBody = functionBody(appJs, "renderBatterIntro");
mustMatch(batterIntroBody, /if \(runScoreFeedback\)[\s\S]*pendingBatterIntroKey = introKey/, "Batter intro should wait while run-score feedback is visible");
mustMatch(batterIntroBody, /if \(runScoreFeedback\)[\s\S]*clearBatterIntroTimer\(\)/, "Delayed batter intro should clear any active intro timer");
mustMatch(batterIntroBody, /if \(runScoreFeedback\)[\s\S]*syncBatterIntroLockState\(false\)/, "Delayed batter intro should keep scoring controls unlocked while waiting");

const clearFeedbackBody = functionBody(appJs, "clearRunScoreFeedback");
mustMatch(clearFeedbackBody, /const delayedBatterIntroKey = pendingBatterIntroKey/, "Run-score clear should capture a delayed batter intro");
mustMatch(clearFeedbackBody, /if \(delayedBatterIntroKey\)[\s\S]*clearPendingBatterIntro\(\);[\s\S]*renderBatterIntro\(activeGame\(\)\)/, "Delayed batter intro should render after run-score feedback clears");

const dismissBatterIntroBody = functionBody(appJs, "dismissBatterIntro");
mustMatch(dismissBatterIntroBody, /clearPendingBatterIntro\(\)/, "Dismissing batter intro should cancel any delayed intro");

mustMatch(stylesCss, /\.run-score-feedback-layer[\s\S]*pointer-events: none/, "Run-score overlay should not block gameplay clicks");
mustMatch(stylesCss, /\.run-score-feedback[\s\S]*animation: runScoreOverlay 1500ms ease-out forwards/, "Run-score overlay should animate for 1500ms");
mustMatch(stylesCss, /@keyframes runScoreLogoPop/, "Run-score logo pop animation should exist");
mustMatch(stylesCss, /@keyframes runScoreTextRise/, "Run-score text rise animation should exist");
mustMatch(stylesCss, /prefers-reduced-motion: reduce[\s\S]*\.run-score-feedback,[\s\S]*\.run-score-feedback-logo-wrap,[\s\S]*\.run-score-feedback-team,[\s\S]*\.run-score-feedback-runs[\s\S]*animation: none/, "Run-score feedback should respect reduced motion");

mustMatch(appJs, /const PITCH_FEEDBACK_DURATION_MS = 700/, "Existing pitch feedback timing should remain unchanged");
mustMatch(appJs, /const ACTION_FEEDBACK_DURATION_MS = 600/, "Existing action feedback timing should remain unchanged");

console.log("Run-score feedback regression checks passed.");

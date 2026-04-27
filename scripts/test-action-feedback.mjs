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

mustMatch(indexHtml, /id="actionFeedbackLayer"[^>]+aria-live="polite"[^>]+aria-atomic="true"/, "Action feedback layer should be live and atomic");
mustMatch(appJs, /let actionFeedback = null/, "Action feedback should use its own state");
mustMatch(appJs, /const ACTION_FEEDBACK_DURATION_MS = 600/, "Action feedback should clear after 600ms");
mustMatch(appJs, /function triggerActionFeedback/, "Reusable action feedback trigger should exist");
mustMatch(appJs, /function actionFeedbackForButton/, "Button-to-feedback mapper should exist");
mustMatch(appJs, /scoringStepPanel\.addEventListener\("pointerdown", handleActionFeedbackPointerDown\)/, "Action feedback should start the press animation on pointer down");

const pitchOutcomeBody = functionBody(appJs, "actionFeedbackForPitchOutcome");
mustMatch(pitchOutcomeBody, /outcome === "in_play"[\s\S]*"IN PLAY"/, "In Play should map to an amber action label");
mustMatch(pitchOutcomeBody, /outcome === "foul"[\s\S]*"FOUL"/, "Foul should map to a foul action label");
assert.equal(/outcome === "ball"/.test(pitchOutcomeBody), false, "Ball should not be handled by action feedback");
assert.equal(/outcome === "strike"/.test(pitchOutcomeBody), false, "Strike should not be handled by action feedback");

const resultBody = functionBody(appJs, "actionFeedbackForResult");
for (const [result, label] of [["1B", "1B"], ["2B", "2B"], ["3B", "3B"], ["HR", "HR"]]) {
  mustMatch(resultBody, new RegExp(`normalized === "${result}"[\\s\\S]*"${label}"`), `${result} should map to ${label} feedback`);
}
mustMatch(resultBody, /\["OUT", "GO", "FO", "LO", "FC", "DP", "SAC", "K", "CS", "PO"\]\.includes\(normalized\)[\s\S]*"OUT"/, "Out-style results should map to OUT feedback");

const runnerChoiceBody = functionBody(appJs, "actionFeedbackForRunnerChoice");
mustMatch(runnerChoiceBody, /choice === "home"[\s\S]*"RUN"/, "Runner scoring choices should map to RUN feedback");
mustMatch(runnerChoiceBody, /choice === "out"[\s\S]*"OUT"/, "Runner out choices should map to OUT feedback");

const buttonBody = functionBody(appJs, "actionFeedbackForButton");
mustMatch(buttonBody, /button\.id === "panelUndoPitchBtn"[\s\S]*"UNDO"/, "Undo Pitch should map to UNDO feedback");
mustMatch(buttonBody, /button\.id === "dockUndoLastPlayBtn"[\s\S]*"UNDO PLAY"/, "Undo Play should map to UNDO PLAY feedback");
mustMatch(buttonBody, /button\.dataset\.stepPitch[\s\S]*actionFeedbackForPitchOutcome/, "Pitch-mode non-ball/strike buttons should be mapped");
mustMatch(buttonBody, /button\.dataset\.specialAction[\s\S]*actionFeedbackForSpecialAction/, "Special runner actions should be mapped");
mustMatch(buttonBody, /button\.dataset\.runnerAction[\s\S]*actionFeedbackForSpecialAction/, "Runner panel action buttons should be mapped");
mustMatch(buttonBody, /button\.dataset\.runnerReplacementId[\s\S]*"NR"/, "Non-runner choices should map to NR feedback");
mustMatch(buttonBody, /button\.dataset\.stepOutcome[\s\S]*actionFeedbackForResult/, "Scoring outcome buttons should be mapped");
mustMatch(buttonBody, /button\.dataset\.runnerOutBase[\s\S]*"OUT"/, "Runner-out panel buttons should map to OUT feedback");
mustMatch(buttonBody, /button\.dataset\.runnerChoice[\s\S]*actionFeedbackForRunnerChoice/, "Runner advancement buttons should be mapped");
mustMatch(buttonBody, /button\.dataset\.resolvePlay[\s\S]*"PLAY"/, "Resolve Play buttons should map to PLAY feedback");
mustMatch(buttonBody, /button\.dataset\.choiceGroup === "result"[\s\S]*actionFeedbackForResult/, "Legacy score-form result buttons should be mapped");

const clickBody = functionBody(appJs, "handleScoringPanelClick");
mustMatch(clickBody, /if \(feedbackType\) triggerPitchFeedback\(feedbackType, button\);\s*else triggerActionFeedback\(actionFeedbackForButton\(button\), button\);/, "Non-ball/strike pitch buttons should trigger action feedback without changing ball/strike feedback");
mustMatch(clickBody, /button\.dataset\.stepOutcome[\s\S]*triggerActionFeedback\(actionFeedbackForButton\(button\), button\)[\s\S]*applyEvent\(activeGame\(\), \{ type: "ball_in_play"/, "Outcome feedback should fire before scoring logic");
mustMatch(clickBody, /button\.dataset\.confirmPlay[\s\S]*triggerActionFeedback\(actionFeedbackForButton\(button\), button\)[\s\S]*applyEvent\(activeGame\(\), \{ type: "resolve_play" \}\)/, "Confirm Play feedback should not delay resolve logic");

const pointerBody = functionBody(appJs, "handleActionFeedbackPointerDown");
mustMatch(pointerBody, /actionFeedbackForButton\(button\)/, "Pointer feedback should use the shared mapper");
mustMatch(pointerBody, /if \(!feedback\) return/, "Pointer feedback should ignore buttons without action feedback, including Ball and Strike");
mustMatch(pointerBody, /syncActionFeedbackButtonState\(button, feedback\)/, "Pointer feedback should apply the press animation before click rerenders");

mustMatch(appJs, /panelUndoPitchBtn\.addEventListener\("click", \(event\) => \{[\s\S]*triggerActionFeedback\(actionFeedbackForButton\(event\.currentTarget\), event\.currentTarget\);[\s\S]*undoPitch\(\)/, "Undo Pitch should trigger action feedback before undoing");
mustMatch(appJs, /dockUndoLastPlayBtn\?\.addEventListener\("click", \(event\) => \{[\s\S]*triggerActionFeedback\(actionFeedbackForButton\(event\.currentTarget\), event\.currentTarget\);[\s\S]*undoLastPlay\(\)/, "Undo Play should trigger action feedback before undoing");
mustMatch(appJs, /runnerActionButtons\.forEach\(\(button\) => \{[\s\S]*button\.addEventListener\("pointerdown", handleActionFeedbackPointerDown\);[\s\S]*triggerActionFeedback\(actionFeedbackForButton\(button\), button\)/, "Runner action buttons should use shared action feedback");
mustMatch(appJs, /runnerOutButtons\.forEach\(\(button\) => \{[\s\S]*triggerActionFeedback\(actionFeedbackForButton\(button\), button\)/, "Runner out buttons should use shared action feedback");
mustMatch(appJs, /resolvePlayBtn\?\.addEventListener\("click"[\s\S]*triggerActionFeedback\(actionFeedbackForButton\(els\.resolvePlayBtn\), els\.resolvePlayBtn\)/, "Resolve Play should use shared action feedback");

mustMatch(stylesCss, /\.action-feedback-layer[\s\S]*position: absolute/, "Action feedback layer should overlay controls");
mustMatch(stylesCss, /\.action-button--feedback[\s\S]*animation: actionButtonConfirm 360ms ease-out/, "Buttons should share one press animation class");
mustMatch(stylesCss, /@keyframes actionFeedbackFloat/, "Floating action label animation should exist");
mustMatch(stylesCss, /@keyframes actionButtonConfirm/, "Action button press animation should exist");
mustMatch(stylesCss, /prefers-reduced-motion: reduce[\s\S]*\.action-feedback,[\s\S]*\.action-button--feedback[\s\S]*animation: none/, "Reduced motion should disable action feedback animation");

mustMatch(appJs, /const PITCH_FEEDBACK_DURATION_MS = 700/, "Existing ball/strike timing should remain 700ms");
mustMatch(stylesCss, /@keyframes pitchFeedbackPop/, "Existing ball/strike floating animation should remain");
mustMatch(stylesCss, /@keyframes pitchButtonConfirm/, "Existing ball/strike button animation should remain");

console.log("Action feedback regression checks passed.");

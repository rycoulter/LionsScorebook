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

mustMatch(indexHtml, /id="pitchFeedbackLayer"[^>]+aria-live="polite"[^>]+aria-atomic="true"/, "Pitch feedback layer should be live and atomic");
mustMatch(appJs, /let lastPitchFeedback = null/, "Pitch feedback should use local UI state");
mustMatch(appJs, /const PITCH_FEEDBACK_DURATION_MS = 700/, "Pitch feedback should clear after 700ms");
mustMatch(appJs, /function triggerPitchFeedback/, "Pitch feedback trigger should exist");
mustMatch(appJs, /pitchFeedbackTimer = setTimeout\(\(\) => clearPitchFeedback\(feedbackId\), PITCH_FEEDBACK_DURATION_MS\)/, "Pitch feedback should clear itself");

const typeBody = functionBody(appJs, "pitchFeedbackTypeForOutcome");
mustMatch(typeBody, /outcome === "ball"[\s\S]*return "ball"/, "Ball pitch should map to ball feedback");
mustMatch(typeBody, /\["strike", "called_strike", "swinging_strike"\]\.includes\(outcome\)[\s\S]*return "strike"/, "Strike pitch outcomes should map to strike feedback");

const clickBody = functionBody(appJs, "handleScoringPanelClick");
assert.ok(
  clickBody.indexOf("triggerPitchFeedback(feedbackType, button)") < clickBody.indexOf('applyEvent(activeGame(), { type: "pitch"'),
  "Feedback should trigger before pitch game logic applies"
);

const pitchChoiceBody = functionBody(appJs, "pitchChoiceActionCard");
mustMatch(pitchChoiceBody, /pitchFeedbackClassForOutcome\(value\)/, "Primary pitch cards should receive feedback class");
const stepButtonBody = functionBody(appJs, "stepButton");
mustMatch(stepButtonBody, /pitchFeedbackClassForOutcome\(value\)/, "Ball/strike menu buttons should receive feedback class");

mustMatch(stylesCss, /\.pitch-feedback-layer[\s\S]*position: absolute/, "Feedback layer should overlay pitch controls");
mustMatch(stylesCss, /@keyframes pitchFeedbackPop/, "Floating label animation should exist");
mustMatch(stylesCss, /@keyframes pitchButtonConfirm/, "Button confirmation animation should exist");
mustMatch(stylesCss, /\.pitch-feedback--ball[\s\S]*#22c55e/, "Ball feedback should be green");
mustMatch(stylesCss, /\.pitch-feedback--strike[\s\S]*#ef4444/, "Strike feedback should be red");
mustMatch(stylesCss, /prefers-reduced-motion: reduce[\s\S]*\.pitch-feedback[\s\S]*animation: none/, "Reduced motion should disable animation");

console.log("Pitch feedback regression checks passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");

function mustMatch(source, pattern, label) {
  assert.match(source, pattern, label);
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const helperBody = functionBody(appJs, "triggerHaptic");
mustMatch(helperBody, /typeof navigator !== "undefined"/, "Haptics should guard navigator access");
mustMatch(helperBody, /typeof navigator\.vibrate === "function"/, "Haptics should feature-detect navigator.vibrate");
mustMatch(helperBody, /navigator\.vibrate\(pattern\)/, "Haptics should use the supplied vibration pattern");
mustMatch(helperBody, /catch \(error\)[\s\S]*visual feedback remains the source of truth/, "Haptics should fail silently when unsupported or blocked");

const pitchFeedbackBody = functionBody(appJs, "triggerPitchFeedback");
mustMatch(pitchFeedbackBody, /if \(!\["ball", "strike"\]\.includes\(type\)\) return;[\s\S]*triggerHaptic\(\)/, "Ball/Strike haptics should only run for valid direct pitch feedback");
mustMatch(pitchFeedbackBody, /renderPitchFeedbackLayer\(\)/, "Ball/Strike visual feedback should remain the primary confirmation");
mustMatch(pitchFeedbackBody, /setTimeout\(\(\) => clearPitchFeedback\(feedbackId\), PITCH_FEEDBACK_DURATION_MS\)/, "Ball/Strike feedback timing should remain unchanged");

const actionFeedbackBody = functionBody(appJs, "triggerActionFeedback");
mustMatch(actionFeedbackBody, /if \(!feedback\?\.label\) return;[\s\S]*triggerHaptic\(\)/, "Action haptics should only run for mapped action-feedback interactions");
mustMatch(actionFeedbackBody, /renderActionFeedbackLayer\(\)/, "Action visual feedback should remain the primary confirmation");
mustMatch(actionFeedbackBody, /syncActionFeedbackButtonState\(sourceButton, actionFeedback\)/, "Action button press animation should remain primary feedback");

const pointerBody = functionBody(appJs, "handleActionFeedbackPointerDown");
assert.equal(/triggerHaptic/.test(pointerBody), false, "Pointer preview should not vibrate before a committed action");

console.log("Haptic feedback progressive-enhancement checks passed.");

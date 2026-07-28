import assert from "node:assert/strict";
import {
  VALID_COLOR_SPACES, VALID_TRANSFORM_CLASSES, VALID_CONFIDENCE, VALID_LICENSE_BASIS,
} from "./lib/color-space-ids.mjs";
import {
  SUBMISSION_COLOR_SPACES, SUBMISSION_TRANSFORM_CLASSES,
  SUBMISSION_CONFIDENCE, SUBMISSION_LICENSE_BASIS,
} from "../site/community-vocabularies.js";

const sorted = (values) => [...values].sort();
assert.deepEqual(sorted(SUBMISSION_COLOR_SPACES), sorted(VALID_COLOR_SPACES), "color-space vocabularies drifted");
assert.deepEqual(sorted(SUBMISSION_TRANSFORM_CLASSES), sorted(VALID_TRANSFORM_CLASSES), "transform classes drifted");
assert.deepEqual(sorted(SUBMISSION_CONFIDENCE), sorted(VALID_CONFIDENCE), "confidence vocabulary drifted");
assert.deepEqual(sorted(SUBMISSION_LICENSE_BASIS), sorted(VALID_LICENSE_BASIS), "license-basis vocabulary drifted");
console.log("Community integration vocabularies match the server.");

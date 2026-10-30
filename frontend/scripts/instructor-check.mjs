import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

function loadModule(
  path,
  require = () => {
    throw new Error("Unexpected import");
  },
) {
  const context = { exports: {}, require };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    context,
  );
  return context.exports;
}
const helpers = loadModule("../src/features/instructor/reviewForm.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const rubric = {
  id: "rubric-1",
  publishedAt: "2026-10-01T00:00:00.000Z",
  rubricCriterions: ["TR", "CC", "LR", "GRA"].map((code) => ({
    id: `criterion-${code}`,
    code,
    name: code,
    weight: "1",
    maxScore: "9",
  })),
};
const ai = {
  id: "ai-1",
  revisionId: "revision-1",
  kind: "AI",
  rubricVersionId: rubric.id,
  summary: "AI suggestion",
  criterionScores: rubric.rubricCriterions.map((criterion) => ({
    id: `score-${criterion.code}`,
    criterionId: criterion.id,
    score: "6.5",
    explanation: "AI explanation",
    criterion: { code: criterion.code, name: criterion.name },
  })),
  findings: [
    {
      id: "finding-1",
      criterionScoreId: "score-CC",
      skillId: "skill-1",
      findingKind: "LOCAL",
      explanation: "Connect these ideas more clearly.",
      findingAnchors: [
        { paragraphId: "paragraph-1", exactQuote: "First idea." },
      ],
    },
  ],
  aiResult: { gradingRunId: "run-1", qualityStatus: "FLAGGED" },
  teacherResult: null,
  acceptedAssessment: null,
  skillObservations: [],
};
const detail = {
  id: "review-1",
  revisionId: "revision-1",
  targetRunId: "run-1",
  status: "CLAIMED",
  assigneeId: "teacher-1",
  lockVersion: 3,
  reviewDecisions: [],
  availableSkills: [
    {
      id: "skill-1",
      code: "writing.coherence",
      name: "Coherence",
      description: "Connect ideas.",
    },
  ],
  revision: {
    id: "revision-1",
    responseMode: "WRITING",
    writingText: "First idea. Second idea.",
    revisionParagraphs: [
      { id: "paragraph-1", text: "First idea. Second idea." },
    ],
    assessmentResults: [ai],
    attempt: { assignmentVersion: { rubricVersion: rubric } },
  },
};
assert.equal(helpers.decimalNumber("6.5"), 6.5);
assert.throws(() => helpers.decimalNumber(""), /invalid/);
assert.throws(() => helpers.decimalNumber("Infinity"), /invalid/);
assert.equal(helpers.aiAssessment(detail).id, ai.id);
assert.equal(
  helpers.aiAssessment({ ...detail, targetRunId: "different-run" }),
  undefined,
);
assert.equal(
  helpers.aiAssessment({ ...detail, revisionId: "different-revision" }),
  undefined,
);
const wrongRubric = structuredClone(detail);
wrongRubric.revision.assessmentResults[0].rubricVersionId = "other-rubric";
assert.equal(helpers.aiAssessment(wrongRubric), undefined);

const form = helpers.createReviewForm(detail);
assert.equal(
  form.criteria.every((criterion) => criterion.score === ""),
  true,
  "AI scores must not silently become teacher decisions",
);
assert.equal(form.findings[0].approved, false);
assert.equal(form.observations[0].approved, false);
assert.equal(helpers.weightedOverall(detail, form.criteria), null);
form.reason = "Teacher verified the evidence";
form.summary = "Teacher feedback";
form.criteria.forEach((criterion) => {
  criterion.score = "0";
  criterion.explanation = "Teacher rationale";
});
assert.equal(
  helpers.weightedOverall(detail, form.criteria),
  0,
  "Band zero remains a valid score",
);
let payload = helpers.buildConfirmPayload(detail, form, "teacher-1");
assert.deepEqual(plain(payload.findings), []);
assert.deepEqual(plain(payload.observations), []);
assert.equal(payload.lockVersion, 3);
assert.equal(payload.criteria[0].score, 0);
assert.equal(
  "overallBand" in payload,
  false,
  "Server computes the weighted overall band",
);
assert.throws(
  () => helpers.buildConfirmPayload(detail, form, "teacher-2"),
  /Claim/,
);
assert.throws(
  () =>
    helpers.buildConfirmPayload(
      { ...detail, status: "PENDING" },
      form,
      "teacher-1",
    ),
  /Claim/,
);
for (const writingText of [null, "", " \n\t "]) {
  const missingWriting = structuredClone(detail);
  missingWriting.revision.writingText = writingText;
  assert.equal(helpers.canConfirmReview(missingWriting, "teacher-1"), false);
  assert.throws(
    () => helpers.buildConfirmPayload(missingWriting, form, "teacher-1"),
    /submission text is missing/,
  );
}
const duplicateCriteria = structuredClone(form);
duplicateCriteria.criteria[1].code = duplicateCriteria.criteria[0].code;
assert.throws(
  () => helpers.buildConfirmPayload(detail, duplicateCriteria, "teacher-1"),
  /exactly one/,
);
const invalidScore = structuredClone(form);
invalidScore.criteria[0].score = "6.25";
assert.throws(
  () => helpers.buildConfirmPayload(detail, invalidScore, "teacher-1"),
  /steps of 0.5/,
);

form.findings[0].approved = true;
form.observations[0].approved = true;
form.observations[0].outcome = "NOT_MET";
form.observations[0].rationale = "The relationship between ideas is unclear.";
payload = helpers.buildConfirmPayload(detail, form, "teacher-1");
assert.deepEqual(plain(payload.findings[0]), {
  code: "CC",
  skillId: "skill-1",
  kind: "LOCAL",
  explanation: "Connect these ideas more clearly.",
  anchors: [{ paragraphId: "paragraph-1", exactQuote: "First idea." }],
});
assert.deepEqual(plain(payload.observations), [
  {
    skillId: "skill-1",
    outcome: "NOT_MET",
    rationale: "The relationship between ideas is unclear.",
  },
]);
const forgedEvidence = structuredClone(form);
forgedEvidence.findings[0].anchors[0].exactQuote = "Invented quote.";
assert.throws(
  () => helpers.buildConfirmPayload(detail, forgedEvidence, "teacher-1"),
  /quote.*exactly/,
);
const differentParagraph = structuredClone(form);
differentParagraph.findings[0].anchors[0].paragraphId =
  "another-revision-paragraph";
assert.throws(
  () => helpers.buildConfirmPayload(detail, differentParagraph, "teacher-1"),
  /quote.*exactly/,
);
const missingLocalEvidence = structuredClone(form);
missingLocalEvidence.findings[0].anchors = [];
assert.throws(
  () => helpers.buildConfirmPayload(detail, missingLocalEvidence, "teacher-1"),
  /need evidence/,
);
const unavailableSkill = structuredClone(form);
unavailableSkill.observations[0].skillId = "unpublished-skill";
assert.throws(
  () => helpers.buildConfirmPayload(detail, unavailableSkill, "teacher-1"),
  /available skill/,
);
const duplicateSkill = structuredClone(form);
duplicateSkill.observations.push({
  ...duplicateSkill.observations[0],
  id: "duplicate",
});
assert.throws(
  () => helpers.buildConfirmPayload(detail, duplicateSkill, "teacher-1"),
  /at most once/,
);
const uncheckedInvalidFinding = structuredClone(forgedEvidence);
uncheckedInvalidFinding.findings[0].approved = false;
assert.equal(
  helpers.buildConfirmPayload(detail, uncheckedInvalidFinding, "teacher-1")
    .findings.length,
  0,
);

const confirmed = structuredClone(detail);
confirmed.status = "CONFIRMED";
confirmed.reviewDecisions = [
  {
    id: "decision-old",
    reviewCaseId: detail.id,
    decisionNo: 1,
    reason: "Old reason",
  },
  {
    id: "decision-new",
    reviewCaseId: detail.id,
    decisionNo: 2,
    reason: "Saved reason",
  },
];
const saved = {
  ...structuredClone(ai),
  id: "teacher-result",
  kind: "TEACHER",
  summary: "Saved teacher feedback",
  aiResult: null,
  teacherResult: { decisionId: "decision-new" },
  acceptedAssessment: { id: "accepted-1", publishedAt: null, isCurrent: false },
  skillObservations: [
    {
      id: "observation-1",
      skillId: "skill-1",
      outcome: "PARTIAL",
      rationale: "Saved rationale",
    },
  ],
};
confirmed.revision.assessmentResults.push(saved);
assert.equal(helpers.teacherAssessment(confirmed).id, "teacher-result");
assert.equal(
  helpers.acceptedAssessmentForReview(confirmed).id,
  "accepted-1",
  "Scheduled decisions remain accessible even before isCurrent becomes true",
);
const restored = helpers.createReviewForm(confirmed);
assert.equal(restored.reason, "Saved reason");
assert.equal(restored.summary, "Saved teacher feedback");
assert.equal(restored.criteria[0].score, "6.5");
assert.equal(restored.findings[0].approved, true);
assert.equal(restored.observations[0].outcome, "PARTIAL");
assert.equal(helpers.canConfirmReview(confirmed, "teacher-1"), false);

const requests = [];
const mockAxios = {
  async get(path) {
    requests.push(["GET", path]);
    return { data: path.startsWith("/teacher/reviews?") ? [] : detail };
  },
  async post(path, body) {
    requests.push(["POST", path, plain(body ?? null)]);
    return {
      data: path.endsWith("/confirm")
        ? { acceptedAssessment: { id: "accepted-1" } }
        : { id: "accepted-1" },
    };
  },
};
const api = loadModule(
  "../src/features/instructor/services/instructorApi.ts",
  () => ({ __esModule: true, default: mockAxios }),
).instructorApi;
await api.getReviewQueue();
await api.getReviewDetail("review/1");
await api.claimReview("review-1");
const response = await api.confirmReview("review-1", payload);
await api.publishAccepted(response.acceptedAssessment.id);
assert.equal(requests[0][1], "/teacher/reviews?status=OPEN");
assert.equal(requests[1][1], "/reviews/review%2F1");
assert.equal(requests[2][1], "/reviews/review-1/claim");
assert.equal(requests[3][1], "/reviews/review-1/confirm");
assert.deepEqual(requests[3][2], plain(payload));
assert.equal(requests[4][1], "/assessments/accepted-1/publish");
await api.getReviewQueue("CONFIRMED");
assert.equal(requests.at(-1)[1], "/teacher/reviews?status=CONFIRMED");
console.log(
  "Instructor checks passed: pinned evidence, explicit approval, score/skill validation, saved decisions, claim/confirm/publication API contracts.",
);

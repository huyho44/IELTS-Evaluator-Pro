import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

function load(path, require) {
  const context = { exports: {}, require, Headers, Date };
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
let responder;
const requests = [];
const client = load("../src/lib/api/studentRequest.ts", () => ({
  sessionFetch: async (path, init) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ path, method: init.method, body, headers: init.headers });
    return responder(path, init, body);
  },
}));
const writing = load("../src/features/writing/writingApi.ts", () => client);
const history = [
  { id: "older-revision", revisionNo: 1, submittedAt: "2026-10-29" },
  { id: "latest-revision", revisionNo: 2, submittedAt: "2026-10-30" },
];
assert.equal(
  writing.selectRevisionId(history, "older-revision"),
  "older-revision",
  "Notification links open the requested owned revision",
);
assert.equal(
  writing.selectRevisionId(history, "foreign-revision"),
  "latest-revision",
  "A revision from another attempt is never selected",
);
assert.equal(writing.selectRevisionId(history, null), "latest-revision");
assert.equal(writing.selectRevisionId([], "foreign-revision"), "");
const learning = load("../src/features/learning/learningApi.ts", () => client);
const plain = (value) => JSON.parse(JSON.stringify(value));
const ok = (value) => ({ ok: true, json: async () => value });
const receipt = {
  attemptId: "attempt-1",
  revisionId: "revision-1",
  submissionId: "revision-1",
  status: "QUEUED",
  gradingRunId: "run-1",
  reviewCaseId: null,
};
const attempt = {
  id: "attempt-1",
  assignmentId: "assignment-1",
  attemptNo: 1,
  status: "IN_PROGRESS",
  expiresAt: null,
  attemptDraft: {
    lockVersion: 4,
    payloadJson: { writingText: "Saved revision draft" },
  },
  submissionRevisions: [],
  assignmentVersion: {
    id: "assignment-version-1",
    mode: "PRACTICE",
    maxRevisions: 3,
    dueAt: null,
    allowLate: false,
    assignment: {
      title: "Writing Task 2",
      courseId: "course-1",
      activity: { responseMode: "WRITING", skillArea: "WRITING" },
    },
    activityVersion: {
      id: "activity-version-1",
      promptText: "Discuss both views.",
      instructions: "Write an essay.",
    },
    rubricVersion: null,
  },
};
assert.equal(
  writing.parseAttempt(attempt, attempt.id).attemptDraft.payloadJson
    .writingText,
  "Saved revision draft",
);
assert.throws(
  () => writing.parseAttempt(attempt, "another-attempt"),
  /could not be verified/,
);
const objective = structuredClone(attempt);
objective.assignmentVersion.assignment.activity.responseMode = "OBJECTIVE";
objective.attemptDraft.payloadJson = {
  itemResponses: [
    { assessmentItemId: "item-1", textAnswer: "answer", optionIds: [] },
  ],
};
assert.equal(
  writing.parseAttempt(objective, objective.id).assignmentVersion.assignment
    .activity.responseMode,
  "OBJECTIVE",
  "The dispatcher continues to support existing Reading drafts",
);
responder = () => ok({ lockVersion: 5 });
await writing.saveWritingDraft(
  attempt.id,
  "session-token",
  4,
  "My complete essay.",
);
assert.deepEqual(requests.at(-1).body, {
  lockVersion: 4,
  payload: { writingText: "My complete essay." },
});
assert.equal(requests.at(-1).method, "PUT");
responder = () => ok(receipt);
const submitted = await writing.submitWriting(
  attempt,
  "session-token",
  "My complete essay.",
);
assert.equal(submitted.revisionId, "revision-1");
assert.deepEqual(requests.at(-1).body, {
  attemptId: "attempt-1",
  writingText: "My complete essay.",
});
assert.equal(
  "itemResponses" in requests.at(-1).body,
  false,
  "Writing submissions must never include objective answers",
);
await assert.rejects(
  writing.submitWriting(attempt, "session-token", " \n "),
  /Enter an essay/,
);
assert.throws(
  () => writing.parseReceipt({ ...receipt, attemptId: "other" }, attempt.id),
  /could not be verified/,
);
assert.throws(
  () =>
    writing.parseReceipt(
      { ...receipt, submissionId: "wrong-revision" },
      attempt.id,
    ),
  /could not be verified/,
);
responder = () => ok({ id: attempt.id, status: "IN_PROGRESS" });
await writing.reopenWriting(attempt.id, "session-token");
assert.equal(requests.at(-1).path, "/api/attempts/attempt-1/revise");
assert.equal(requests.at(-1).body, undefined);
responder = () =>
  ok({
    id: "revision-1",
    attemptId: "other",
    revisionNo: 1,
    responseMode: "WRITING",
    writingText: "Text",
    paragraphs: [],
    submittedAt: "2026-10-30",
    processing: receipt,
  });
await assert.rejects(
  writing.getWritingRevision("revision-1", attempt.id, "session-token"),
  /could not be verified/,
);

const assessment = {
  id: "result-1",
  revisionId: "revision-1",
  kind: "AI",
  scoreScale: "BAND",
  overallScore: "6.5",
  summary: "Feedback",
  isOfficial: false,
  provisional: true,
  createdAt: "2026-10-30T00:00:00Z",
  criterionScores: [
    {
      id: "score-1",
      score: "6.5",
      explanation: "Develop your argument.",
      criterion: { code: "TR", name: "Task response" },
    },
  ],
  findings: [
    {
      id: "finding-1",
      explanation: "Develop this idea.",
      findingKind: "LOCAL",
      findingAnchors: [{ paragraphId: "p1", exactQuote: "My argument." }],
    },
  ],
  acceptedAssessment: null,
};
const parse = (items) =>
  writing.parseWritingAssessments(
    { revisionId: "revision-1", assessments: items },
    "revision-1",
  );
assert.equal(parse([assessment])[0].provisional, true);
assert.equal(
  parse([{ ...assessment, isOfficial: true }])[0].isOfficial,
  false,
  "Raw AI cannot become an official instructor result",
);
const official = {
  ...assessment,
  id: "teacher-result",
  kind: "TEACHER",
  isOfficial: true,
  acceptedAssessment: {
    id: "accepted-1",
    isCurrent: true,
    publishedAt: "2026-10-30T00:00:00Z",
    appeals: [],
  },
};
assert.equal(parse([assessment, official])[0].id, "teacher-result");
assert.throws(
  () => parse([{ ...assessment, revisionId: "other-revision" }]),
  /unexpected format/,
);
assert.throws(
  () => parse([{ ...assessment, overallScore: "NaN" }]),
  /unexpected format/,
);
assert.throws(
  () =>
    parse([
      {
        ...official,
        acceptedAssessment: { ...official.acceptedAssessment, appeals: "bad" },
      },
    ]),
  /review history/,
);
responder = () => ok({ id: "appeal-1" });
await writing.appealWriting(
  "accepted-1",
  " Please review the TR score. ",
  "session-token",
);
assert.equal(requests.at(-1).path, "/api/assessments/accepted-1/appeals");
assert.deepEqual(requests.at(-1).body, {
  reason: "Please review the TR score.",
});
await writing.requestWritingReview(
  "revision-1",
  "Check this feedback.",
  "session-token",
);
assert.equal(
  requests.at(-1).path,
  "/api/submission-revisions/revision-1/review-requests",
);
responder = () => ({
  ok: false,
  status: 409,
  json: async () => ({ message: "An appeal is already pending" }),
});
await assert.rejects(
  writing.appealWriting("accepted-1", "Review again.", "session-token"),
  (error) =>
    error.status === 409 && error.message === "An appeal is already pending",
);

const profile = {
  userId: "learner-1",
  profileId: "profile-1",
  versionNo: 1,
  status: "UNOBSERVED",
  skills: [
    {
      skillId: "skill-1",
      code: "writing.ideas",
      name: "Developing ideas",
      strength: null,
      support: 0,
      evidenceCount: 0,
      observationStatus: "UNKNOWN",
    },
  ],
};
assert.equal(
  learning.describeSkill(learning.parseSkillProfile(profile).skills[0]),
  "Not observed yet",
);
assert.equal(
  learning.describeSkill({
    ...profile.skills[0],
    evidenceCount: 2,
    strength: 0,
  }),
  "Needs focused practice",
);
const suggestion = {
  id: "suggestion-1",
  rank: 1,
  learningItemId: "activity-1",
  targetActivityVersionId: "activity-version-1",
  targetAssignmentVersionId: "assignment-version-1",
  reasonCode: "DIAGNOSTIC",
  reasonText: "Build evidence.",
  targetSnapshotJson: { title: "Practice" },
  learningItem: {
    id: "activity-1",
    title: "Practice",
    kind: "PRACTICE",
    courseId: "course-1",
  },
  targetAssignmentVersion: { assignmentId: "assignment-1" },
};
const run = {
  userId: "learner-1",
  runId: "run-1",
  profileId: "profile-1",
  policyVersion: "v1",
  recommendedActivities: [suggestion],
};
assert.equal(
  learning.parseRecommendations(run).recommendedActivities[0].id,
  suggestion.id,
);
responder = () =>
  ok({
    id: attempt.id,
    assignmentId: "assignment-1",
    assignmentVersionId: "assignment-version-1",
    activityVersionId: "activity-version-1",
  });
await learning.startRecommendedAttempt(suggestion, "session-token");
assert.deepEqual(requests.at(-1).body, {
  recommendationItemId: "suggestion-1",
});
assert.equal(requests.at(-1).path, "/api/assignments/assignment-1/attempts");
responder = () =>
  ok({
    id: attempt.id,
    assignmentId: "assignment-1",
    assignmentVersionId: "latest-but-not-recommended",
    activityVersionId: "activity-version-1",
  });
await assert.rejects(
  learning.startRecommendedAttempt(suggestion, "session-token"),
  /recommended version/,
);
const lesson = {
  ...suggestion,
  learningItemId: "lesson/id",
  targetActivityVersionId: null,
  targetAssignmentVersionId: null,
  targetAssignmentVersion: null,
  learningItem: {
    id: "lesson/id",
    title: "Lesson",
    kind: "LESSON",
    courseId: "course/id",
  },
};
assert.equal(
  learning.recommendedLessonPath(lesson),
  "/courses/course%2Fid/lessons/lesson%2Fid",
);
await assert.rejects(
  learning.startRecommendedAttempt(lesson, "session-token"),
  /lesson/,
);
assert.deepEqual(
  plain(
    learning.parseRecommendations({ ...run, recommendedActivities: [] })
      .recommendedActivities,
  ),
  [],
);
console.log(
  "Student learning checks passed: Writing drafts/submissions, revision ownership, provisional/official results, review requests, skills and pinned recommendation navigation.",
);

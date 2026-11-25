import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

// Pure helpers behind A3-A9 screens, checked without a browser or server.
function load(path, require = () => ({})) {
  const context = { exports: {}, require, Date, Intl, URLSearchParams };
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
const json = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const stubs = (path) =>
  path.includes("studentRequest")
    ? { isRecord, studentRequest: async () => ({}) }
    : path.includes("axiosClient")
      ? { __esModule: true, default: {} }
      : {};

// A9 quiz builder.
const quiz = load("../src/features/management/authoring/quizDraft.ts");
const draft = {
  title: " Reading 1 ",
  skillArea: "READING",
  position: 3,
  sectionId: "",
  promptText: " Passage ",
  instructions: "Answer",
  difficulty: 2,
  expectedMinutes: 10,
  skillIds: ["skill-1"],
  questions: [
    { ...quiz.newQuestion("SINGLE_CHOICE"), prompt: "Q1", options: [{ text: "A", correct: true }, { text: "B", correct: false }] },
    { ...quiz.newQuestion("SHORT_ANSWER"), prompt: "Q2", acceptedAnswers: " five \n\n5 ", maxWords: "1", marks: 2 },
  ],
};
assert.deepEqual(json(quiz.quizProblems(draft)), []);
const payload = json(quiz.quizPayload(draft));
assert.equal(payload.title, "Reading 1");
assert.equal("sectionId" in payload, false, "empty section is omitted");
assert.deepEqual(payload.questions[1], {
  type: "SHORT_ANSWER",
  prompt: "Q2",
  marks: 2,
  acceptedAnswers: ["five", "5"],
  maxWords: 1,
});
assert.deepEqual(payload.questions[0].options, [
  { text: "A", correct: true },
  { text: "B", correct: false },
]);
const multi = { ...quiz.newQuestion("MULTIPLE_CHOICE"), options: [{ text: "A", correct: true }, { text: "B", correct: true }] };
const single = quiz.changeType(multi, "SINGLE_CHOICE");
assert.deepEqual(json(single.options.map((o) => o.correct)), [true, false], "single choice keeps one answer");
assert.equal(quiz.changeType(multi, "SHORT_ANSWER").options.length, 0);
const broken = {
  ...draft,
  skillIds: [],
  questions: [
    { ...quiz.newQuestion("SINGLE_CHOICE"), prompt: "", options: [{ text: "A", correct: false }, { text: "", correct: false }] },
    { ...quiz.newQuestion("SHORT_ANSWER"), prompt: "Q", acceptedAnswers: " \n " },
  ],
};
assert.deepEqual(json(quiz.quizProblems(broken)), [
  "Choose at least one skill.",
  "Question 1 needs a prompt.",
  "Question 1 has an empty option.",
  "Question 1 needs exactly one correct option.",
  "Question 2 needs at least one accepted answer.",
]);
console.log("Quiz builder checks passed: payload shape, type switching, validation.");

// A8 content editor sends only changed fields.
const authoring = load("../src/features/management/authoring/authoringTypes.ts");
assert.deepEqual(
  json(authoring.changedFields({ title: "A", position: 1, sectionId: null }, { title: "A", position: 2, sectionId: "s" })),
  { position: 2, sectionId: "s" },
);

// A6 learning overview and reading position.
const overview = load("../src/features/learning/overviewApi.ts", stubs);
const course = {
  courseId: "c1",
  title: "Writing",
  progress: { percent: 50 },
  nextItem: { id: "l1", title: "L1", kind: "LESSON", path: "/courses/c1/lessons/l1" },
};
const valid = { continueLearning: { ...course.nextItem, courseId: "c1" }, inProgress: [course], completed: [], resumeAttempts: [{ path: "/attempts/a1" }] };
assert.equal(overview.parseOverview(valid).inProgress.length, 1);
for (const bad of [
  { ...valid, continueLearning: { path: "https://evil.example" } },
  { ...valid, inProgress: [{ ...course, nextItem: { path: "//evil.example" } }] },
  { ...valid, resumeAttempts: [{ path: "javascript:alert(1)" }] },
  { ...valid, completed: null },
])
  assert.throws(() => overview.parseOverview(bad), /unexpected learning overview/);
assert.equal(overview.scrollRatio(500, 1000), 0.5);
assert.equal(overview.scrollRatio(2000, 1000), 1);
assert.equal(overview.scrollRatio(10, 0), 0);
assert.equal(overview.savedScrollRatio({ status: "IN_PROGRESS", lastPositionJson: { scrollRatio: 0.4 } }), 0.4);
assert.equal(overview.savedScrollRatio({ status: "COMPLETED", lastPositionJson: { scrollRatio: 0.4 } }), null);
assert.equal(overview.savedScrollRatio({ status: "IN_PROGRESS", lastPositionJson: { scrollRatio: 0.01 } }), null);
assert.equal(overview.savedScrollRatio({ status: "IN_PROGRESS" }), null);
console.log("Learning overview checks passed: internal links only, reading position.");

// A7 audit filters.
const analytics = load("../src/features/analytics/analyticsApi.ts", stubs);
assert.deepEqual(
  json(analytics.auditParams({ action: " password_reset ", entityType: "", from: undefined }, "cursor-1")),
  { action: "password_reset", cursor: "cursor-1" },
);
assert.equal(analytics.percent(0.256), "26%");
assert.equal(analytics.percent(null), "—");

// A3 moderation links.
const moderation = load("../src/features/moderation/moderationApi.ts", stubs);
const report = (target) => ({ target: { courseId: "c1", threadId: null, kind: null, ...target } });
assert.equal(moderation.targetLink(report({ type: "POST", id: "p1", threadId: "t1" })), "/courses/c1?thread=t1#discussion");
assert.equal(moderation.targetLink(report({ type: "LEARNING_ITEM", id: "i1", kind: "PRACTICE" })), "/courses/c1/practices/i1");
assert.equal(moderation.targetLink(report({ type: "COURSE", id: "c1" })), "/courses/c1");
assert.equal(moderation.targetLink({ target: { type: "COURSE", id: "x", courseId: null } }), null);

// A4 notification labels and actions.
const notifications = load("../src/features/management/notificationsStore.ts", (path) =>
  path === "react" ? { useEffect() {}, useSyncExternalStore() {} } : { managementRequest: async () => ({}), managementError: String },
);
const action = (navigationPath, notificationType) =>
  notifications.getNotificationActionLabel({ navigationPath, notificationType });
assert.equal(action("/courses/c1/lessons/l1", "NEW_CONTENT"), "Open lesson");
assert.equal(action("/courses/c1/practices/p1", "DEADLINE_SOON"), "Open practice");
assert.equal(action("/courses/c1?thread=t1#discussion", "DISCUSSION_REPLY"), "Open discussion");
assert.equal(action("/teacher/discussions?course=c1&thread=t1", "DISCUSSION_THREAD"), "Open discussion");
assert.equal(action("/admin/moderation", "MODERATION_REPORT"), "Review reports");
assert.equal(action("/submissions/r1", "ASSESSMENT_PUBLISHED"), "View assessment");
assert.equal(notifications.notificationType("DEADLINE_SOON").label, "Due soon");
assert.equal(notifications.notificationType("UNKNOWN"), undefined);
console.log("Audit, moderation and notification checks passed.");

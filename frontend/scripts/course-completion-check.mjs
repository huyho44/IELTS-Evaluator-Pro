import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
let response;
const requests = [];
const context = {
  exports: {},
  Headers,
  require: () => ({
    sessionFetch: async (path, options) => {
      requests.push({
        path,
        method: options.method,
        authorization: options.headers.get("Authorization"),
      });
      return response;
    },
  }),
};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../src/features/courses/enrollmentsApi.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  context,
);
const api = context.exports;
const ok = (data) => ({ ok: true, json: async () => data });
response = ok({
  status: "ACTIVE",
  courseId: "course-1",
  remainingItemIds: ["lesson-1", "practice-1"],
});
let result = await api.checkCourseCompletion("course-1", "token");
assert.equal(result.status, "ACTIVE");
assert.equal(result.remainingItemIds.length, 2);
assert.deepEqual(requests.at(-1), {
  path: "/api/courses/course-1/completion",
  method: "POST",
  authorization: "Bearer token",
});
response = ok({ status: "COMPLETED", courseId: "course-1" });
result = await api.checkCourseCompletion("course-1", "token");
assert.equal(
  result.remainingItemIds.length,
  0,
  "An already-completed enrollment need not repeat remaining IDs",
);
response = ok({ status: "ACTIVE" });
await assert.rejects(
  api.checkCourseCompletion("course-1", "token"),
  /could not be verified/,
);
response = ok({
  status: "COMPLETED",
  courseId: "another-course",
  remainingItemIds: [],
});
await assert.rejects(
  api.checkCourseCompletion("course-1", "token"),
  /could not be verified/,
);
response = {
  ok: false,
  status: 409,
  json: async () => ({ message: "No required published learning content" }),
};
await assert.rejects(
  api.checkCourseCompletion("course-1", "token"),
  (error) =>
    error.status === 409 &&
    error.message === "No required published learning content",
);
console.log(
  "Course completion checks passed: remaining requirements, completed enrollment, course identity and backend conflict messages.",
);

// Verify Course Detail practiceCompleted validation and syllabus chapter state persistence.
const lessonProgressCtx = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../src/features/courses/lessonProgress.ts", import.meta.url),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  lessonProgressCtx,
);

let detailPayload;
const detailCtx = {
  exports: {},
  require: (id) => {
    if (id === "./lessonProgress") return lessonProgressCtx.exports;
    if (id === "../auth/session") {
      return { sessionFetch: async () => ({ ok: true, status: 200, json: async () => detailPayload }) };
    }
    throw new Error(`Unexpected require: ${id}`);
  },
};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../src/features/courses/courseDetailApi.ts", import.meta.url),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  detailCtx,
);

detailPayload = {
  id: "course-1",
  title: "Reading course",
  description: "Desc",
  enrollmentOpen: true,
  creator: { id: "inst-1", displayName: "Teacher" },
  sections: [{ id: "sec-1", title: "Basics", position: 1 }],
  learningItems: [
    {
      id: "item-1",
      sectionId: "sec-1",
      title: "Quiz 1",
      kind: "PRACTICE",
      position: 1,
      lesson: null,
      practiceActivity: { skillArea: "READING", responseMode: "OBJECTIVE" },
      progress: null,
      practiceCompleted: true,
    },
  ],
};
const validCourse = await detailCtx.exports.getCourseDetail("course-1", new AbortController().signal, "tok");
assert.equal(validCourse.learningItems[0].practiceCompleted, true);

detailPayload = {
  ...detailPayload,
  learningItems: [{ ...detailPayload.learningItems[0], practiceCompleted: "yes" }],
};
await assert.rejects(
  detailCtx.exports.getCourseDetail("course-1", new AbortController().signal, "tok"),
  /unexpected course format/,
);

const storageMap = new Map();
const syllabusCtx = {
  exports: {},
  window: {
    sessionStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => {
        storageMap.set(k, String(v));
      },
    },
  },
};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../src/features/courses/syllabusStorage.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  syllabusCtx,
);

const { getSyllabusStorageKey, readStoredOpenSectionIds, writeStoredOpenSectionIds } =
  syllabusCtx.exports;
const keyA = getSyllabusStorageKey("course-1", "user-a");
const keyB = getSyllabusStorageKey("course-1", "user-b");
assert.notEqual(keyA, keyB);
assert.equal(readStoredOpenSectionIds(keyA, ["sec-1", "sec-2"]), null);

// Closing all sections persists [] and restores [] instead of defaulting back to chapter 1.
writeStoredOpenSectionIds(keyA, []);
assert.deepEqual(Array.from(readStoredOpenSectionIds(keyA, ["sec-1", "sec-2"])), []);

// Persists selected section subset and discards deleted section IDs.
writeStoredOpenSectionIds(keyA, ["sec-2", "deleted-sec", "sec-2"]);
assert.deepEqual(Array.from(readStoredOpenSectionIds(keyA, ["sec-1", "sec-2"])), ["sec-2"]);

// Corrupt or blocked storage degrades safely to null.
storageMap.set(keyA, "{not-valid-json");
assert.equal(readStoredOpenSectionIds(keyA, ["sec-1"]), null);
syllabusCtx.window.sessionStorage.getItem = () => {
  throw new Error("Storage blocked");
};
syllabusCtx.window.sessionStorage.setItem = () => {
  throw new Error("Storage blocked");
};
writeStoredOpenSectionIds(keyA, ["sec-1"]);
assert.equal(readStoredOpenSectionIds(keyA, ["sec-1"]), null);

console.log(
  "Course detail checks passed: practiceCompleted validation and per-course/per-user syllabus storage.",
);

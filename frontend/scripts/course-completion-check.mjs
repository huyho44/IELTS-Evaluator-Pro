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

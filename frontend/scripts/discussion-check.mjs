import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

// Discussion API contract, checked against a mock transport (no live server).
const calls = [];
const reply = (data) => Promise.resolve({ data });
const client = {
  get: (url, config) => {
    calls.push({ method: "GET", url, params: config?.params ?? null });
    return reply({ url });
  },
  post: (url, body) => {
    calls.push({ method: "POST", url, body });
    return reply({ url });
  },
  patch: (url, body) => {
    calls.push({ method: "PATCH", url, body });
    return reply({ url });
  },
  delete: (url) => {
    calls.push({ method: "DELETE", url });
    return reply({ url });
  },
};
const context = {
  exports: {},
  require: (path) => {
    assert.ok(path.includes("axiosClient"), `unexpected import ${path}`);
    return { __esModule: true, default: client };
  },
};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../src/features/discussions/discussionsApi.ts", import.meta.url),
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
const { discussionsApi: api, discussionError, postPlaceholder } = context.exports;
const json = (value) => JSON.stringify(value);
const last = () => json(calls.at(-1));
const course = "26102026-0000-4000-8000-000000000001";
const lesson = "641174fe-30e1-4d80-97bf-ba414976d598";
const thread = "00000000-0000-4000-8000-000000001001";
const post = "00000000-0000-4000-8000-000000001002";

await api.staffCourses();
assert.equal(last(), json({ method: "GET", url: "/discussions/courses", params: null }));
await api.list(course);
assert.equal(last(), json({ method: "GET", url: `/courses/${course}/threads`, params: null }));
await api.list(course, lesson);
assert.equal(
  last(),
  json({ method: "GET", url: `/courses/${course}/threads`, params: { contextItemId: lesson } }),
  "lesson Q&A filters by context item",
);
await api.create(course, { title: "Q", body: "B", contextItemId: lesson });
assert.equal(
  last(),
  json({
    method: "POST",
    url: `/courses/${course}/threads`,
    body: { title: "Q", body: "B", contextItemId: lesson },
  }),
);
await api.detail(thread);
assert.equal(last(), json({ method: "GET", url: `/threads/${thread}`, params: null }));
await api.reply(thread, "Answer");
assert.equal(last(), json({ method: "POST", url: `/threads/${thread}/posts`, body: { body: "Answer" } }));
await api.reply(thread, "Reply", post);
assert.equal(
  last(),
  json({ method: "POST", url: `/threads/${thread}/posts`, body: { body: "Reply", parentPostId: post } }),
);
await api.edit(post, "Edited");
assert.equal(last(), json({ method: "PATCH", url: `/posts/${post}`, body: { body: "Edited" } }));
await api.remove(post);
assert.equal(last(), json({ method: "DELETE", url: `/posts/${post}` }));
await api.lock(thread, true);
assert.equal(last(), json({ method: "POST", url: `/threads/${thread}/lock`, body: { locked: true } }));
await api.detail("../admin");
assert.equal(calls.at(-1).url, "/threads/..%2Fadmin", "ids are path-encoded");

const failure = (status, message) => ({ response: { status, data: message === undefined ? {} : { message } } });
assert.equal(discussionError(failure(409, "This thread is locked"), "fallback"), "This thread is locked");
assert.equal(discussionError(failure(400, ["body must be a non-empty string"]), "fallback"), "body must be a non-empty string");
assert.equal(discussionError(failure(403), "fallback"), "You do not have access to this discussion.");
assert.equal(discussionError(new Error("offline"), "fallback"), "fallback");

assert.equal(postPlaceholder({ status: "VISIBLE", body: "Hello" }), null);
assert.equal(postPlaceholder({ status: "HIDDEN", body: "Visible to staff" }), null);
assert.match(postPlaceholder({ status: "DELETED", body: null }), /deleted/);
assert.match(postPlaceholder({ status: "HIDDEN", body: null }), /hidden by a moderator/);

console.log("Discussion checks passed: request shapes, error messages, hidden/deleted placeholders.");

import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
const store = new Map();
let responder;
const context = {
  exports: {},
  require: () => ({
    useSyncExternalStore(_subscribe, snapshot) {
      return snapshot();
    },
  }),
  Headers,
  URL,
  window: { location: { origin: "http://localhost" } },
  localStorage: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
  fetch: (...args) => responder(...args),
};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../src/features/auth/session.ts", import.meta.url),
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
const session = (name) => ({
  accessToken: name,
  refreshToken: name + "-refresh",
  user: {
    id: name,
    email: name + "@example.com",
    displayName: name,
    roles: ["LEARNER"],
    targetBand: 7,
  },
});
const ok = (value) =>
  Promise.resolve({ ok: true, status: 200, json: async () => value });
assert.equal(api.safeReturn("//evil.example"), "/courses");
assert.equal(api.safeReturn("/login/"), "/courses");
assert.equal(api.safeReturn("/%6cogin?from=x"), "/courses");
assert.equal(api.safeReturn("/courses?x=1#lesson"), "/courses?x=1#lesson");
assert.equal(api.safeReturn("/attempts/123?x=1"), "/attempts/123?x=1");
store.set("ielts.session", "bad json");
await api.restoreSession();
assert.equal(api.currentSession(), null);
let finishLogin;
responder = () =>
  new Promise((resolve) => {
    finishLogin = resolve;
  });
const login = api.signIn({ email: "x", password: "not-persisted" });
assert.equal(
  api.useSession().restoring,
  false,
  "login must not trigger initial restoration/unmount the router",
);
finishLogin(await ok(session("binh")));
await login;
assert.equal(api.useSession().restoring, false);
assert.equal(api.currentSession().user.id, "binh");
assert.ok(!store.get("ielts.session").includes("not-persisted"));
let release;
responder = () =>
  new Promise((resolve) => {
    release = resolve;
  });
const old = api.sessionFetch("/api/attempts/old", {
  headers: { Authorization: "Bearer binh" },
});
responder = () => ok(session("an"));
await api.signIn({ email: "x", password: "x" });
release({ status: 401 });
await old;
api.expireSession("binh");
assert.equal(api.currentSession().user.id, "an");
const stableToken = api.useSession().requestToken;
let calls = 0;
responder = () => {
  calls++;
  return ok({ ...session("renewed"), user: session("an").user });
};
await Promise.all([api.refreshSession(), api.refreshSession()]);
assert.equal(calls, 1);
assert.equal(
  api.useSession().requestToken,
  stableToken,
  "refresh must not change page keys or discard unsaved answers",
);
const kept = api.currentSession();
responder = () => Promise.reject(new Error("network"));
await assert.rejects(api.refreshSession());
assert.equal(
  api.currentSession(),
  kept,
  "network failure must preserve the session",
);
responder = () => Promise.resolve({ ok: false, status: 503 });
await assert.rejects(api.refreshSession());
assert.equal(api.currentSession(), kept, "503 must preserve the session");
let finishRefresh;
responder = () =>
  new Promise((resolve) => {
    finishRefresh = resolve;
  });
const delayedRefresh = api.refreshSession();
responder = () => ok({});
await api.signOut();
finishRefresh(await ok(session("resurrected")));
await delayedRefresh;
assert.equal(
  api.currentSession(),
  null,
  "late refresh cannot restore a logged-out session",
);
responder = () => ok(session("an"));
await api.signIn({ email: "x", password: "x" });
responder = () => Promise.resolve({ ok: false, status: 401 });
await api.refreshSession();
assert.equal(api.currentSession(), null, "rejected refresh clears the session");
responder = () => ok(session("logout-test"));
await api.signIn({ email: "x", password: "x" });
let logoutCalled = false;
responder = (url) => {
  assert.equal(url, "/api/auth/logout");
  logoutCalled = true;
  return Promise.reject(new Error("offline"));
};
await api.signOut();
assert.equal(
  logoutCalled,
  true,
  "logout failure test must call the API with a live session",
);
assert.equal(api.currentSession(), null);
assert.equal(store.has("ielts.session"), false);
console.log(
  "Session checks passed: redirects, malformed storage, stale 401, refresh concurrency, logout failure.",
);

// Registration contract is tested with a mock transport, never a live account.
let registration;
const authContext = {
  exports: {},
  require: (path) =>
    path.includes("axiosClient")
      ? {
          __esModule: true,
          default: {
            post: async (url, payload) => {
              registration = { url, payload };
              return {
                data: {
                  message: "Register Successful",
                  user: { id: "learner" },
                },
              };
            },
          },
        }
      : { signOut() {} },
};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../src/features/auth/services/authApi.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  authContext,
);
await authContext.exports.authApi.register({
  displayName: "Learner",
  email: "test@example.com",
  password: "test-only",
});
assert.equal(registration.url, "/auth/register");
assert.equal(registration.payload.displayName, "Learner");
assert.equal("username" in registration.payload, false);
assert.equal(
  api.currentSession(),
  null,
  "registration must not create a session",
);
console.log("Registration contract mock passed. No live account was created.");

responder = () => ok(session("storage-test"));
const save = context.localStorage.setItem;
context.localStorage.setItem = () => {
  throw new Error("storage unavailable");
};
await api.signIn({ email: "x", password: "x" });
assert.equal(api.currentSession().user.id, "storage-test");
context.localStorage.setItem = save;
await api.signOut();
assert.equal(api.currentSession(), null);
console.log("Storage failure and authenticated logout failure checks passed.");

const returnContext = { exports: {}, require: () => api };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/auth/returnDestination.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, returnContext);
const back = returnContext.exports.courseBackDestination;
const coursePath = '/courses/26102026-0000-4000-8000-000000000001';
assert.equal(back(coursePath + '/lessons/641174fe-30e1-4d80-97bf-ba414976d598?x=1#read'), coursePath);
assert.equal(back(coursePath + '/practices/26102026-0000-4000-8000-000000000010'), coursePath);
assert.equal(back('/attempts/123'), '/courses');
assert.equal(back('https://outside.example/courses/anything'), '/courses');
assert.equal(back('/courses/invalid/lessons/123'), '/courses');
console.log('Auth back destination checks passed independently of post-login return URL.');

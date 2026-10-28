import { useSyncExternalStore } from "react";
export type User = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  targetBand: number | null;
};
type Session = { accessToken: string; refreshToken: string; user: User };
let state: {
  session: Session | null;
  restoring: boolean;
  restoreError: string;
  requestToken: string | null;
} = { session: null, restoring: true, restoreError: "", requestToken: null };
const listeners = new Set<() => void>();
const key = "ielts.session";
// Increment only when the login identity changes or a session is cleared.
// Async work captures this value so an old response cannot replace a newer login.
let generation = 0;
function emit(session: Session | null, restoring = false) {
  state = {
    session,
    restoring,
    restoreError: "",
    // Pages key their personal state by this stable token. Token rotation must
    // not remount an attempt and discard answers that have not been saved.
    requestToken: session
      ? state.session?.user.id === session.user.id
        ? (state.requestToken ?? session.accessToken)
        : session.accessToken
      : null,
  };
  try {
    if (session) localStorage.setItem(key, JSON.stringify(session));
    else localStorage.removeItem(key);
  } catch {
    // Storage can be disabled/full. In-memory login/logout must still notify UI;
    // persistence across F5 is unavailable in that browser until storage works.
  }
  listeners.forEach((fn) => fn());
}
function parse(value: unknown): Session {
  const s = value as Session;
  if (
    !s ||
    typeof s.accessToken !== "string" ||
    !s.accessToken ||
    typeof s.refreshToken !== "string" ||
    !s.refreshToken ||
    !s.user ||
    typeof s.user.id !== "string" ||
    typeof s.user.email !== "string" ||
    typeof s.user.displayName !== "string" ||
    !Array.isArray(s.user.roles) ||
    !s.user.roles.every((r) => typeof r === "string") ||
    !(s.user.targetBand === null || typeof s.user.targetBand === "number")
  )
    throw new Error("Invalid session response");
  return s;
}
export function useSession() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => state,
  );
}
export function sessionGeneration() {
  return generation;
}
export function currentSession() {
  return state.session;
}
export async function signIn(credentials: { email: string; password: string }) {
  const version = ++generation;
  emit(null);
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!response.ok)
      throw new Error("Unable to sign in. Check your email and password.");
    const session = parse(await response.json());
    if (generation === version) emit(session);
  } catch (error) {
    if (generation === version) emit(null);
    throw error;
  }
}
let refreshing: Promise<void> | null = null;
let refreshGeneration = -1;
export function refreshSession() {
  // Refresh tokens rotate: concurrent requests in the same generation share one call.
  if (refreshing && refreshGeneration === generation) return refreshing;
  const previous = state.session;
  const version = generation;
  if (!previous) return Promise.resolve();
  refreshGeneration = version;
  refreshing = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: previous.refreshToken }),
      });
      if (version !== generation || state.session !== previous) return;
      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403
      ) {
        generation++;
        emit(null);
        return;
      }
      if (!response.ok)
        throw new Error("Unable to refresh session. Please try again.");
      const next = parse(await response.json());
      if (next.user.id !== previous.user.id)
        throw new Error("Invalid refresh user");
      if (version === generation && state.session === previous) emit(next);
    } catch {
      throw new Error(
        "Unable to refresh session. Check your connection and try again.",
      );
    } finally {
      if (version === refreshGeneration) refreshing = null;
    }
  })();
  return refreshing;
}
let initialized = false;
export async function restoreSession() {
  if (initialized) return;
  initialized = true;
  try {
    const saved = localStorage.getItem(key);
    if (!saved) {
      emit(null);
      return;
    }
    const savedSession = parse(JSON.parse(saved));
    state = {
      session: savedSession,
      restoring: true,
      restoreError: "",
      requestToken: savedSession.accessToken,
    };
    await retryRestore();
  } catch {
    emit(null);
  }
}
export async function retryRestore() {
  try {
    await refreshSession();
  } catch {
    state = {
      ...state,
      restoring: false,
      restoreError:
        "Unable to restore your session. Check your connection and try again.",
    };
    listeners.forEach((fn) => fn());
  }
}
export function expireSession(token: string | undefined) {
  if (token && state.session?.accessToken === token) {
    generation++;
    emit(null);
  }
}
export async function signOut() {
  const token = state.session?.accessToken;
  generation++;
  emit(null);
  if (token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* Session is already cleared locally. */
    }
  }
}
export async function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  const supplied = headers.get("Authorization");
  const token = state.session?.accessToken;
  const version = generation;
  if (
    supplied &&
    supplied !== `Bearer ${state.requestToken}` &&
    supplied !== `Bearer ${token}`
  )
    throw new Error("This session is no longer active.");
  if (supplied && supplied === `Bearer ${state.requestToken}` && token)
    headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (
    response.status !== 401 ||
    !token ||
    headers.get("Authorization") !== `Bearer ${token}` ||
    version !== generation
  )
    return response;
  // Another request may already have rotated the token while this one was in
  // flight. Retry with that token instead of rotating the refresh token twice.
  if (state.session?.accessToken === token) await refreshSession();
  if (version !== generation || !state.session) return response;
  headers.set("Authorization", `Bearer ${state.session.accessToken}`);
  const retried = await fetch(input, { ...init, headers });
  if (retried.status === 401 && version === generation)
    expireSession(headers.get("Authorization")?.slice(7));
  return retried;
}
export function safeReturn(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/courses";
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin &&
      !["/login", "/register", "/logout"].includes(
        decodeURIComponent(url.pathname).replace(/\/+$/, "").toLowerCase(),
      )
      ? url.pathname + url.search + url.hash
      : "/courses";
  } catch {
    return "/courses";
  }
}

import { sessionFetch } from "../../features/auth/session";

export class StudentApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StudentApiError";
    this.status = status;
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function studentRequest(
  path: string,
  accessToken: string,
  options: {
    method?: "GET" | "POST" | "PUT";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<unknown> {
  if (!accessToken)
    throw new StudentApiError("Please sign in to continue.", 401);
  const response = await sessionFetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
    signal: options.signal,
  });
  if (!response.ok) {
    let message =
      response.status === 403
        ? "You do not have access to this content."
        : "The request could not be completed. Please try again.";
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.message === "string")
        message = body.message;
    } catch {
      /* Keep the useful fallback when no JSON was returned. */
    }
    throw new StudentApiError(message, response.status);
  }
  return response.json();
}

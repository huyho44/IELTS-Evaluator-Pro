import { signOut } from "../session";
import axiosClient from "../../../lib/api/axiosClient";

type Credentials = { email: string; password: string };
type Registration = Credentials & { displayName: string };

// Message returned by the API, or a fallback for network/unexpected errors.
export function authError(cause: unknown, fallback: string): string {
  const message =
    cause && typeof cause === "object" && "response" in cause
      ? (cause as { response?: { data?: { message?: unknown } } }).response
          ?.data?.message
      : undefined;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string")
    return message[0];
  return fallback;
}

function messageOf(data: unknown, fallback: string): string {
  return data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
    ? data.message
    : fallback;
}

export const authApi = {
  register: async (userData: Registration) => {
    const response = await axiosClient.post("/auth/register", userData);
    const data: unknown = response.data;
    if (
      !data ||
      typeof data !== "object" ||
      !("user" in data) ||
      !data.user ||
      typeof data.user !== "object" ||
      !("id" in data.user) ||
      typeof data.user.id !== "string"
    )
      throw new Error(
        "The server returned an unexpected registration response.",
      );
    // Registration creates a learner; the user must sign in separately.
    return data;
  },
  // Always resolves with the same neutral message for any email address.
  forgotPassword: async (email: string) => {
    const response = await axiosClient.post("/auth/forgot-password", {
      email,
    });
    return messageOf(
      response.data,
      "If an active account uses this email, a password reset link has been sent.",
    );
  },
  resetPassword: async (token: string, password: string) => {
    const response = await axiosClient.post("/auth/reset-password", {
      token,
      password,
    });
    return messageOf(response.data, "Your password has been reset.");
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await axiosClient.post("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return messageOf(response.data, "Password changed.");
  },
  logout: signOut,
};

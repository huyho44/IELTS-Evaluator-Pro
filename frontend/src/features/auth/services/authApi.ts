import { signOut } from "../session";
import axiosClient from "../../../lib/api/axiosClient";

type Credentials = { email: string; password: string };
type Registration = Credentials & { displayName: string };
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
  logout: signOut,
};

import axios from "axios";
import {
  currentSession,
  refreshSession,
  sessionGeneration,
  expireSession,
} from "../../features/auth/session";
const axiosClient = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});
axiosClient.interceptors.request.use((config) => {
  const token = currentSession()?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const session = currentSession();
    const generation = sessionGeneration();
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      session &&
      config.headers.Authorization === `Bearer ${session.accessToken}`
    ) {
      config._retried = true;
      await refreshSession();
      if (
        generation === sessionGeneration() &&
        currentSession()?.user.id === session.user.id
      )
        return axiosClient(config);
    }
    if (error.response?.status === 401 && config?._retried)
      expireSession(config.headers.Authorization?.replace("Bearer ", ""));
    return Promise.reject(error);
  },
);
export default axiosClient;

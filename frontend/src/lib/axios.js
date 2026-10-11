import axios from "axios";

/**
 * In production the API is served from the same origin as the app, so a
 * relative path is all that is needed. In development Vite proxies /api to the
 * backend (see vite.config.js), which keeps cookies first-party in both cases.
 */
export const axiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

/** Never let `error.response.data.message` throw on a network failure. */
export function apiError(error, fallback = "Something went wrong") {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === "ERR_NETWORK") return "Cannot reach the server. Check your connection.";
  return error?.message || fallback;
}

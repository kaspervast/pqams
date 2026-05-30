import axios from "axios";

export const api = axios.create({ baseURL: "/api", withCredentials: true });
let accessToken: string | null = sessionStorage.getItem("pqams_token");

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  localStorage.removeItem("pqams_token");
  if (token) sessionStorage.setItem("pqams_token", token);
  else sessionStorage.removeItem("pqams_token");
}

api.interceptors.request.use((request) => {
  if (accessToken) request.headers.Authorization = `Bearer ${accessToken}`;
  if ((request.method ?? "get").toLowerCase() === "get") {
    request.headers["Cache-Control"] = "no-cache";
    request.headers.Pragma = "no-cache";
    request.params = { ...(request.params ?? {}), _ts: Date.now() };
  }
  return request;
});

api.interceptors.response.use(undefined, async (error) => {
  if (error.response?.status === 401 && !error.config?.url?.includes("/auth/")) setAccessToken(null);
  throw error;
});

export async function downloadFile(url: string, filename: string) {
  const response = await api.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message ?? error.message;
  return error instanceof Error ? error.message : "Request failed";
}

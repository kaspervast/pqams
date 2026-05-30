import axios from "axios";

export const api = axios.create({ baseURL: "/api", withCredentials: true });
let accessToken: string | null = localStorage.getItem("pqams_token");

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem("pqams_token", token);
  else localStorage.removeItem("pqams_token");
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

let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(undefined, async (error) => {
  const original = error.config;
  if (error.response?.status !== 401 || original?._retried || original?.url?.includes("/auth/")) throw error;
  original._retried = true;
  refreshing ??= api.post("/auth/refresh").then(({ data }) => {
    setAccessToken(data.data.accessToken);
    return data.data.accessToken as string;
  }).catch(() => {
    setAccessToken(null);
    return null;
  }).finally(() => {
    refreshing = null;
  });
  const token = await refreshing;
  if (!token) throw error;
  original.headers.Authorization = `Bearer ${token}`;
  return api(original);
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

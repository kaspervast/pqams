import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAccessToken } from "../api/client";

export type Role = "SUPER_ADMIN" | "ADMIN" | "CORRESPONDENCE_BRANCH" | "UNIT_USER" | "VIEWER";
export type AuthUser = {
  id: string;
  fullName: string;
  username: string;
  role: Role;
  policeUnitId: string | null;
  mustChangePassword: boolean;
};

type AuthValue = {
  user: AuthUser | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.post("/auth/refresh").then(({ data }) => {
      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
    }).catch(() => setAccessToken(null)).finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    async login(username, password) {
      const { data } = await api.post("/auth/login", { username, password });
      queryClient.clear();
      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
    },
    async logout() {
      await api.post("/auth/logout").catch(() => undefined);
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    },
    async changePassword(currentPassword, newPassword) {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    }
  }), [user, loading, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Authentication context missing");
  return value;
}

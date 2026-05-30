import { type ReactNode } from "react";
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppBar, Badge, Box, Button, CircularProgress, Divider, Drawer, IconButton, List, ListItemButton, ListItemText,
  Menu, MenuItem, Stack, Toolbar, Typography
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LogoutIcon from "@mui/icons-material/Logout";
import { api } from "./api/client";
import { useAuth, type Role } from "./auth/AuthContext";
import {
  ApplicationsPage, AuditPage, ChangePasswordPage, DashboardPage, LoginPage, MastersPage, PersonnelPage, QuartersPage,
  ReportsPage, UsersPage
} from "./pages";
import { useState } from "react";

type NavigationItem = { label: string; path: string; roles?: Role[] };
const navigation: NavigationItem[] = [
  { label: "Dashboard", path: "/" },
  { label: "Applications", path: "/applications" },
  { label: "Quarter Inventory", path: "/quarters" },
  { label: "Personnel", path: "/personnel", roles: ["CORRESPONDENCE_BRANCH", "SUPER_ADMIN", "VIEWER"] },
  { label: "Reports", path: "/reports" },
  { label: "Users", path: "/users", roles: ["ADMIN"] },
  { label: "Master Data", path: "/masters", roles: ["ADMIN"] },
  { label: "Audit Logs", path: "/audit", roles: ["ADMIN", "SUPER_ADMIN", "VIEWER"] }
];

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Notifications() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const client = useQueryClient();
  const { user } = useAuth();
  const { data = [] } = useQuery<any[]>({ queryKey: ["notifications", user?.id, user?.role], queryFn: () => api.get("/notifications").then((response) => response.data.data) });
  const unread = data.filter((message) => !message.isRead).length;
  return <>
    <IconButton color="inherit" onClick={(event) => setAnchor(event.currentTarget)}><Badge badgeContent={unread} color="secondary"><NotificationsIcon /></Badge></IconButton>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      {data.slice(0, 10).map((message) => <MenuItem key={message.id} onClick={async () => {
        await api.patch(`/notifications/${message.id}/read`);
        client.invalidateQueries({ queryKey: ["notifications"] });
      }}>
        <Stack maxWidth={360}><Typography fontWeight={message.isRead ? 400 : 700}>{message.title}</Typography><Typography variant="body2">{message.message}</Typography></Stack>
      </MenuItem>)}
      {!data.length && <MenuItem>No notifications</MenuItem>}
    </Menu>
  </>;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const drawerWidth = 250;
  return <Box display="flex" minHeight="100vh">
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>PQAMS</Typography>
        <Typography variant="body2" mr={2}>{user?.fullName} | {user?.role}</Typography>
        <Notifications />
        <IconButton color="inherit" onClick={logout}><LogoutIcon /></IconButton>
      </Toolbar>
    </AppBar>
    <Drawer variant="permanent" sx={{ width: drawerWidth, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box" } }}>
      <Toolbar />
      <Box px={2} py={2}><Typography fontWeight={700}>Police Quarters</Typography><Typography variant="caption" color="text.secondary">Allocation Workflow</Typography></Box>
      <Divider />
      <List>{navigation.filter((item) => !item.roles || item.roles.includes(user!.role)).map((item) =>
        <ListItemButton key={item.path} component={RouterLink} to={item.path} selected={location.pathname === item.path}>
          <ListItemText primary={item.label} />
        </ListItemButton>)}</List>
    </Drawer>
    <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, ml: `${drawerWidth}px`, maxWidth: `calc(100% - ${drawerWidth}px)` }}>
      {children}
    </Box>
  </Box>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center"><CircularProgress /></Box>;
  if (!user) return <LoginPage />;
  if (user.mustChangePassword) return <ChangePasswordPage />;
  return <Shell>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/applications" element={<ApplicationsPage />} />
      <Route path="/quarters" element={<QuartersPage />} />
      <Route path="/personnel" element={<Guard roles={["ADMIN", "CORRESPONDENCE_BRANCH", "SUPER_ADMIN", "VIEWER"]}><PersonnelPage /></Guard>} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/users" element={<Guard roles={["ADMIN"]}><UsersPage /></Guard>} />
      <Route path="/masters" element={<Guard roles={["ADMIN"]}><MastersPage /></Guard>} />
      <Route path="/audit" element={<Guard roles={["ADMIN", "SUPER_ADMIN", "VIEWER"]}><AuditPage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Shell>;
}

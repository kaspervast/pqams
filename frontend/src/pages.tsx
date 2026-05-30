import { Fragment, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, IconButton, LinearProgress, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { api, downloadFile, errorMessage } from "./api/client";
import { useAuth, type Role } from "./auth/AuthContext";

type AnyRow = Record<string, any>;
const roles: Role[] = ["SUPER_ADMIN", "ADMIN", "CORRESPONDENCE_BRANCH", "UNIT_USER", "VIEWER"];
const statuses = ["AVAILABLE", "OCCUPIED", "UNDER_REPAIR", "RESERVED", "VACATED_PENDING_INSPECTION", "DISPUTED", "INACTIVE"];
const unitTypes = [
  { value: "POLICE_STATION", label: "Police Station" },
  { value: "BRANCH", label: "Branch / Office" },
  { value: "HEADQUARTER", label: "Headquarter" },
  { value: "OTHER", label: "Other" }
];

function useApi<T = AnyRow[]>(key: string, path: string, enabled = true, refetchInterval?: number) {
  const { user } = useAuth();
  return useQuery<T>({
    queryKey: [key, path, user?.id, user?.role],
    queryFn: () => api.get(path).then((response) => response.data.data),
    enabled,
    refetchInterval,
    refetchIntervalInBackground: Boolean(refetchInterval),
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    staleTime: refetchInterval ? 0 : undefined
  });
}
function ErrorText({ error }: { error: unknown }) {
  return error ? <Alert severity="error">{errorMessage(error)}</Alert> : null;
}
function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") {
    const objectValue = value as AnyRow;
    return objectValue.name ?? objectValue.fullName ?? objectValue.username ?? objectValue.status ?? objectValue.id ?? "Updated";
  }
  return String(value);
}
function auditDisplayValue(row: AnyRow, key: string, side: "old" | "new", value: unknown) {
  const display = row.displayValue?.[key]?.[side];
  return display ? String(display) : formatAuditValue(value);
}
function auditFieldLabel(key: string) {
  if (key === "quarterId") return "Quarter";
  if (key === "allotmentDate") return "Allotment Date";
  return key;
}
function auditDetails(row: AnyRow) {
  const oldValue = row.oldValue ?? {};
  const newValue = row.newValue ?? {};
  const details: string[] = [];
  if (newValue.status) details.push(`Status -> ${newValue.status}`);
  if (newValue.username || newValue.role) details.push([newValue.username, newValue.role].filter(Boolean).join(" / "));
  if (newValue.name || newValue.code) details.push([newValue.name, newValue.code].filter(Boolean).join(" / "));
  if (newValue.attachmentType || newValue.name) details.push([newValue.attachmentType, newValue.name].filter(Boolean).join(": "));
  if (newValue.reportType || newValue.format) details.push(`Report ${newValue.reportType ?? ""} ${newValue.format ?? ""}`.trim());
  const oldObject = oldValue && typeof oldValue === "object" && !Array.isArray(oldValue) ? oldValue as AnyRow : {};
  const newObject = newValue && typeof newValue === "object" && !Array.isArray(newValue) ? newValue as AnyRow : {};
  const changedFields = Object.keys(newObject)
    .filter((key) => !["id", "createdAt", "updatedAt", "passwordHash"].includes(key))
    .filter((key) => JSON.stringify(oldObject[key] ?? null) !== JSON.stringify(newObject[key] ?? null))
    .slice(0, 4);
  for (const key of changedFields) {
    if (key === "status" || key === "username" || key === "role" || key === "name" || key === "code" || key === "attachmentType" || key === "reportType" || key === "format") continue;
    details.push(`${auditFieldLabel(key)}: ${auditDisplayValue(row, key, "old", oldObject[key])} -> ${auditDisplayValue(row, key, "new", newObject[key])}`);
  }
  if (!details.length && row.entityId) details.push(`Record ${String(row.entityId).slice(0, 8)}...`);
  if (!details.length) details.push("No extra details recorded");
  return <Stack spacing={0.25}>{details.slice(0, 4).map((detail, index) => <Typography key={index} variant="body2">{detail}</Typography>)}</Stack>;
}
function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <Stack spacing={2}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="h5" fontWeight={650}>{title}</Typography>{actions}
    </Stack>
    {children}
  </Stack>;
}
function DataTable({ columns, rows, renderBeforeRow }: { columns: Array<{ key: string; label: string; render?: (row: AnyRow) => ReactNode }>; rows: AnyRow[]; renderBeforeRow?: (row: AnyRow) => ReactNode }) {
  return <TableContainer component={Paper} variant="outlined">
    <Table size="small">
      <TableHead><TableRow>{columns.map((column) => <TableCell key={column.key} sx={{ fontWeight: 650 }}>{column.label}</TableCell>)}</TableRow></TableHead>
      <TableBody>
        {rows.map((row, index) => {
          const key = row.id ?? index;
          const editContent = renderBeforeRow?.(row);
          return <Fragment key={key}>
            {editContent && <TableRow><TableCell colSpan={columns.length} sx={{ bgcolor: "action.hover", p: 2 }}>{editContent}</TableCell></TableRow>}
            <TableRow hover>
              {columns.map((column) => <TableCell key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? "-")}</TableCell>)}
            </TableRow>
          </Fragment>;
        })}
        {!rows.length && <TableRow><TableCell colSpan={columns.length}>No records found.</TableCell></TableRow>}
      </TableBody>
    </Table>
  </TableContainer>;
}
function RowActions({ onEdit, onDelete, deleteDisabled = false }: { onEdit?: () => void; onDelete?: () => void; deleteDisabled?: boolean }) {
  return <Stack direction="row" spacing={0.5}>
    {onEdit && <IconButton size="small" color="primary" aria-label="Edit" onClick={onEdit}><EditOutlinedIcon fontSize="small" /></IconButton>}
    {onDelete && <IconButton size="small" color="error" aria-label="Delete" disabled={deleteDisabled} onClick={onDelete}><DeleteOutlineIcon fontSize="small" /></IconButton>}
  </Stack>;
}
function SeniorityView({ seniority, compact = false }: { seniority?: AnyRow | null; compact?: boolean }) {
  if (!seniority) return <Typography color="text.secondary">Not in active queue</Typography>;
  const caseLabel = seniority.caseLabel ?? "Regular";
  const typeSeniority = seniority.typeSeniority ?? [];
  return <Stack spacing={0.25}>
    <Typography fontWeight={650}>Queue Position #{seniority.overallPosition}</Typography>
    <Typography variant={compact ? "caption" : "body2"} color="text.secondary">{caseLabel} Position #{seniority.casePosition}</Typography>
    {typeSeniority.map((entry: AnyRow) =>
      <Typography key={`${entry.quarterTypeId ?? entry.quarterType}-${entry.position}-${entry.casePosition}`} variant={compact ? "caption" : "body2"} color="text.secondary">
        {entry.quarterType}: Queue #{entry.position} ({entry.caseLabel ?? caseLabel} #{entry.casePosition})
      </Typography>
    )}
    {!compact && <Typography variant="caption" color="text.secondary">#1 is first in line and is served before higher numbers.</Typography>}
  </Stack>;
}

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true); setError(undefined);
    try { await login(username, password); } catch (e) { setError(e); } finally { setPending(false); }
  };
  return <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" sx={{ background: "linear-gradient(135deg,#123b63,#275d8e)" }}>
    <Card sx={{ width: 420, p: 2 }}>
      <CardContent component="form" onSubmit={submit}>
        <Typography variant="h4" fontWeight={700}>PQAMS</Typography>
        <Typography color="text.secondary" mb={3}>Police Quarter Allocation Management System</Typography>
        <Stack spacing={2}>
          <ErrorText error={error} />
          <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" size="large" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</Button>
          <Typography variant="caption" color="text.secondary">Seed login: admin / Admin@12345 (password change required)</Typography>
        </Stack>
      </CardContent>
    </Card>
  </Box>;
}

export function ChangePasswordPage() {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("Admin@12345");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<unknown>();
  return <Box maxWidth={480} mx="auto" mt={10}>
    <Card><CardContent>
      <Typography variant="h5" mb={1}>Change password required</Typography>
      <Typography color="text.secondary" mb={3}>Set a new password before using administrative functions.</Typography>
      <Stack spacing={2}>
        <ErrorText error={error} />
        <TextField label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        <TextField label="New password" type="password" helperText="At least 10 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <Button variant="contained" onClick={() => changePassword(currentPassword, newPassword).catch(setError)}>Change password and sign out</Button>
        <Button onClick={logout}>Sign out</Button>
      </Stack>
    </CardContent></Card>
  </Box>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const endpoint = user?.role === "SUPER_ADMIN" || user?.role === "VIEWER" ? "super-admin" : user?.role === "CORRESPONDENCE_BRANCH" ? "correspondence" : user?.role === "UNIT_USER" ? "unit" : "admin";
  const { data, error, isLoading } = useApi<AnyRow>("dashboard", `/dashboard/${endpoint}`);
  const metrics = Object.entries(data ?? {}).filter(([, value]) => typeof value === "number");
  const titles: Record<string, string> = {
    pending: "Pending Applications", returned: "Returned", allotted: "Allotted", rejected: "Rejected",
    users: "System Users", units: "Police Units", quarters: "Total Quarters", duplicates: "Duplicate Reviews",
    changes: "Inventory Approvals", specialCases: "Urgent Cases", newRequests: "New Requests",
    transfers: "Transfer Requests", available: "Available Quarters", occupied: "Occupied Quarters",
    waitlisted: "Waitlisted", aging: "Pending Over 15 Days", verification: "Verification Queue",
    seniorityTotal: "Active Seniority Queue"
  };
  const highlight = new Set(["pending", "available", "occupied", "specialCases", "verification", "changes"]);
  const statusRows = Array.isArray(data?.statuses) ? data.statuses : Array.isArray(data?.summary) ? data.summary : [];
  return <Stack spacing={3}>
    <Paper sx={{ p: { xs: 2.5, md: 3 }, color: "white", background: "linear-gradient(115deg, #123b63 0%, #1d5a8e 60%, #c68b17 145%)", borderRadius: 3 }}>
      <Typography variant="overline" sx={{ opacity: 0.8 }}>{user?.role.replaceAll("_", " ")}</Typography>
      <Typography variant="h4" fontWeight={700}>Quarter Allocation Dashboard</Typography>
      <Typography sx={{ opacity: 0.86, mt: 0.5 }}>Monitor inventory, applications and approvals from one workspace.</Typography>
    </Paper>
    <ErrorText error={error} />
    {isLoading ? <CircularProgress /> : <Grid container spacing={2}>{metrics.map(([key, value]) =>
      <Grid key={key} size={{ xs: 12, sm: 6, md: 3 }}><Card variant="outlined" sx={{ height: "100%", borderLeft: `5px solid ${highlight.has(key) ? "#c68b17" : "#123b63"}` }}><CardContent>
        <Typography color="text.secondary" fontSize={13} fontWeight={600}>{titles[key] ?? key.replaceAll(/([A-Z])/g, " $1")}</Typography>
        <Typography variant="h3" mt={1} fontWeight={700} color="primary.main">{value}</Typography>
      </CardContent></Card></Grid>)}</Grid>}
    <Grid container spacing={2}>
      {user?.role === "UNIT_USER" && Array.isArray(data?.seniority) && <Grid size={{ xs: 12 }}><Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={650}>Applicant Queue Position From Your Unit</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>Lower number means closer to allotment: #1 is first in line. Special cases are placed before normal applications; normal applications retain their original submitted order.</Typography>
        <DataTable columns={[
          { key: "seniorityPosition", label: "Queue Position" },
          { key: "applicationNo", label: "Application" },
          { key: "personnel", label: "Applicant", render: (r) => r.personnel.fullName },
          { key: "priority", label: "Case Type", render: (r) => r.isSpecialCase ? <Chip size="small" color="warning" label="Special Case" /> : "Normal" },
          { key: "casePosition", label: "Special/Regular Position", render: (r) => `${r.caseLabel} #${r.casePosition}` },
          { key: "types", label: "Quarter-Type Position", render: (r) => <Stack spacing={0.25}>{r.typeSeniority.map((entry: AnyRow) =>
            <Typography key={`${entry.quarterType}-${entry.position}-${entry.casePosition}`} variant="body2">{entry.quarterType}: Queue #{entry.position} ({entry.caseLabel} #{entry.casePosition})</Typography>
          )}</Stack> },
          { key: "submittedAt", label: "Submitted", render: (r) => r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "-" },
          { key: "status", label: "Status", render: (r) => <Chip size="small" label={r.status.replaceAll("_", " ")} /> }
        ]} rows={data.seniority} />
      </Paper></Grid>}
      {data?.queue && <Grid size={{ xs: 12, lg: 8 }}><Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={650} mb={2}>Priority Review Queue</Typography>
        <DataTable columns={[
          { key: "applicationNo", label: "Application" },
          { key: "personnel", label: "Personnel", render: (r) => r.personnel.fullName },
          { key: "status", label: "Status", render: (r) => <Chip size="small" label={r.status} /> }
        ]} rows={data.queue} />
      </Paper></Grid>}
      {!!statusRows.length && <Grid size={{ xs: 12, lg: data?.queue ? 4 : 12 }}><Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
        <Typography variant="h6" fontWeight={650} mb={2}>Quarter Status</Typography>
        <Stack spacing={1.25}>{statusRows.map((row: AnyRow) => <Stack key={row.status} direction="row" justifyContent="space-between" alignItems="center">
          <Chip size="small" variant="outlined" label={row.status.replaceAll("_", " ")} />
          <Typography fontWeight={700}>{row._count}</Typography>
        </Stack>)}</Stack>
      </Paper></Grid>}
    </Grid>
  </Stack>;
}

export function UsersPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { data = [], error } = useApi("users", "/users");
  const { data: units = [] } = useApi("units", "/police-units");
  const [form, setForm] = useState({ fullName: "", username: "", password: "Admin@12345", role: "UNIT_USER", policeUnitId: "" });
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [requestError, setRequestError] = useState<unknown>();
  const resetForm = () => {
    setEditing(null);
    setForm({ fullName: "", username: "", password: "Admin@12345", role: "UNIT_USER", policeUnitId: "" });
  };
  const save = async () => {
    try {
      const payload = { fullName: form.fullName, username: form.username, role: form.role, policeUnitId: form.policeUnitId || null };
      if (editing) await api.patch(`/users/${editing.id}`, payload);
      else await api.post("/users", { ...payload, password: form.password });
      resetForm();
      await client.invalidateQueries({ queryKey: ["users"] });
    } catch (e) { setRequestError(e); }
  };
  const edit = (row: AnyRow) => {
    setEditing(row);
    setForm({ fullName: row.fullName, username: row.username, password: "Admin@12345", role: row.role, policeUnitId: row.policeUnitId ?? "" });
  };
  const toggleStatus = async (row: AnyRow) => {
    if (row.id === user?.id && row.isActive) { setRequestError(new Error("You cannot deactivate your currently signed-in account.")); return; }
    if (row.isActive && !window.confirm(`Deactivate user ${row.username}?`)) return;
    try {
      await api.patch(`/users/${row.id}/status`, { isActive: !row.isActive });
      await client.invalidateQueries({ queryKey: ["users"] });
    } catch (e) { setRequestError(e); }
  };
  const userForm = (mode: "create" | "edit") => <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
    <TextField label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
    <TextField label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
    {mode === "create" && <TextField label="Initial password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
    <TextField label="Role" select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}</TextField>
    <TextField label="Police unit" select value={form.policeUnitId} onChange={(e) => setForm({ ...form, policeUnitId: e.target.value })} sx={{ minWidth: 190 }}>
      <MenuItem value="">None</MenuItem>{units.map((u: AnyRow) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
    </TextField>
    <Button variant="contained" onClick={save}>{mode === "edit" ? "Update" : "Create"}</Button>
    {mode === "edit" && <Button onClick={resetForm}>Cancel</Button>}
  </Stack>;
  return <Page title="User Management">
    <ErrorText error={error || requestError} />
    {!editing && <Paper variant="outlined" sx={{ p: 2 }}>{userForm("create")}</Paper>}
    <DataTable rows={data} columns={[
      { key: "username", label: "Username" }, { key: "fullName", label: "Name" }, { key: "role", label: "Role" },
      { key: "policeUnit", label: "Unit", render: (r) => r.policeUnit?.name ?? "-" },
      { key: "isActive", label: "Status", render: (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
      { key: "actions", label: "Actions", render: (r) => <RowActions onEdit={() => edit(r)} onDelete={() => toggleStatus(r)} deleteDisabled={!r.isActive || r.id === user?.id} /> }
    ]} renderBeforeRow={(row) => editing?.id === row.id ? <Box>
      <Typography fontWeight={650} mb={1}>Edit user: {row.username}</Typography>
      {userForm("edit")}
    </Box> : null} />
  </Page>;
}

export function MastersPage() {
  const client = useQueryClient();
  const [tab, setTab] = useState("police-units");
  const { data = [], error } = useApi(tab, `/${tab}`);
  const { data: designations = [] } = useApi("designations", "/designations");
  const { data: types = [] } = useApi("quarter-types", "/quarter-types");
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [unitForm, setUnitForm] = useState({ name: "", unitType: "POLICE_STATION", address: "", contactNumber: "" });
  const emptyQuarterTypeForm = {
    name: "",
    displayOrder: "0",
    payScaleRange: "",
    standardAreaSqM: "",
    sanctionedTotal: "0",
    sanctionedOccupied: "0",
    sanctionedVacant: "0",
    sanctionedDamagedUnlivable: "0",
    description: ""
  };
  const [quarterTypeForm, setQuarterTypeForm] = useState(emptyQuarterTypeForm);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [requestError, setRequestError] = useState<unknown>();
  const save = async () => {
    try {
      const body = tab === "police-units" ? unitForm :
        tab === "designations" ? { code: extra, name, rankOrder: editing?.rankOrder ?? designations.length + 1 } :
        tab === "quarter-types" ? {
          ...quarterTypeForm,
          displayOrder: Number(quarterTypeForm.displayOrder || 0),
          standardAreaSqM: quarterTypeForm.standardAreaSqM ? Number(quarterTypeForm.standardAreaSqM) : null,
          sanctionedTotal: Number(quarterTypeForm.sanctionedTotal || 0),
          sanctionedOccupied: Number(quarterTypeForm.sanctionedOccupied || 0),
          sanctionedVacant: Number(quarterTypeForm.sanctionedVacant || 0),
          sanctionedDamagedUnlivable: Number(quarterTypeForm.sanctionedDamagedUnlivable || 0),
          payScaleRange: quarterTypeForm.payScaleRange || null,
          description: quarterTypeForm.description || null
        } :
        { name };
      if (editing) await api.patch(`/${tab}/${editing.id}`, body);
      else await api.post(`/${tab}`, body);
      setName(""); setExtra(""); setUnitForm({ name: "", unitType: "POLICE_STATION", address: "", contactNumber: "" }); setQuarterTypeForm(emptyQuarterTypeForm); setEditing(null); await client.invalidateQueries({ queryKey: [tab] });
    } catch (e) { setRequestError(e); }
  };
  const edit = (row: AnyRow) => {
    setEditing(row);
    if (tab === "police-units") setUnitForm({ name: row.name, unitType: row.unitType, address: row.address ?? "", contactNumber: row.contactNumber ?? "" });
    else if (tab === "quarter-types") setQuarterTypeForm({
      name: row.name ?? "",
      displayOrder: String(row.displayOrder ?? 0),
      payScaleRange: row.payScaleRange ?? "",
      standardAreaSqM: row.standardAreaSqM ? String(row.standardAreaSqM) : "",
      sanctionedTotal: String(row.sanctionedTotal ?? 0),
      sanctionedOccupied: String(row.sanctionedOccupied ?? 0),
      sanctionedVacant: String(row.sanctionedVacant ?? 0),
      sanctionedDamagedUnlivable: String(row.sanctionedDamagedUnlivable ?? 0),
      description: row.description ?? ""
    });
    else { setName(row.name); setExtra(tab === "designations" ? row.code : ""); }
  };
  const remove = async (row: AnyRow) => {
    if (!window.confirm(`Deactivate ${row.name}? Historical usage will be retained.`)) return;
    try { await api.delete(`/${tab}/${row.id}`); await client.invalidateQueries({ queryKey: [tab] }); }
    catch (e) { setRequestError(e); }
  };
  const cancelEdit = () => {
    setEditing(null); setName(""); setExtra(""); setUnitForm({ name: "", unitType: "POLICE_STATION", address: "", contactNumber: "" }); setQuarterTypeForm(emptyQuarterTypeForm);
  };
  const masterForm = (mode: "create" | "edit") => tab === "police-units" ? <Grid container spacing={2}>
    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Unit / Police Station Name" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 2.5 }}><TextField fullWidth select label="Unit Type" value={unitForm.unitType} onChange={(e) => setUnitForm({ ...unitForm, unitType: e.target.value })}>
      {unitTypes.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
    </TextField></Grid>
    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Address / Description" value={unitForm.address} onChange={(e) => setUnitForm({ ...unitForm, address: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 2.5 }}><TextField fullWidth label="Contact Number" value={unitForm.contactNumber} onChange={(e) => setUnitForm({ ...unitForm, contactNumber: e.target.value })} /></Grid>
    <Grid size={{ xs: 12 }}><Stack direction="row" spacing={1}>
      <Button variant="contained" onClick={save} disabled={!unitForm.name.trim()}>{mode === "edit" ? "Update Unit" : "Create Unit"}</Button>
      {mode === "edit" && <Button onClick={cancelEdit}>Cancel</Button>}
    </Stack></Grid>
  </Grid> : tab === "quarter-types" ? <Grid container spacing={2}>
    <Grid size={{ xs: 12, md: 1.2 }}><TextField fullWidth label="Type" value={quarterTypeForm.name} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, name: e.target.value.toUpperCase() })} /></Grid>
    <Grid size={{ xs: 12, md: 1.2 }}><TextField fullWidth type="number" label="Index" value={quarterTypeForm.displayOrder} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, displayOrder: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="Eligibility Pay Scale" value={quarterTypeForm.payScaleRange} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, payScaleRange: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 1.5 }}><TextField fullWidth type="number" label="Quarter Area" value={quarterTypeForm.standardAreaSqM} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, standardAreaSqM: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 1.2 }}><TextField fullWidth type="number" label="Total" value={quarterTypeForm.sanctionedTotal} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, sanctionedTotal: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 1.2 }}><TextField fullWidth type="number" label="Occupied" value={quarterTypeForm.sanctionedOccupied} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, sanctionedOccupied: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 1.2 }}><TextField fullWidth type="number" label="Vacant" value={quarterTypeForm.sanctionedVacant} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, sanctionedVacant: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 1.7 }}><TextField fullWidth type="number" label="Damaged/Unlivable" value={quarterTypeForm.sanctionedDamagedUnlivable} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, sanctionedDamagedUnlivable: e.target.value })} /></Grid>
    <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Description" value={quarterTypeForm.description} onChange={(e) => setQuarterTypeForm({ ...quarterTypeForm, description: e.target.value })} /></Grid>
    <Grid size={{ xs: 12 }}><Stack direction="row" spacing={1}>
      <Button variant="contained" onClick={save} disabled={!quarterTypeForm.name.trim()}>{mode === "edit" ? "Update Type" : "Create Type"}</Button>
      {mode === "edit" && <Button onClick={cancelEdit}>Cancel</Button>}
    </Stack></Grid>
  </Grid> : <Stack direction="row" spacing={2} alignItems="center">
    <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
    {tab === "designations" && <TextField label="Code" value={extra} onChange={(e) => setExtra(e.target.value)} />}
    <Button variant="contained" onClick={save}>{mode === "edit" ? "Update" : "Add"}</Button>
    {mode === "edit" && <Button onClick={cancelEdit}>Cancel</Button>}
  </Stack>;
  return <Page title="Master Data">
    <Stack direction="row" spacing={1}>{["police-units", "designations", "quarter-types", "areas", "eligibility-rules"].map((value) =>
      <Button key={value} variant={tab === value ? "contained" : "outlined"} onClick={() => { setTab(value); cancelEdit(); }}>{value === "police-units" ? "Police Units / Stations" : value.replaceAll("-", " ")}</Button>)}</Stack>
    <ErrorText error={error || requestError} />
    {tab !== "eligibility-rules" && !editing && <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={650} mb={2}>{tab === "police-units" ? "Create Police Unit / Station" : `Create ${tab.replaceAll("-", " ")}`}</Typography>
      {masterForm("create")}
    </Paper>}
    {tab === "eligibility-rules" ? <EligibilityTable rows={data} types={types} designations={designations} /> : tab === "police-units" ?
      <DataTable rows={data} columns={[
        { key: "name", label: "Police Unit / Station" },
        { key: "unitType", label: "Unit Type", render: (r) => unitTypes.find((type) => type.value === r.unitType)?.label ?? r.unitType },
        { key: "address", label: "Address / Description" },
        { key: "contactNumber", label: "Contact" },
        { key: "isActive", label: "Status", render: (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
        { key: "actions", label: "Actions", render: (r) => <RowActions onEdit={() => edit(r)} onDelete={r.isActive ? () => remove(r) : undefined} /> }
      ]} renderBeforeRow={(row) => editing?.id === row.id ? <Box>
        <Typography fontWeight={650} mb={1}>Edit Police Unit / Station: {row.name}</Typography>
        {masterForm("edit")}
      </Box> : null} /> :
      tab === "quarter-types" ?
      <DataTable rows={data} columns={[
        { key: "displayOrder", label: "Index" },
        { key: "name", label: "Quarter Type" },
        { key: "payScaleRange", label: "Eligibility Pay Scale", render: (r) => r.payScaleRange ?? "-" },
        { key: "standardAreaSqM", label: "Quarter Area", render: (r) => r.standardAreaSqM ?? "-" },
        { key: "sanctionedTotal", label: "Total" },
        { key: "sanctionedOccupied", label: "Occupied" },
        { key: "sanctionedVacant", label: "Vacant" },
        { key: "sanctionedDamagedUnlivable", label: "Damaged/Unlivable" },
        { key: "isActive", label: "Status", render: (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
        { key: "actions", label: "Actions", render: (r) => <RowActions onEdit={() => edit(r)} onDelete={r.isActive ? () => remove(r) : undefined} /> }
      ]} renderBeforeRow={(row) => editing?.id === row.id ? <Box>
        <Typography fontWeight={650} mb={1}>Edit quarter type: {row.name}</Typography>
        {masterForm("edit")}
      </Box> : null} /> :
      <DataTable rows={data} columns={[
        { key: "name", label: "Name" },
        { key: tab === "designations" ? "code" : "isActive", label: tab === "designations" ? "Code" : "Status", render: tab === "designations" ? undefined : (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
        { key: "actions", label: "Actions", render: (r) => <RowActions onEdit={() => edit(r)} onDelete={r.isActive ? () => remove(r) : undefined} /> }
      ]} renderBeforeRow={(row) => editing?.id === row.id ? <Box>
        <Typography fontWeight={650} mb={1}>Edit {tab.replaceAll("-", " ")}: {row.name}</Typography>
        {masterForm("edit")}
      </Box> : null} />}
  </Page>;
}
function EligibilityTable({ rows, types }: { rows: AnyRow[]; types: AnyRow[]; designations: AnyRow[] }) {
  const client = useQueryClient();
  const summary: AnyRow[] = types.map((type: AnyRow) => {
    const typeRules = rows.filter((row) => row.quarterTypeId === type.id);
    const eligible = typeRules
      .filter((row) => row.isEligible)
      .sort((a, b) => (a.designation.rankOrder ?? 0) - (b.designation.rankOrder ?? 0))
      .map((row) => row.designation.code)
      .join(",");
    const actual = rows.find((row) => row.quarterTypeId === type.id)?.quarterType?.actualInventory;
    return {
      ...type,
      eligible: eligible || "-",
      total: type.sanctionedTotal || actual?.total || 0,
      occupied: type.sanctionedOccupied || actual?.occupied || 0,
      vacant: type.sanctionedVacant || actual?.vacant || 0,
      damagedUnlivable: type.sanctionedDamagedUnlivable || actual?.damagedUnlivable || 0
    };
  });
  const totalRow = {
    id: "total",
    displayOrder: "Total",
    name: "",
    eligible: "",
    payScaleRange: "",
    standardAreaSqM: "",
    total: summary.reduce((sum: number, row: AnyRow) => sum + Number(row.total || 0), 0),
    occupied: summary.reduce((sum: number, row: AnyRow) => sum + Number(row.occupied || 0), 0),
    vacant: summary.reduce((sum: number, row: AnyRow) => sum + Number(row.vacant || 0), 0),
    damagedUnlivable: summary.reduce((sum: number, row: AnyRow) => sum + Number(row.damagedUnlivable || 0), 0)
  };
  return <Stack spacing={2}>
    <DataTable rows={[...summary, totalRow]} columns={[
      { key: "displayOrder", label: "Index" },
      { key: "name", label: "Quarter Type" },
      { key: "eligible", label: "Eligible" },
      { key: "payScaleRange", label: "Eligibility Pay Scale", render: (r) => r.payScaleRange || "-" },
      { key: "standardAreaSqM", label: "Quarter Area", render: (r) => r.standardAreaSqM || "-" },
      { key: "total", label: "Total" },
      { key: "occupied", label: "Occupied" },
      { key: "vacant", label: "Vacant" },
      { key: "damagedUnlivable", label: "Damaged/Unlivable" }
    ]} />
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={650} mb={1}>Designation Eligibility Rules</Typography>
      <DataTable rows={rows} columns={[
        { key: "designation", label: "Designation", render: (r) => r.designation.code },
        { key: "quarterType", label: "Quarter Type", render: (r) => r.quarterType.name },
        { key: "isEligible", label: "Eligible", render: (r) => <Switch checked={r.isEligible} onChange={async (_, checked) => { await api.patch(`/eligibility-rules/${r.id}`, { isEligible: checked }); client.invalidateQueries({ queryKey: ["eligibility-rules"] }); }} /> },
        { key: "requiresSpecialApproval", label: "Special Approval", render: (r) => <Switch checked={r.requiresSpecialApproval} onChange={async (_, checked) => { await api.patch(`/eligibility-rules/${r.id}`, { requiresSpecialApproval: checked }); client.invalidateQueries({ queryKey: ["eligibility-rules"] }); }} /> }
      ]} />
    </Paper>
  </Stack>;
}

export function PersonnelPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const { data: result = { rows: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, error, isLoading } = useQuery<{ rows: AnyRow[]; total: number; page: number; pageSize: number; totalPages: number }>({
    queryKey: ["personnel", page, appliedSearch],
    queryFn: () => api.get(`/personnel?summary=true&page=${page}&pageSize=50&q=${encodeURIComponent(appliedSearch)}`).then((response) => response.data.data)
  });
  const data = result.rows;
  const { data: units = [] } = useApi("units", "/police-units");
  const { data: designations = [] } = useApi("designations", "/designations");
  const [form, setForm] = useState({ indexNumber: "", buckleNumber: "", fullName: "", mobileNumber: "", designationId: "", currentPoliceUnitId: user?.policeUnitId ?? "", currentAddress: "", serviceJoinDate: "", lastPostingOutsideRajkot: "" });
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [requestError, setRequestError] = useState<unknown>();
  const resetPersonnelForm = () => {
    setEditing(null);
    setForm({ indexNumber: "", buckleNumber: "", fullName: "", mobileNumber: "", designationId: "", currentPoliceUnitId: user?.policeUnitId ?? "", currentAddress: "", serviceJoinDate: "", lastPostingOutsideRajkot: "" });
  };
  const save = async () => {
    try {
      const input = { ...form, serviceJoinDate: form.serviceJoinDate || null, lastPostingOutsideRajkot: form.lastPostingOutsideRajkot || null };
      if (editing) await api.patch(`/personnel/${editing.id}`, input);
      else await api.post("/personnel", input);
      resetPersonnelForm();
      await client.invalidateQueries({ queryKey: ["personnel"] });
      await client.invalidateQueries({ queryKey: ["quarter-personnel"] });
    }
    catch (e) { setRequestError(e); }
  };
  const edit = (row: AnyRow) => {
    setEditing(row);
    setForm({
      indexNumber: row.indexNumber, buckleNumber: row.buckleNumber, fullName: row.fullName, mobileNumber: row.mobileNumber,
      designationId: row.designationId, currentPoliceUnitId: row.currentPoliceUnitId, currentAddress: row.currentAddress,
      serviceJoinDate: row.serviceJoinDate?.slice(0, 10) ?? "", lastPostingOutsideRajkot: row.lastPostingOutsideRajkot ?? ""
    });
  };
  const remove = async (row: AnyRow) => {
    if (!window.confirm(`Deactivate personnel record for ${row.fullName}?`)) return;
    try { await api.delete(`/personnel/${row.id}`); await client.invalidateQueries({ queryKey: ["personnel"] }); }
    catch (e) { setRequestError(e); }
  };
  const personnelForm = (mode: "create" | "edit") => <Grid container spacing={2}>
    {(["indexNumber", "buckleNumber", "fullName", "mobileNumber", "currentAddress", "lastPostingOutsideRajkot"] as const).map((key) =>
      <Grid key={key} size={{ xs: 12, md: 4 }}><TextField fullWidth label={key.replaceAll(/([A-Z])/g, " $1")} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Grid>)}
    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="date" label="Service Join Date" value={form.serviceJoinDate} onChange={(e) => setForm({ ...form, serviceJoinDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Designation" value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>{designations.map((d: AnyRow) => <MenuItem key={d.id} value={d.id}>{d.code}</MenuItem>)}</TextField></Grid>
    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Posting" value={form.currentPoliceUnitId} onChange={(e) => setForm({ ...form, currentPoliceUnitId: e.target.value })}>{units.map((u: AnyRow) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}</TextField></Grid>
    <Grid size={{ xs: 12 }}><Stack direction="row" spacing={1}>
      <Button variant="contained" onClick={save}>{mode === "edit" ? "Update Personnel" : "Create Personnel"}</Button>
      {mode === "edit" && <Button onClick={resetPersonnelForm}>Cancel</Button>}
    </Stack></Grid>
  </Grid>;
  return <Page title="Personnel Records">
    <ErrorText error={error || requestError} />
    {user?.role === "ADMIN" && !editing && <Paper variant="outlined" sx={{ p: 2 }}>{personnelForm("create")}</Paper>}
    <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
      <Stack direction="row" spacing={1}>
        <TextField size="small" label="Search name, index or buckle" value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); setAppliedSearch(search.trim()); } }} sx={{ minWidth: 300 }} />
        <Button variant="outlined" onClick={() => { setPage(1); setAppliedSearch(search.trim()); }}>Search</Button>
        {appliedSearch && <Button onClick={() => { setSearch(""); setAppliedSearch(""); setPage(1); }}>Clear</Button>}
      </Stack>
      <Typography color="text.secondary">{result.total} record{result.total === 1 ? "" : "s"} found</Typography>
    </Stack></Paper>
    {isLoading ? <Box py={4} display="flex" justifyContent="center"><CircularProgress /></Box> : <DataTable rows={data} columns={[
      { key: "indexNumber", label: "Index" }, { key: "buckleNumber", label: "Buckle" }, { key: "fullName", label: "Name" },
      { key: "designation", label: "Rank", render: (r) => r.designation.code }, { key: "currentPoliceUnit", label: "Posting", render: (r) => r.currentPoliceUnit.name },
      { key: "occupancies", label: "Current Quarter", render: (r) => r.occupancies[0]?.quarter.houseNumber ?? "-" },
      { key: "isActive", label: "Status", render: (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
      { key: "actions", label: "Actions", render: (r) => user?.role === "ADMIN" ? <RowActions onEdit={() => edit(r)} onDelete={r.isActive ? () => remove(r) : undefined} /> : null }
    ]} renderBeforeRow={(row) => editing?.id === row.id ? <Box>
      <Typography fontWeight={650} mb={1}>Edit personnel: {row.fullName}</Typography>
      {personnelForm("edit")}
    </Box> : null} />}
    <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
      <Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
      <Typography>Page {result.page} of {result.totalPages}</Typography>
      <Button disabled={page >= result.totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
    </Stack>
  </Page>;
}

export function QuartersPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: quarterResult = { rows: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, error, isLoading, isFetching } = useQuery<{ rows: AnyRow[]; total: number; page: number; pageSize: number; totalPages: number }>({
    queryKey: ["quarters", page],
    queryFn: () => api.get(`/quarters?summary=true&page=${page}&pageSize=50`).then((response) => response.data.data)
  });
  const data = quarterResult.rows;
  const { data: areas = [] } = useApi("areas", "/areas");
  const { data: types = [] } = useApi("quarter-types", "/quarter-types");
  const { data: personnel = [] } = useApi("quarter-personnel", "/personnel/options", user?.role === "ADMIN");
  const { data: availableForOccupancy = [] } = useApi("inventory-available-quarters", "/quarters/available", user?.role === "ADMIN");
  const { data: requests = [] } = useApi("quarter-change-requests", "/quarter-change-requests", user?.role === "ADMIN" || user?.role === "CORRESPONDENCE_BRANCH");
  const editable = user?.role === "ADMIN" || user?.role === "CORRESPONDENCE_BRANCH";
  const [form, setForm] = useState({ areaId: "", quarterTypeId: "", houseNumber: "", wing: "", block: "", floor: "", status: "AVAILABLE" });
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [occupancy, setOccupancy] = useState({ personnelId: "", quarterId: "", allocatedDate: new Date().toISOString().slice(0, 10) });
  const [requestError, setRequestError] = useState<unknown>();
  const resetQuarterForm = () => {
    setEditing(null);
    setForm({ areaId: "", quarterTypeId: "", houseNumber: "", wing: "", block: "", floor: "", status: "AVAILABLE" });
  };
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ["quarters"] }),
    client.invalidateQueries({ queryKey: ["inventory-available-quarters"] }),
    client.invalidateQueries({ queryKey: ["quarter-change-requests"] })
  ]);
  const save = async () => {
    try {
      if (editing) await api.patch(`/quarters/${editing.id}`, form);
      else await api.post("/quarters", form);
      resetQuarterForm();
      await refresh();
    } catch (e) { setRequestError(e); }
  };
  const upload = async () => {
    if (!file) return;
    const payload = new FormData(); payload.append("file", file);
    try {
      setImporting(true);
      await api.post("/quarters/bulk-upload", payload);
      setFile(null);
      setPage(1);
      await refresh();
    } catch (e) { setRequestError(e); }
    finally { setImporting(false); }
  };
  const addOccupancy = async () => {
    try { await api.post("/occupancy-records", occupancy); await refresh(); } catch (e) { setRequestError(e); }
  };
  const edit = (row: AnyRow) => {
    setEditing(row);
    setForm({ areaId: row.areaId, quarterTypeId: row.quarterTypeId, houseNumber: row.houseNumber, wing: row.wing ?? "", block: row.block ?? "", floor: row.floor ?? "", status: row.status });
  };
  const remove = async (row: AnyRow) => {
    if (!window.confirm(`Deactivate quarter ${row.houseNumber}?`)) return;
    try { await api.delete(`/quarters/${row.id}`); await refresh(); } catch (e) { setRequestError(e); }
  };
  const quarterForm = (mode: "create" | "edit") => <Grid container spacing={2}>
    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Area" value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>{areas.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
    <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth select label="Type" value={form.quarterTypeId} onChange={(e) => setForm({ ...form, quarterTypeId: e.target.value })}>{types.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
    {(["houseNumber", "wing", "block", "floor"] as const).map((name) => <Grid key={name} size={{ xs: 6, md: 1.5 }}><TextField fullWidth label={name} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></Grid>)}
    <Grid size={{ xs: 12, md: 2 }}><Button fullWidth variant="contained" sx={{ height: 56 }} onClick={save}>{mode === "edit" ? "Update" : "Add"}</Button></Grid>
    {mode === "edit" && <Grid size={{ xs: 12, md: 2 }}><Button fullWidth sx={{ height: 56 }} onClick={resetQuarterForm}>Cancel</Button></Grid>}
  </Grid>;
  return <Page title="Quarter Inventory">
    <ErrorText error={error || requestError} />
    {editable && <Paper variant="outlined" sx={{ p: 2 }}>
      {!editing && <>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>Add Quarter {user?.role === "CORRESPONDENCE_BRANCH" && "(requires Admin approval)"}</Typography>
        {quarterForm("create")}
        <Divider sx={{ my: 2 }} />
      </>}
      {editing && <Alert severity="info" sx={{ mb: 2 }}>Editing is open directly above the selected quarter row below. Save or cancel there before adding another quarter.</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}><Button component="label" variant="outlined">Select CSV/XLSX Import<input hidden type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Button> {file?.name}</Grid>
        <Grid size={{ xs: 12, md: 3 }}><Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadFile("/quarters/import-template.xlsx", "quarter-import-template.xlsx")}>Sample XLSX Format</Button></Grid>
        <Grid size={{ xs: 12, md: 2 }}><Button variant="contained" disabled={!file || importing} onClick={upload}>{importing ? "Importing..." : "Import"}</Button></Grid>
        {importing && <Grid size={{ xs: 12 }}><LinearProgress /></Grid>}
      </Grid>
    </Paper>}
    {user?.role === "ADMIN" && <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} mb={2}>Record Existing Occupancy</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField select label="Personnel" value={occupancy.personnelId} onChange={(e) => setOccupancy({ ...occupancy, personnelId: e.target.value })} sx={{ minWidth: 230 }}>
          {personnel.map((p: AnyRow) => <MenuItem key={p.id} value={p.id}>{p.fullName} / {p.buckleNumber}</MenuItem>)}
        </TextField>
        <TextField select label="Available quarter" value={occupancy.quarterId} onChange={(e) => setOccupancy({ ...occupancy, quarterId: e.target.value })} sx={{ minWidth: 260 }}>
          {availableForOccupancy.map((q: AnyRow) => <MenuItem key={q.id} value={q.id}>{q.area.name} / {q.houseNumber}</MenuItem>)}
        </TextField>
        <TextField type="date" label="Allocated date" value={occupancy.allocatedDate} onChange={(e) => setOccupancy({ ...occupancy, allocatedDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="contained" onClick={addOccupancy} disabled={!occupancy.personnelId || !occupancy.quarterId}>Record</Button>
      </Stack>
    </Paper>}
    {isFetching && !isLoading && <LinearProgress />}
    {isLoading ? <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
      <CircularProgress />
      <Typography color="text.secondary" mt={2}>Loading quarter inventory in the background...</Typography>
    </Paper> : <>
    <Typography color="text.secondary">Showing {data.length} of {quarterResult.total} quarters. Page {quarterResult.page} of {quarterResult.totalPages}.</Typography>
    <DataTable rows={data} columns={[
      { key: "houseNumber", label: "House No." }, { key: "area", label: "Area", render: (r) => r.area.name },
      { key: "quarterType", label: "Type", render: (r) => r.quarterType.name },
      { key: "status", label: "Status", render: (r) => <Chip size="small" label={r.status} color={r.status === "AVAILABLE" ? "success" : r.status === "OCCUPIED" ? "primary" : "default"} /> },
      { key: "occupancies", label: "Resident", render: (r) => r.occupancies?.[0]?.personnel?.fullName ?? "-" },
      { key: "action", label: "Change Status", render: (r) => editable ? <TextField size="small" select disabled={!r.isActive} value={r.status === "OCCUPIED" ? "" : r.status} onChange={async (e) => {
        try { await api.patch(`/quarters/${r.id}/status`, { status: e.target.value, reason: "Updated through inventory screen" }); await refresh(); } catch (err) { setRequestError(err); }
      }}><MenuItem value="" disabled>Controlled occupancy</MenuItem>{statuses.filter((s) => s !== "OCCUPIED").map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField> : null },
      { key: "actions", label: "Actions", render: (r) => editable ? <RowActions onEdit={r.isActive ? () => edit(r) : undefined} onDelete={user?.role === "ADMIN" && r.isActive ? () => remove(r) : undefined} /> : null }
    ]} renderBeforeRow={(row) => editing?.id === row.id ? <Box>
      <Typography fontWeight={650} mb={1}>Edit quarter: {row.houseNumber}</Typography>
      {quarterForm("edit")}
    </Box> : null} />
    <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
      <Button disabled={page <= 1 || isFetching} onClick={() => setPage((current) => current - 1)}>Previous</Button>
      <Typography>Page {quarterResult.page} of {quarterResult.totalPages}</Typography>
      <Button disabled={page >= quarterResult.totalPages || isFetching} onClick={() => setPage((current) => current + 1)}>Next</Button>
    </Stack>
    </>}
    {(user?.role === "ADMIN" || user?.role === "CORRESPONDENCE_BRANCH") && <Box>
      <Typography variant="h6" mb={1}>Inventory Change Requests</Typography>
      <DataTable rows={requests} columns={[
        { key: "requestType", label: "Type" }, { key: "status", label: "Status" }, { key: "createdAt", label: "Created", render: (r) => new Date(r.createdAt).toLocaleString() },
        { key: "actions", label: "Action", render: (r) => user.role === "ADMIN" && r.status === "PENDING" ? <Stack direction="row" spacing={1}>
          <Button size="small" onClick={async () => { await api.post(`/quarter-change-requests/${r.id}/approve`); refresh(); }}>Approve</Button>
          <Button size="small" color="error" onClick={async () => { await api.post(`/quarter-change-requests/${r.id}/reject`, {}); refresh(); }}>Reject</Button>
        </Stack> : "-" }
      ]} />
    </Box>}
  </Page>;
}

export function ApplicationsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { data: applications = [], error } = useApi("applications", "/applications", true, 5000);
  const { data: areas = [] } = useApi("areas", "/areas", user?.role === "UNIT_USER");
  const { data: types = [] } = useApi("quarter-types", "/quarter-types", user?.role === "UNIT_USER");
  const { data: designations = [] } = useApi("designations", "/designations", user?.role === "UNIT_USER");
  const { data: eligibilityRules = [] } = useApi("application-eligibility", "/eligibility-rules", user?.role === "UNIT_USER");
  const { data: available = [] } = useApi("available-quarters", "/quarters/available", user?.role === "SUPER_ADMIN");
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [requestError, setRequestError] = useState<unknown>();
  const emptyForm = { indexNumber: "", buckleNumber: "", fullName: "", mobileNumber: "", designationId: "", currentAddress: "", serviceJoinDate: "", lastPostingOutsideRajkot: "", areaId: "", quarterTypeId: "", areaId2: "", quarterTypeId2: "", areaId3: "", quarterTypeId3: "", isSpecialCase: false, specialCaseCategory: "MEDICAL", specialCaseReason: "", reasonForChange: "", applyingForGroup: false, groupDetails: "" };
  const [requestType, setRequestType] = useState<"" | "NEW_ALLOTMENT" | "TRANSFER_CHANGE">("");
  const [form, setForm] = useState(emptyForm);
  const [letter, setLetter] = useState<File | null>(null);
  const [support, setSupport] = useState<File | null>(null);
  const lookupParams = new URLSearchParams();
  if (form.indexNumber.trim()) lookupParams.set("indexNumber", form.indexNumber.trim());
  if (form.buckleNumber.trim()) lookupParams.set("buckleNumber", form.buckleNumber.trim());
  const { data: matches = [] } = useQuery<AnyRow[]>({
    queryKey: ["applicant-lookup", form.indexNumber, form.buckleNumber],
    queryFn: () => api.get(`/personnel/search-duplicate?${lookupParams.toString()}`).then((response) => response.data.data),
    enabled: user?.role === "UNIT_USER" && lookupParams.size > 0
  });
  const match = matches.find((item) => item.person.indexNumber === form.indexNumber.trim() || item.person.buckleNumber === form.buckleNumber.trim());
  const hasQuarter = Boolean(match?.currentQuarter);
  const lookupComplete = Boolean(form.indexNumber.trim() && form.buckleNumber.trim());
  const selectionConflict = (requestType === "NEW_ALLOTMENT" && hasQuarter) || (requestType === "TRANSFER_CHANGE" && lookupComplete && !hasQuarter);
  const eligibleTypes = form.designationId
    ? types.filter((type: AnyRow) => eligibilityRules.some((rule: AnyRow) => rule.designationId === form.designationId && rule.quarterTypeId === type.id && rule.isEligible))
    : [];
  const hasIneligiblePreference = [form.quarterTypeId, form.quarterTypeId2, form.quarterTypeId3]
    .filter(Boolean)
    .some((typeId) => !eligibleTypes.some((type: AnyRow) => type.id === typeId));
  const reload = async () => { await client.invalidateQueries({ queryKey: ["applications"] }); };
  const chooseRequestType = (type: "NEW_ALLOTMENT" | "TRANSFER_CHANGE") => {
    setRequestType(type);
    setForm(emptyForm);
    setLetter(null);
    setSupport(null);
    setRequestError(undefined);
  };
  async function upload(applicationId: string, document: File, attachmentType: string) {
    const body = new FormData();
    body.append("attachmentType", attachmentType);
    body.append("file", document);
    await api.post(`/applications/${applicationId}/attachments`, body);
  }
  const submitApplication = async () => {
    try {
      if (!letter) throw new Error("Application letter is required");
      if (form.isSpecialCase && !support) throw new Error("Special case document is required");
      const response = await api.post("/applications", {
        applicationType: requestType,
        applicant: {
          indexNumber: form.indexNumber, buckleNumber: form.buckleNumber, fullName: form.fullName,
          mobileNumber: form.mobileNumber, designationId: form.designationId, currentAddress: form.currentAddress,
          serviceJoinDate: form.serviceJoinDate, lastPostingOutsideRajkot: form.lastPostingOutsideRajkot || null
        },
        reasonForChange: form.reasonForChange || null, applyingForGroup: form.applyingForGroup, groupDetails: form.groupDetails || null,
        isSpecialCase: form.isSpecialCase, specialCaseCategory: form.isSpecialCase ? form.specialCaseCategory : null,
        specialCaseReason: form.isSpecialCase ? form.specialCaseReason : null,
        preferences: [
          { areaId: form.areaId, quarterTypeId: form.quarterTypeId, preferenceOrder: 1 },
          form.areaId2 && form.quarterTypeId2 ? { areaId: form.areaId2, quarterTypeId: form.quarterTypeId2, preferenceOrder: 2 } : null,
          form.areaId3 && form.quarterTypeId3 ? { areaId: form.areaId3, quarterTypeId: form.quarterTypeId3, preferenceOrder: 3 } : null
        ].filter(Boolean)
      });
      const id = response.data.data.id;
      await upload(id, letter, "APPLICATION_LETTER");
      if (support) await upload(id, support, "SPECIAL_CASE_DOCUMENT");
      await api.post(`/applications/${id}/submit`);
      setForm(emptyForm);
      setRequestType("");
      setLetter(null);
      setSupport(null);
      await reload();
    } catch (e) { setRequestError(e); }
  };
  const decision = async (url: string, body: AnyRow = {}) => {
    try { await api.post(url, body); setSelected(null); await reload(); } catch (e) { setRequestError(e); }
  };
  const firstInStage = (statuses: string[]) => applications.find((application: AnyRow) => statuses.includes(application.status));
  const sequentialBlocker = selected ? (() => {
    const stage =
      user?.role === "ADMIN" && ["ADMIN_REVIEW", "DUPLICATE_REVIEW"].includes(selected.status) ? ["DUPLICATE_REVIEW", "ADMIN_REVIEW"] :
      user?.role === "CORRESPONDENCE_BRANCH" && selected.status === "CORRESPONDENCE_REVIEW" ? ["CORRESPONDENCE_REVIEW"] :
      user?.role === "SUPER_ADMIN" && selected.status === "SUPER_ADMIN_REVIEW" ? ["SUPER_ADMIN_REVIEW"] :
      user?.role === "SUPER_ADMIN" && selected.status === "APPROVED_PENDING_ALLOTMENT" ? ["APPROVED_PENDING_ALLOTMENT"] :
      [];
    const first = stage.length ? firstInStage(stage) : null;
    return first && first.id !== selected.id ? first : null;
  })() : null;
  const isSequentiallyAllowed = !sequentialBlocker;
  return <Page title="Applications">
    <ErrorText error={error || requestError} />
    {user?.role === "SUPER_ADMIN" && <Alert severity="info" sx={{ mb: 2 }}>
      Quarter allotment is available after Administrator and Correspondence verification. Records at <b>SUPER_ADMIN_REVIEW</b> can be approved for allotment; records at <b>APPROVED_PENDING_ALLOTMENT</b> allow final quarter selection.
    </Alert>}
    {user?.role === "UNIT_USER" && <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" mb={2}>Create Application</Typography>
      {!requestType ? <Stack spacing={2}>
        <Typography color="text.secondary">Select the request type to begin. Only fields relevant to that request will be shown.</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button variant="contained" size="large" onClick={() => chooseRequestType("NEW_ALLOTMENT")}>New Allotment</Button>
          <Button variant="outlined" size="large" onClick={() => chooseRequestType("TRANSFER_CHANGE")}>Transfer / Quarter Change</Button>
        </Stack>
      </Stack> : <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} mb={2}>
        <Chip color="primary" label={requestType === "NEW_ALLOTMENT" ? "New Allotment" : "Transfer / Quarter Change"} />
        <Button size="small" onClick={() => chooseRequestType(requestType === "NEW_ALLOTMENT" ? "TRANSFER_CHANGE" : "NEW_ALLOTMENT")}>Change Request Type</Button>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>Index Number means the official departmental employee/service index number. Enter the applicant details; the system creates or reuses the linked profile automatically.</Alert>
      {match?.activeApplication && <Alert severity="warning" sx={{ mb: 2 }}>This personnel already has active application {match.activeApplication.applicationNo}.</Alert>}
      {requestType === "NEW_ALLOTMENT" && hasQuarter && <Alert severity="error" sx={{ mb: 2 }}>An occupied quarter is already recorded for this applicant. Select Transfer / Quarter Change.</Alert>}
      {requestType === "TRANSFER_CHANGE" && lookupComplete && !hasQuarter && <Alert severity="error" sx={{ mb: 2 }}>No current occupied quarter was found for this applicant. Transfer/change can be submitted only for an existing occupant.</Alert>}
      {requestType === "TRANSFER_CHANGE" && hasQuarter && <Alert severity="info" sx={{ mb: 2 }}>Existing occupied quarter verified. Provide the reason for the requested change.</Alert>}
      {form.designationId && <Alert severity={eligibleTypes.length ? "success" : "error"} sx={{ mb: 2 }}>
        {eligibleTypes.length ? `Eligible quarter types for the selected designation: ${eligibleTypes.map((type: AnyRow) => type.name).join(", ")}.` : "No quarter type is currently eligible for the selected designation."}
      </Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Index Number" helperText="Official employee/service index number" value={form.indexNumber} onChange={(e) => setForm({ ...form, indexNumber: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Buckle Number" value={form.buckleNumber} onChange={(e) => setForm({ ...form, buckleNumber: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Mobile Number" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required select label="Designation" value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value, quarterTypeId: "", quarterTypeId2: "", quarterTypeId3: "" })}>{designations.map((d: AnyRow) => <MenuItem key={d.id} value={d.id}>{d.code} - {d.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required type="date" label="Service Join Date" value={form.serviceJoinDate} onChange={(e) => setForm({ ...form, serviceJoinDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Current Address" value={form.currentAddress} onChange={(e) => setForm({ ...form, currentAddress: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Last Posting (if outside Rajkot)" value={form.lastPostingOutsideRajkot} onChange={(e) => setForm({ ...form, lastPostingOutsideRajkot: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Preferred Area" value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>{areas.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required select disabled={!form.designationId} label="Preferred Type" helperText={!form.designationId ? "Select designation first" : "Eligible types only"} value={form.quarterTypeId} onChange={(e) => setForm({ ...form, quarterTypeId: e.target.value })}>{eligibleTypes.map((t: AnyRow) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Second Area (optional)" value={form.areaId2} onChange={(e) => setForm({ ...form, areaId2: e.target.value })}><MenuItem value="">None</MenuItem>{areas.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select disabled={!form.designationId} label="Second Type" value={form.quarterTypeId2} onChange={(e) => setForm({ ...form, quarterTypeId2: e.target.value })}><MenuItem value="">None</MenuItem>{eligibleTypes.map((t: AnyRow) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Third Area (optional)" value={form.areaId3} onChange={(e) => setForm({ ...form, areaId3: e.target.value })}><MenuItem value="">None</MenuItem>{areas.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select disabled={!form.designationId} label="Third Type" value={form.quarterTypeId3} onChange={(e) => setForm({ ...form, quarterTypeId3: e.target.value })}><MenuItem value="">None</MenuItem>{eligibleTypes.map((t: AnyRow) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField></Grid>
        {requestType === "TRANSFER_CHANGE" && <Grid size={{ xs: 12 }}><TextField fullWidth required label="Reason for transfer/change" value={form.reasonForChange} onChange={(e) => setForm({ ...form, reasonForChange: e.target.value })} /></Grid>}
        <Grid size={{ xs: 12, md: 4 }}><FormControlLabel control={<Switch checked={form.applyingForGroup} onChange={(_, value) => setForm({ ...form, applyingForGroup: value })} />} label="Applying for group" /></Grid>
        {form.applyingForGroup && <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Group details" value={form.groupDetails} onChange={(e) => setForm({ ...form, groupDetails: e.target.value })} /></Grid>}
        <Grid size={{ xs: 12, md: 4 }}><FormControlLabel control={<Switch checked={form.isSpecialCase} onChange={(_, value) => setForm({ ...form, isSpecialCase: value })} />} label="Special case / urgency" /></Grid>
        {form.isSpecialCase && <>
          <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Urgency Category" value={form.specialCaseCategory} onChange={(e) => setForm({ ...form, specialCaseCategory: e.target.value })}>{["MEDICAL", "DISABILITY", "WIDOW_COMPASSIONATE", "DISTANCE_FROM_POSTING", "FAMILY_SAFETY", "OTHER"].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, md: 5 }}><TextField fullWidth label="Special case reason" value={form.specialCaseReason} onChange={(e) => setForm({ ...form, specialCaseReason: e.target.value })} /></Grid>
        </>}
        <Grid size={{ xs: 12, md: 4 }}><Button component="label" variant="outlined">Application Letter *<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setLetter(e.target.files?.[0] ?? null)} /></Button> {letter?.name}</Grid>
        {form.isSpecialCase && <Grid size={{ xs: 12, md: 4 }}><Button component="label" variant="outlined">Supporting Document *<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setSupport(e.target.files?.[0] ?? null)} /></Button> {support?.name}</Grid>}
        <Grid size={{ xs: 12 }}><Button variant="contained" onClick={submitApplication} disabled={!form.indexNumber || !form.buckleNumber || !form.fullName || !form.mobileNumber || !form.designationId || !form.currentAddress || !form.serviceJoinDate || !form.areaId || !form.quarterTypeId || (requestType === "TRANSFER_CHANGE" && !form.reasonForChange.trim()) || selectionConflict || hasIneligiblePreference || Boolean(match?.activeApplication)}>Create and Submit</Button></Grid>
      </Grid>
      </>}
    </Paper>}
    <DataTable rows={applications} columns={[
      { key: "applicationNo", label: "Application No." }, { key: "personnel", label: "Personnel", render: (r) => r.personnel.fullName },
      { key: "seniority", label: "Queue Position", render: (r) => <SeniorityView seniority={r.seniority} compact /> },
      { key: "applicationType", label: "Type" }, { key: "status", label: "Status", render: (r) => <Chip size="small" label={r.status} /> },
      { key: "isSpecialCase", label: "Special", render: (r) => r.isSpecialCase ? "Yes" : "No" },
      { key: "detail", label: "Action", render: (r) => <Button size="small" onClick={() => setSelected(r)}>View</Button> }
    ]} />
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
      <DialogTitle>{selected?.applicationNo}</DialogTitle>
      <DialogContent dividers>
        {selected && <Stack spacing={1}>
          <Typography><b>Personnel:</b> {selected.personnel.fullName} ({selected.personnel.designation.code})</Typography>
          <Typography><b>Index / Buckle:</b> {selected.personnel.indexNumber} / {selected.personnel.buckleNumber}</Typography>
          <Typography><b>Service Join Date:</b> {selected.personnel.serviceJoinDate ? new Date(selected.personnel.serviceJoinDate).toLocaleDateString() : "-"}</Typography>
          <Typography><b>Last Posting Outside Rajkot:</b> {selected.personnel.lastPostingOutsideRajkot ?? "-"}</Typography>
          <Box><Typography component="span" fontWeight={700}>Queue Position:</Typography><Box mt={0.5}><SeniorityView seniority={selected.seniority} /></Box></Box>
          <Typography><b>Status:</b> {selected.status}</Typography>
          <Typography><b>Preferences:</b> {selected.preferences.map((p: AnyRow) => `${p.area.name} / ${p.quarterType.name}`).join(", ")}</Typography>
          <Typography><b>Special case:</b> {selected.isSpecialCase ? `${selected.specialCaseCategory}: ${selected.specialCaseReason}` : "No"}</Typography>
          {user?.role === "SUPER_ADMIN" && selected.status === "ADMIN_REVIEW" && <Alert severity="warning">Waiting for Administrator verification. Allotment actions become available after the application is forwarded through Correspondence review.</Alert>}
          {user?.role === "SUPER_ADMIN" && selected.status === "CORRESPONDENCE_REVIEW" && <Alert severity="warning">Waiting for Correspondence verification. Once forwarded, you can approve this request for final allotment.</Alert>}
          {user?.role === "SUPER_ADMIN" && selected.status === "SUPER_ADMIN_REVIEW" && <Alert severity="success">Verification is complete. Use <b>Approve For Allotment</b> below to enable quarter selection for this request.</Alert>}
          {sequentialBlocker && <Alert severity="error">
            Sequential processing is enforced. Clear <b>{sequentialBlocker.applicationNo}</b> at queue position <b>#{sequentialBlocker.seniority?.overallPosition ?? "-"}</b> before taking action on this application.
          </Alert>}
          <Divider />
          <Typography fontWeight={600}>Attachments</Typography>
          {selected.attachments.map((a: AnyRow) => <Button key={a.id} startIcon={<DownloadIcon />} onClick={() => downloadFile(`/attachments/${a.id}/download`, a.originalFileName)}>{a.attachmentType}</Button>)}
          {user?.role === "SUPER_ADMIN" && selected.status === "APPROVED_PENDING_ALLOTMENT" && <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
            <Typography variant="subtitle1" fontWeight={650} mb={1}>Allot Quarter</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Select an available quarter matching the requested eligible types, then complete final allotment.</Typography>
            <AllotControl quarters={available} application={selected} action={decision} disabled={!isSequentiallyAllowed} />
          </Paper>}
        </Stack>}
      </DialogContent>
      <DialogActions>
        {selected && user?.role === "ADMIN" && (selected.status === "ADMIN_REVIEW" || selected.status === "DUPLICATE_REVIEW") && <>
          <Button disabled={!isSequentiallyAllowed} onClick={() => decision(`/applications/${selected.id}/admin-review`, { action: "VERIFY" })}>{selected.status === "DUPLICATE_REVIEW" ? "Clear Duplicate" : "Verify"}</Button>
          {selected.isSpecialCase && <Button disabled={!isSequentiallyAllowed} color="warning" onClick={() => decision(`/applications/${selected.id}/special-case/reject`)}>Reject Special Priority</Button>}
          <Button disabled={!isSequentiallyAllowed} color="error" onClick={() => decision(`/applications/${selected.id}/admin-review`, { action: "REJECT" })}>Reject Application</Button>
        </>}
        {selected && user?.role === "CORRESPONDENCE_BRANCH" && selected.status === "CORRESPONDENCE_REVIEW" && <>
          <Button disabled={!isSequentiallyAllowed} onClick={() => decision(`/applications/${selected.id}/correspondence-review`, { action: "VERIFY" })}>Verify</Button>
          <Button disabled={!isSequentiallyAllowed} onClick={() => decision(`/applications/${selected.id}/correspondence-review`, { action: "RETURN" })}>Return</Button>
        </>}
        {selected && user?.role === "SUPER_ADMIN" && selected.status === "SUPER_ADMIN_REVIEW" && <>
          <Button disabled={!isSequentiallyAllowed} variant="contained" onClick={() => decision(`/applications/${selected.id}/super-admin/approve-pending-allotment`)}>Approve For Allotment</Button>
          <Button disabled={!isSequentiallyAllowed} onClick={() => decision(`/applications/${selected.id}/super-admin/approve-waitlist`)}>Waitlist</Button>
          <Button disabled={!isSequentiallyAllowed} color="error" onClick={() => decision(`/applications/${selected.id}/super-admin/reject`)}>Reject</Button>
        </>}
        {selected && user?.role === "UNIT_USER" && selected.status === "RETURNED_FOR_RECONSIDERATION" && <Button onClick={() => decision(`/applications/${selected.id}/resubmit`)}>Resubmit Corrected Application</Button>}
        {selected?.status === "CLOSED" && <Button onClick={() => downloadFile(`/applications/${selected.id}/allotment-order/pdf`, "allotment-order.pdf")}>Allotment Order</Button>}
        <Button onClick={() => setSelected(null)}>Close</Button>
      </DialogActions>
    </Dialog>
  </Page>;
}
function AllotControl({ quarters, application, action, disabled = false }: { quarters: AnyRow[]; application: AnyRow; action: (url: string, body: AnyRow) => Promise<void>; disabled?: boolean }) {
  const [quarterId, setQuarterId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const requestedTypeIds = new Set(application.preferences.map((preference: AnyRow) => preference.quarterType.id));
  const matchingQuarters = quarters.filter((quarter) => requestedTypeIds.has(quarter.quarterType.id));
  return <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
    <TextField fullWidth select label="Available Requested Quarter" value={quarterId} onChange={(e) => setQuarterId(e.target.value)} sx={{ minWidth: 340 }}>
      {matchingQuarters.map((q) => <MenuItem key={q.id} value={q.id}>{q.area.name} / {q.quarterType.name} / {q.fullQuarterCode ?? q.houseNumber}</MenuItem>)}
    </TextField>
    <TextField type="date" label="Allotment Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    <Button variant="contained" disabled={disabled || !quarterId} onClick={() => action(`/applications/${application.id}/super-admin/allot`, { quarterId, allotmentDate: date })}>Allot Quarter</Button>
    {!matchingQuarters.length && <Typography color="error.main">No available quarter matches the requested types.</Typography>}
  </Stack>;
}

export function ReportsPage() {
  const { user } = useAuth();
  const unitReports = ["pending-applications", "urgent-applications", "allotment-history"];
  const allReports = ["quarter-availability", "quarter-occupancy", "pending-applications", "urgent-applications", "duplicate-applications", "allotment-history"];
  const choices = user?.role === "UNIT_USER" ? unitReports : allReports;
  const [type, setType] = useState(user?.role === "UNIT_USER" ? "pending-applications" : "quarter-availability");
  const { data = [], error } = useApi(`report-${type}`, `/reports/${type}`);
  const canExport = user?.role !== "UNIT_USER" && user?.role !== "VIEWER";
  const columns = useMemo(() => Object.keys(data[0] ?? {}).map((key) => ({ key, label: key })), [data]);
  return <Page title="Reports" actions={<Stack direction="row" spacing={1}>
    {canExport && ["csv", "excel", "pdf"].map((format) => <Button key={format} variant="outlined" onClick={() => downloadFile(`/reports/export/${type}?format=${format}`, `${type}.${format === "excel" ? "xlsx" : format}`)}>{format.toUpperCase()}</Button>)}
  </Stack>}>
    <ErrorText error={error} />
    <TextField select label="Report Type" value={type} onChange={(e) => setType(e.target.value)} sx={{ maxWidth: 350 }}>
      {choices.map((name) => <MenuItem key={name} value={name}>{name.replaceAll("-", " ")}</MenuItem>)}
    </TextField>
    <DataTable rows={data} columns={columns} />
  </Page>;
}

export function AuditPage() {
  const { data = [], error } = useApi("audit", "/audit-logs");
  return <Page title="Audit Logs">
    <ErrorText error={error} />
    <DataTable rows={data} columns={[
      { key: "createdAt", label: "Timestamp", render: (r) => new Date(r.createdAt).toLocaleString() },
      { key: "action", label: "Action" }, { key: "entityType", label: "Entity" },
      { key: "applicationNo", label: "Application No.", render: (r) => r.auditApplication?.applicationNo ?? "-" },
      { key: "personnel", label: "Personnel", render: (r) => r.auditApplication?.personnel ?? "-" },
      { key: "queuePosition", label: "Queue Position", render: (r) => r.auditApplication?.queuePosition ? `#${r.auditApplication.queuePosition}` : "-" },
      { key: "applicationType", label: "Type", render: (r) => r.auditApplication?.applicationType ?? "-" },
      { key: "details", label: "Details", render: auditDetails },
      { key: "user", label: "User", render: (r) => r.user?.username ?? "System" }, { key: "ipAddress", label: "IP" }
    ]} />
  </Page>;
}

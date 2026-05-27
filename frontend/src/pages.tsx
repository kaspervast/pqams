import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, IconButton, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell,
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

function useApi<T = AnyRow[]>(key: string, path: string, enabled = true) {
  return useQuery<T>({ queryKey: [key], queryFn: () => api.get(path).then((response) => response.data.data), enabled });
}
function ErrorText({ error }: { error: unknown }) {
  return error ? <Alert severity="error">{errorMessage(error)}</Alert> : null;
}
function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <Stack spacing={2}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="h5" fontWeight={650}>{title}</Typography>{actions}
    </Stack>
    {children}
  </Stack>;
}
function DataTable({ columns, rows }: { columns: Array<{ key: string; label: string; render?: (row: AnyRow) => ReactNode }>; rows: AnyRow[] }) {
  return <TableContainer component={Paper} variant="outlined">
    <Table size="small">
      <TableHead><TableRow>{columns.map((column) => <TableCell key={column.key} sx={{ fontWeight: 650 }}>{column.label}</TableCell>)}</TableRow></TableHead>
      <TableBody>
        {rows.map((row, index) => <TableRow key={row.id ?? index} hover>
          {columns.map((column) => <TableCell key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? "-")}</TableCell>)}
        </TableRow>)}
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
    waitlisted: "Waitlisted", aging: "Pending Over 15 Days", verification: "Verification Queue"
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
  const save = async () => {
    try {
      const payload = { fullName: form.fullName, username: form.username, role: form.role, policeUnitId: form.policeUnitId || null };
      if (editing) await api.patch(`/users/${editing.id}`, payload);
      else await api.post("/users", { ...payload, password: form.password });
      setForm({ fullName: "", username: "", password: "Admin@12345", role: "UNIT_USER", policeUnitId: "" });
      setEditing(null);
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
  return <Page title="User Management">
    <ErrorText error={error || requestError} />
    <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <TextField label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      <TextField label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
      {!editing && <TextField label="Initial password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
      <TextField label="Role" select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}</TextField>
      <TextField label="Police unit" select value={form.policeUnitId} onChange={(e) => setForm({ ...form, policeUnitId: e.target.value })} sx={{ minWidth: 190 }}>
        <MenuItem value="">None</MenuItem>{units.map((u: AnyRow) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
      </TextField>
      <Button variant="contained" onClick={save}>{editing ? "Update" : "Create"}</Button>
      {editing && <Button onClick={() => { setEditing(null); setForm({ fullName: "", username: "", password: "Admin@12345", role: "UNIT_USER", policeUnitId: "" }); }}>Cancel</Button>}
    </Stack></Paper>
    <DataTable rows={data} columns={[
      { key: "username", label: "Username" }, { key: "fullName", label: "Name" }, { key: "role", label: "Role" },
      { key: "policeUnit", label: "Unit", render: (r) => r.policeUnit?.name ?? "-" },
      { key: "isActive", label: "Status", render: (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
      { key: "actions", label: "Actions", render: (r) => <RowActions onEdit={() => edit(r)} onDelete={() => toggleStatus(r)} deleteDisabled={!r.isActive || r.id === user?.id} /> }
    ]} />
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
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [requestError, setRequestError] = useState<unknown>();
  const save = async () => {
    try {
      const body = tab === "police-units" ? unitForm :
        tab === "designations" ? { code: extra, name, rankOrder: editing?.rankOrder ?? designations.length + 1 } :
        { name };
      if (editing) await api.patch(`/${tab}/${editing.id}`, body);
      else await api.post(`/${tab}`, body);
      setName(""); setExtra(""); setUnitForm({ name: "", unitType: "POLICE_STATION", address: "", contactNumber: "" }); setEditing(null); await client.invalidateQueries({ queryKey: [tab] });
    } catch (e) { setRequestError(e); }
  };
  const edit = (row: AnyRow) => {
    setEditing(row);
    if (tab === "police-units") setUnitForm({ name: row.name, unitType: row.unitType, address: row.address ?? "", contactNumber: row.contactNumber ?? "" });
    else { setName(row.name); setExtra(tab === "designations" ? row.code : ""); }
  };
  const remove = async (row: AnyRow) => {
    if (!window.confirm(`Deactivate ${row.name}? Historical usage will be retained.`)) return;
    try { await api.delete(`/${tab}/${row.id}`); await client.invalidateQueries({ queryKey: [tab] }); }
    catch (e) { setRequestError(e); }
  };
  const cancelEdit = () => {
    setEditing(null); setName(""); setExtra(""); setUnitForm({ name: "", unitType: "POLICE_STATION", address: "", contactNumber: "" });
  };
  return <Page title="Master Data">
    <Stack direction="row" spacing={1}>{["police-units", "designations", "quarter-types", "areas", "eligibility-rules"].map((value) =>
      <Button key={value} variant={tab === value ? "contained" : "outlined"} onClick={() => { setTab(value); cancelEdit(); }}>{value === "police-units" ? "Police Units / Stations" : value.replaceAll("-", " ")}</Button>)}</Stack>
    <ErrorText error={error || requestError} />
    {tab === "police-units" && <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={650} mb={2}>{editing ? "Edit Police Unit / Station" : "Create Police Unit / Station"}</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Unit / Police Station Name" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, md: 2.5 }}><TextField fullWidth select label="Unit Type" value={unitForm.unitType} onChange={(e) => setUnitForm({ ...unitForm, unitType: e.target.value })}>
          {unitTypes.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
        </TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Address / Description" value={unitForm.address} onChange={(e) => setUnitForm({ ...unitForm, address: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, md: 2.5 }}><TextField fullWidth label="Contact Number" value={unitForm.contactNumber} onChange={(e) => setUnitForm({ ...unitForm, contactNumber: e.target.value })} /></Grid>
        <Grid size={{ xs: 12 }}><Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={save} disabled={!unitForm.name.trim()}>{editing ? "Update Unit" : "Create Unit"}</Button>
          {editing && <Button onClick={cancelEdit}>Cancel</Button>}
        </Stack></Grid>
      </Grid>
    </Paper>}
    {tab !== "eligibility-rules" && tab !== "police-units" && <Paper variant="outlined" sx={{ p: 2 }}><Stack direction="row" spacing={2}>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      {tab === "designations" && <TextField label="Code" value={extra} onChange={(e) => setExtra(e.target.value)} />}
      <Button variant="contained" onClick={save}>{editing ? "Update" : "Add"}</Button>
      {editing && <Button onClick={cancelEdit}>Cancel</Button>}
    </Stack></Paper>}
    {tab === "eligibility-rules" ? <EligibilityTable rows={data} types={types} designations={designations} /> : tab === "police-units" ?
      <DataTable rows={data} columns={[
        { key: "name", label: "Police Unit / Station" },
        { key: "unitType", label: "Unit Type", render: (r) => unitTypes.find((type) => type.value === r.unitType)?.label ?? r.unitType },
        { key: "address", label: "Address / Description" },
        { key: "contactNumber", label: "Contact" },
        { key: "isActive", label: "Status", render: (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
        { key: "actions", label: "Actions", render: (r) => <RowActions onEdit={() => edit(r)} onDelete={r.isActive ? () => remove(r) : undefined} /> }
      ]} /> :
      <DataTable rows={data} columns={[
        { key: "name", label: "Name" },
        { key: tab === "designations" ? "code" : "isActive", label: tab === "designations" ? "Code" : "Status", render: tab === "designations" ? undefined : (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
        { key: "actions", label: "Actions", render: (r) => <RowActions onEdit={() => edit(r)} onDelete={r.isActive ? () => remove(r) : undefined} /> }
      ]} />}
  </Page>;
}
function EligibilityTable({ rows }: { rows: AnyRow[]; types: AnyRow[]; designations: AnyRow[] }) {
  const client = useQueryClient();
  return <DataTable rows={rows} columns={[
    { key: "designation", label: "Designation", render: (r) => r.designation.code },
    { key: "quarterType", label: "Quarter Type", render: (r) => r.quarterType.name },
    { key: "isEligible", label: "Eligible", render: (r) => <Switch checked={r.isEligible} onChange={async (_, checked) => { await api.patch(`/eligibility-rules/${r.id}`, { isEligible: checked }); client.invalidateQueries({ queryKey: ["eligibility-rules"] }); }} /> },
    { key: "requiresSpecialApproval", label: "Special Approval", render: (r) => <Switch checked={r.requiresSpecialApproval} onChange={async (_, checked) => { await api.patch(`/eligibility-rules/${r.id}`, { requiresSpecialApproval: checked }); client.invalidateQueries({ queryKey: ["eligibility-rules"] }); }} /> }
  ]} />;
}

export function PersonnelPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { data = [], error } = useApi("personnel", "/personnel");
  const { data: units = [] } = useApi("units", "/police-units");
  const { data: designations = [] } = useApi("designations", "/designations");
  const [form, setForm] = useState({ indexNumber: "", buckleNumber: "", fullName: "", mobileNumber: "", designationId: "", currentPoliceUnitId: user?.policeUnitId ?? "", currentAddress: "" });
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [requestError, setRequestError] = useState<unknown>();
  const save = async () => {
    try {
      if (editing) await api.patch(`/personnel/${editing.id}`, form);
      else await api.post("/personnel", form);
      setEditing(null);
      setForm({ indexNumber: "", buckleNumber: "", fullName: "", mobileNumber: "", designationId: "", currentPoliceUnitId: user?.policeUnitId ?? "", currentAddress: "" });
      await client.invalidateQueries({ queryKey: ["personnel"] });
      await client.invalidateQueries({ queryKey: ["quarter-personnel"] });
    }
    catch (e) { setRequestError(e); }
  };
  const edit = (row: AnyRow) => {
    setEditing(row);
    setForm({
      indexNumber: row.indexNumber, buckleNumber: row.buckleNumber, fullName: row.fullName, mobileNumber: row.mobileNumber,
      designationId: row.designationId, currentPoliceUnitId: row.currentPoliceUnitId, currentAddress: row.currentAddress
    });
  };
  const remove = async (row: AnyRow) => {
    if (!window.confirm(`Deactivate personnel record for ${row.fullName}?`)) return;
    try { await api.delete(`/personnel/${row.id}`); await client.invalidateQueries({ queryKey: ["personnel"] }); }
    catch (e) { setRequestError(e); }
  };
  return <Page title="Personnel Records">
    <ErrorText error={error || requestError} />
    {(user?.role === "ADMIN" || user?.role === "UNIT_USER") && <Paper variant="outlined" sx={{ p: 2 }}><Grid container spacing={2}>
      {(["indexNumber", "buckleNumber", "fullName", "mobileNumber", "currentAddress"] as const).map((key) =>
        <Grid key={key} size={{ xs: 12, md: 4 }}><TextField fullWidth label={key.replaceAll(/([A-Z])/g, " $1")} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Grid>)}
      <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Designation" value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>{designations.map((d: AnyRow) => <MenuItem key={d.id} value={d.id}>{d.code}</MenuItem>)}</TextField></Grid>
      <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Posting" value={form.currentPoliceUnitId} onChange={(e) => setForm({ ...form, currentPoliceUnitId: e.target.value })}>{units.map((u: AnyRow) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}</TextField></Grid>
      <Grid size={{ xs: 12 }}><Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={save}>{editing ? "Update Personnel" : "Create Personnel"}</Button>
        {editing && <Button onClick={() => { setEditing(null); setForm({ indexNumber: "", buckleNumber: "", fullName: "", mobileNumber: "", designationId: "", currentPoliceUnitId: user?.policeUnitId ?? "", currentAddress: "" }); }}>Cancel</Button>}
      </Stack></Grid>
    </Grid></Paper>}
    <DataTable rows={data} columns={[
      { key: "indexNumber", label: "Index" }, { key: "buckleNumber", label: "Buckle" }, { key: "fullName", label: "Name" },
      { key: "designation", label: "Rank", render: (r) => r.designation.code }, { key: "currentPoliceUnit", label: "Posting", render: (r) => r.currentPoliceUnit.name },
      { key: "occupancies", label: "Current Quarter", render: (r) => r.occupancies[0]?.quarter.houseNumber ?? "-" },
      { key: "isActive", label: "Status", render: (r) => <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Active" : "Inactive"} /> },
      { key: "actions", label: "Actions", render: (r) => (user?.role === "ADMIN" || user?.role === "UNIT_USER") ? <RowActions onEdit={() => edit(r)} onDelete={user?.role === "ADMIN" && r.isActive ? () => remove(r) : undefined} /> : null }
    ]} />
  </Page>;
}

export function QuartersPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { data = [], error } = useApi("quarters", "/quarters");
  const { data: areas = [] } = useApi("areas", "/areas");
  const { data: types = [] } = useApi("quarter-types", "/quarter-types");
  const { data: personnel = [] } = useApi("quarter-personnel", "/personnel", user?.role === "ADMIN");
  const { data: requests = [] } = useApi("quarter-change-requests", "/quarter-change-requests", user?.role === "ADMIN" || user?.role === "CORRESPONDENCE_BRANCH");
  const editable = user?.role === "ADMIN" || user?.role === "CORRESPONDENCE_BRANCH";
  const [form, setForm] = useState({ areaId: "", quarterTypeId: "", houseNumber: "", wing: "", block: "", floor: "", status: "AVAILABLE" });
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [occupancy, setOccupancy] = useState({ personnelId: "", quarterId: "", allocatedDate: new Date().toISOString().slice(0, 10) });
  const [requestError, setRequestError] = useState<unknown>();
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["quarters"] }), client.invalidateQueries({ queryKey: ["quarter-change-requests"] })]);
  const save = async () => {
    try {
      if (editing) await api.patch(`/quarters/${editing.id}`, form);
      else await api.post("/quarters", form);
      setEditing(null);
      setForm({ areaId: "", quarterTypeId: "", houseNumber: "", wing: "", block: "", floor: "", status: "AVAILABLE" });
      await refresh();
    } catch (e) { setRequestError(e); }
  };
  const upload = async () => {
    if (!file) return;
    const payload = new FormData(); payload.append("file", file);
    try { await api.post("/quarters/bulk-upload", payload); await refresh(); } catch (e) { setRequestError(e); }
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
  return <Page title="Quarter Inventory">
    <ErrorText error={error || requestError} />
    {editable && <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} mb={2}>{editing ? "Edit Quarter" : "Add Quarter"} {user?.role === "CORRESPONDENCE_BRANCH" && "(requires Admin approval)"}</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Area" value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>{areas.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth select label="Type" value={form.quarterTypeId} onChange={(e) => setForm({ ...form, quarterTypeId: e.target.value })}>{types.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
        {(["houseNumber", "wing", "block", "floor"] as const).map((name) => <Grid key={name} size={{ xs: 6, md: 1.5 }}><TextField fullWidth label={name} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></Grid>)}
        <Grid size={{ xs: 12, md: 2 }}><Button fullWidth variant="contained" sx={{ height: 56 }} onClick={save}>{editing ? "Update" : "Add"}</Button></Grid>
        {editing && <Grid size={{ xs: 12, md: 2 }}><Button fullWidth sx={{ height: 56 }} onClick={() => { setEditing(null); setForm({ areaId: "", quarterTypeId: "", houseNumber: "", wing: "", block: "", floor: "", status: "AVAILABLE" }); }}>Cancel</Button></Grid>}
        <Grid size={{ xs: 12 }}><Divider /></Grid>
        <Grid size={{ xs: 12, md: 5 }}><Button component="label" variant="outlined">Select CSV/XLSX Import<input hidden type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Button> {file?.name}</Grid>
        <Grid size={{ xs: 12, md: 2 }}><Button variant="contained" disabled={!file} onClick={upload}>Import</Button></Grid>
      </Grid>
    </Paper>}
    {user?.role === "ADMIN" && <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} mb={2}>Record Existing Occupancy</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField select label="Personnel" value={occupancy.personnelId} onChange={(e) => setOccupancy({ ...occupancy, personnelId: e.target.value })} sx={{ minWidth: 230 }}>
          {personnel.map((p: AnyRow) => <MenuItem key={p.id} value={p.id}>{p.fullName} / {p.buckleNumber}</MenuItem>)}
        </TextField>
        <TextField select label="Available quarter" value={occupancy.quarterId} onChange={(e) => setOccupancy({ ...occupancy, quarterId: e.target.value })} sx={{ minWidth: 260 }}>
          {data.filter((q: AnyRow) => q.status === "AVAILABLE").map((q: AnyRow) => <MenuItem key={q.id} value={q.id}>{q.area.name} / {q.houseNumber}</MenuItem>)}
        </TextField>
        <TextField type="date" label="Allocated date" value={occupancy.allocatedDate} onChange={(e) => setOccupancy({ ...occupancy, allocatedDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="contained" onClick={addOccupancy} disabled={!occupancy.personnelId || !occupancy.quarterId}>Record</Button>
      </Stack>
    </Paper>}
    <DataTable rows={data} columns={[
      { key: "houseNumber", label: "House No." }, { key: "area", label: "Area", render: (r) => r.area.name },
      { key: "quarterType", label: "Type", render: (r) => r.quarterType.name },
      { key: "status", label: "Status", render: (r) => <Chip size="small" label={r.status} color={r.status === "AVAILABLE" ? "success" : r.status === "OCCUPIED" ? "primary" : "default"} /> },
      { key: "occupancies", label: "Resident", render: (r) => r.occupancies?.[0]?.personnel?.fullName ?? "-" },
      { key: "action", label: "Change Status", render: (r) => editable ? <TextField size="small" select disabled={!r.isActive} value={r.status === "OCCUPIED" ? "" : r.status} onChange={async (e) => {
        try { await api.patch(`/quarters/${r.id}/status`, { status: e.target.value, reason: "Updated through inventory screen" }); await refresh(); } catch (err) { setRequestError(err); }
      }}><MenuItem value="" disabled>Controlled occupancy</MenuItem>{statuses.filter((s) => s !== "OCCUPIED").map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField> : null },
      { key: "actions", label: "Actions", render: (r) => editable ? <RowActions onEdit={r.isActive ? () => edit(r) : undefined} onDelete={user?.role === "ADMIN" && r.isActive ? () => remove(r) : undefined} /> : null }
    ]} />
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
  const { data: applications = [], error } = useApi("applications", "/applications");
  const { data: personnel = [] } = useApi("personnel", "/personnel", user?.role === "UNIT_USER");
  const { data: areas = [] } = useApi("areas", "/areas", user?.role === "UNIT_USER");
  const { data: types = [] } = useApi("quarter-types", "/quarter-types", user?.role === "UNIT_USER");
  const { data: available = [] } = useApi("available-quarters", "/quarters/available", user?.role === "SUPER_ADMIN");
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [requestError, setRequestError] = useState<unknown>();
  const [form, setForm] = useState({ personnelId: "", areaId: "", quarterTypeId: "", areaId2: "", quarterTypeId2: "", areaId3: "", quarterTypeId3: "", isSpecialCase: false, specialCaseCategory: "MEDICAL", specialCaseReason: "", reasonForChange: "", applyingForGroup: false, groupDetails: "" });
  const [letter, setLetter] = useState<File | null>(null);
  const [support, setSupport] = useState<File | null>(null);
  const person = personnel.find((p: AnyRow) => p.id === form.personnelId);
  const hasQuarter = Boolean(person?.occupancies?.length);
  const applicationType = hasQuarter ? "TRANSFER_CHANGE" : "NEW_ALLOTMENT";
  const reload = async () => { await client.invalidateQueries({ queryKey: ["applications"] }); };
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
        applicationType, personnelId: form.personnelId, currentQuarterId: person?.occupancies?.[0]?.quarterId ?? null,
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
      await reload();
    } catch (e) { setRequestError(e); }
  };
  const decision = async (url: string, body: AnyRow = {}) => {
    try { await api.post(url, body); setSelected(null); await reload(); } catch (e) { setRequestError(e); }
  };
  return <Page title="Applications">
    <ErrorText error={error || requestError} />
    {user?.role === "UNIT_USER" && <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" mb={2}>New Application</Typography>
      {!personnel.length && <Alert severity="info" sx={{ mb: 2 }}>Create a personnel record first before submitting an application.</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Personnel" value={form.personnelId} onChange={(e) => setForm({ ...form, personnelId: e.target.value })}>{personnel.map((p: AnyRow) => <MenuItem key={p.id} value={p.id}>{p.fullName} / {p.buckleNumber}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="Application Type" value={applicationType} slotProps={{ input: { readOnly: true } }} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Preferred Area" value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>{areas.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Preferred Type" value={form.quarterTypeId} onChange={(e) => setForm({ ...form, quarterTypeId: e.target.value })}>{types.map((t: AnyRow) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Second Area (optional)" value={form.areaId2} onChange={(e) => setForm({ ...form, areaId2: e.target.value })}><MenuItem value="">None</MenuItem>{areas.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Second Type" value={form.quarterTypeId2} onChange={(e) => setForm({ ...form, quarterTypeId2: e.target.value })}><MenuItem value="">None</MenuItem>{types.map((t: AnyRow) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Third Area (optional)" value={form.areaId3} onChange={(e) => setForm({ ...form, areaId3: e.target.value })}><MenuItem value="">None</MenuItem>{areas.map((a: AnyRow) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Third Type" value={form.quarterTypeId3} onChange={(e) => setForm({ ...form, quarterTypeId3: e.target.value })}><MenuItem value="">None</MenuItem>{types.map((t: AnyRow) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField></Grid>
        {hasQuarter && <Grid size={{ xs: 12 }}><TextField fullWidth label="Reason for transfer/change" value={form.reasonForChange} onChange={(e) => setForm({ ...form, reasonForChange: e.target.value })} /></Grid>}
        <Grid size={{ xs: 12, md: 4 }}><FormControlLabel control={<Switch checked={form.applyingForGroup} onChange={(_, value) => setForm({ ...form, applyingForGroup: value })} />} label="Applying for group" /></Grid>
        {form.applyingForGroup && <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Group details" value={form.groupDetails} onChange={(e) => setForm({ ...form, groupDetails: e.target.value })} /></Grid>}
        <Grid size={{ xs: 12, md: 4 }}><FormControlLabel control={<Switch checked={form.isSpecialCase} onChange={(_, value) => setForm({ ...form, isSpecialCase: value })} />} label="Special case / urgency" /></Grid>
        {form.isSpecialCase && <>
          <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Urgency Category" value={form.specialCaseCategory} onChange={(e) => setForm({ ...form, specialCaseCategory: e.target.value })}>{["MEDICAL", "DISABILITY", "WIDOW_COMPASSIONATE", "DISTANCE_FROM_POSTING", "FAMILY_SAFETY", "OTHER"].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, md: 5 }}><TextField fullWidth label="Special case reason" value={form.specialCaseReason} onChange={(e) => setForm({ ...form, specialCaseReason: e.target.value })} /></Grid>
        </>}
        <Grid size={{ xs: 12, md: 4 }}><Button component="label" variant="outlined">Application Letter *<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setLetter(e.target.files?.[0] ?? null)} /></Button> {letter?.name}</Grid>
        {form.isSpecialCase && <Grid size={{ xs: 12, md: 4 }}><Button component="label" variant="outlined">Supporting Document *<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setSupport(e.target.files?.[0] ?? null)} /></Button> {support?.name}</Grid>}
        <Grid size={{ xs: 12 }}><Button variant="contained" onClick={submitApplication} disabled={!form.personnelId || !form.areaId || !form.quarterTypeId}>Create and Submit</Button></Grid>
      </Grid>
    </Paper>}
    <DataTable rows={applications} columns={[
      { key: "applicationNo", label: "Application No." }, { key: "personnel", label: "Personnel", render: (r) => r.personnel.fullName },
      { key: "applicationType", label: "Type" }, { key: "status", label: "Status", render: (r) => <Chip size="small" label={r.status} /> },
      { key: "isSpecialCase", label: "Special", render: (r) => r.isSpecialCase ? "Yes" : "No" },
      { key: "detail", label: "Action", render: (r) => <Button size="small" onClick={() => setSelected(r)}>View</Button> }
    ]} />
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
      <DialogTitle>{selected?.applicationNo}</DialogTitle>
      <DialogContent dividers>
        {selected && <Stack spacing={1}>
          <Typography><b>Personnel:</b> {selected.personnel.fullName} ({selected.personnel.designation.code})</Typography>
          <Typography><b>Status:</b> {selected.status}</Typography>
          <Typography><b>Preferences:</b> {selected.preferences.map((p: AnyRow) => `${p.area.name} / ${p.quarterType.name}`).join(", ")}</Typography>
          <Typography><b>Special case:</b> {selected.isSpecialCase ? `${selected.specialCaseCategory}: ${selected.specialCaseReason}` : "No"}</Typography>
          <Divider />
          <Typography fontWeight={600}>Attachments</Typography>
          {selected.attachments.map((a: AnyRow) => <Button key={a.id} startIcon={<DownloadIcon />} onClick={() => downloadFile(`/attachments/${a.id}/download`, a.originalFileName)}>{a.attachmentType}</Button>)}
          {user?.role === "SUPER_ADMIN" && selected.status === "APPROVED_PENDING_ALLOTMENT" && <AllotControl quarters={available} application={selected} action={decision} />}
        </Stack>}
      </DialogContent>
      <DialogActions>
        {selected && user?.role === "ADMIN" && (selected.status === "ADMIN_REVIEW" || selected.status === "DUPLICATE_REVIEW") && <>
          <Button onClick={() => decision(`/applications/${selected.id}/admin-review`, { action: "VERIFY" })}>{selected.status === "DUPLICATE_REVIEW" ? "Clear Duplicate" : "Verify"}</Button>
          <Button color="error" onClick={() => decision(`/applications/${selected.id}/admin-review`, { action: "REJECT" })}>Reject</Button>
        </>}
        {selected && user?.role === "CORRESPONDENCE_BRANCH" && selected.status === "CORRESPONDENCE_REVIEW" && <>
          <Button onClick={() => decision(`/applications/${selected.id}/correspondence-review`, { action: "VERIFY" })}>Verify</Button>
          <Button onClick={() => decision(`/applications/${selected.id}/correspondence-review`, { action: "RETURN" })}>Return</Button>
        </>}
        {selected && user?.role === "SUPER_ADMIN" && selected.status === "SUPER_ADMIN_REVIEW" && <>
          <Button onClick={() => decision(`/applications/${selected.id}/super-admin/approve-pending-allotment`)}>Approve Allotment</Button>
          <Button onClick={() => decision(`/applications/${selected.id}/super-admin/approve-waitlist`)}>Waitlist</Button>
          <Button color="error" onClick={() => decision(`/applications/${selected.id}/super-admin/reject`)}>Reject</Button>
        </>}
        {selected && user?.role === "UNIT_USER" && selected.status === "RETURNED_FOR_RECONSIDERATION" && <Button onClick={() => decision(`/applications/${selected.id}/resubmit`)}>Resubmit Corrected Application</Button>}
        {selected?.status === "CLOSED" && <Button onClick={() => downloadFile(`/applications/${selected.id}/allotment-order/pdf`, "allotment-order.pdf")}>Allotment Order</Button>}
        <Button onClick={() => setSelected(null)}>Close</Button>
      </DialogActions>
    </Dialog>
  </Page>;
}
function AllotControl({ quarters, application, action }: { quarters: AnyRow[]; application: AnyRow; action: (url: string, body: AnyRow) => Promise<void> }) {
  const [quarterId, setQuarterId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return <Stack direction="row" spacing={2} alignItems="center">
    <TextField select label="Available Quarter" value={quarterId} onChange={(e) => setQuarterId(e.target.value)} sx={{ minWidth: 300 }}>
      {quarters.map((q) => <MenuItem key={q.id} value={q.id}>{q.area.name} / {q.quarterType.name} / {q.houseNumber}</MenuItem>)}
    </TextField>
    <TextField type="date" label="Allotment Date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    <Button variant="contained" disabled={!quarterId} onClick={() => action(`/applications/${application.id}/super-admin/allot`, { quarterId, allotmentDate: date })}>Allot</Button>
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
      { key: "user", label: "User", render: (r) => r.user?.username ?? "System" }, { key: "ipAddress", label: "IP" }
    ]} />
  </Page>;
}

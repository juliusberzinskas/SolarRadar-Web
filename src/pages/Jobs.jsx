import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import PageHeader from "../components/PageHeader";
import FilterBar from "../components/FilterBar";

const JOB_TYPE_KEYS = [
  "inverter_fault",
  "communication",
  "string_issue",
  "inspection",
  "maintenance",
];

const EXPERTISE_KEYS = ["electrician", "inv_elect", "mount_spec", "panel_spec"];

function ExpertiseCheckboxes({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <FormGroup>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {t("pages.jobs.form.reqExpertise")}
      </Typography>
      {EXPERTISE_KEYS.map((key) => (
        <FormControlLabel
          key={key}
          control={
            <Checkbox
              size="small"
              checked={(value || []).includes(key)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...(value || []), key]
                  : (value || []).filter((k) => k !== key);
                onChange(next);
              }}
            />
          }
          label={t(`expertise.${key}`)}
        />
      ))}
    </FormGroup>
  );
}

async function getNextJobId() {
  const counterRef = doc(db, "counters", "jobs");
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const n = (snap.exists() ? snap.data().value : 0) + 1;
    tx.set(counterRef, { value: n });
    return n;
  });
  return `JB${String(next).padStart(2, "0")}`;
}

function StatusChip({ value }) {
  const { t } = useTranslation();
  const map = {
    open:        { key: "status.open",        color: "warning" },
    in_progress: { key: "status.in_progress", color: "info"    },
    resolved:    { key: "status.resolved",    color: "success" },
  };
  const m = map[value] || { key: value, color: "default" };
  return <Chip size="small" label={t(m.key, m.key)} color={m.color} variant="outlined" />;
}

function DeadlineCell({ value }) {
  const { t } = useTranslation();
  if (!value) return <Typography variant="body2" color="text.secondary">—</Typography>;

  const today = dayjs().startOf("day");
  const days = dayjs(value).diff(today, "day");

  let circleColor;
  if (days < 0)       circleColor = "#d32f2f";
  else if (days <= 6) circleColor = "#d32f2f";
  else if (days < 21) circleColor = "#f59e0b";
  else                circleColor = "#1976d2";

  const showExclamation = days <= 3;

  let label;
  if (days < 0)        label = t("pages.jobs.deadline.overdue");
  else if (days === 0) label = t("pages.jobs.deadline.today");
  else                 label = t("pages.jobs.deadline.days", { count: days });

  return (
    <Tooltip title={value}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: circleColor, flexShrink: 0 }} />
        {showExclamation && <WarningAmberIcon sx={{ fontSize: 14, color: circleColor }} />}
        <Typography variant="body2">{label}</Typography>
      </Box>
    </Tooltip>
  );
}

function ArchiveExpiryCell({ archivedAt }) {
  const { t } = useTranslation();
  if (!archivedAt) return <Typography variant="body2" color="text.secondary">—</Typography>;

  const d = archivedAt?.toDate ? archivedAt.toDate() : new Date(archivedAt);
  const daysLeft = dayjs(d).add(14, "day").diff(dayjs().startOf("day"), "day");

  const color = daysLeft <= 3 ? "error.main" : daysLeft <= 7 ? "warning.main" : "text.secondary";
  const label = daysLeft <= 0
    ? t("pages.jobs.archive.expiring")
    : t("pages.jobs.archive.expiresIn", { count: daysLeft });

  return <Typography variant="body2" color={color}>{label}</Typography>;
}

const emptyCreateForm = () => ({
  siteId: "",
  type: "inverter_fault",
  requiredExpertise: [],
  description: "",
  hasDeadline: false,
  deadline: null,
});

export default function Jobs() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDemo } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [sites, setSites] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [mainTab, setMainTab] = useState(0);

  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [assigned, setAssigned] = useState("all");

  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "jobs"),
      (snap) => {
        setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingJobs(false);
      },
      (err) => { console.error("Jobs error:", err); setLoadingJobs(false); }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "sites"),
      (snap) => setSites(snap.docs.map((d) => ({ id: d.id, name: d.data().name }))),
      (err) => console.error("Sites error:", err)
    );
    return () => unsub();
  }, []);


  const activeRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((r) => {
      if (r.archived) return false;
      const matchesSearch =
        !q ||
        (r.jobId || "").toLowerCase().includes(q) ||
        (r.siteName || "").toLowerCase().includes(q);
      const matchesSite   = siteFilter === "all" || r.siteId === siteFilter;
      const matchesStatus = status === "all"     || r.status === status;
      const matchesAssigned =
        assigned === "all"      ? true
        : assigned === "assigned" ? !!r.assignedTo
        : !r.assignedTo;
      return matchesSearch && matchesSite && matchesStatus && matchesAssigned;
    });
  }, [jobs, search, siteFilter, status, assigned]);

  const archiveRows = useMemo(() => jobs.filter((r) => r.archived === true), [jobs]);

  const activeColumns = useMemo(() => [
    {
      field: "_flag",
      headerName: "",
      width: 36,
      sortable: false,
      renderCell: (p) =>
        p.row.status === "resolved" ? (
          <Tooltip title={t("pages.jobs.resolvedHint")}>
            <PriorityHighIcon sx={{ fontSize: 18, color: "success.main" }} />
          </Tooltip>
        ) : null,
    },
    { field: "jobId", headerName: t("pages.jobs.col.jobId"), width: 90 },
    { field: "siteName", headerName: t("pages.jobs.col.site"), flex: 1, minWidth: 200, valueFormatter: (v) => v || "—" },
    { field: "type", headerName: t("pages.jobs.col.type"), width: 180, valueGetter: (v) => t(`jobType.${v}`, v || "—") },
    { field: "deadline", headerName: t("pages.jobs.col.deadline"), width: 150, renderCell: (p) => <DeadlineCell value={p.value} /> },
    { field: "status", headerName: t("pages.jobs.col.status"), width: 140, renderCell: (p) => <StatusChip value={p.value} />, sortable: false },
    { field: "assignedName", headerName: t("pages.jobs.col.assigned"), width: 160, valueFormatter: (v) => v || "—" },
    { field: "updatedAt", headerName: t("pages.jobs.col.updated"), width: 130, valueFormatter: (v) => v || "—" },
  ], [t]);

  const archiveColumns = useMemo(() => [
    { field: "jobId", headerName: t("pages.jobs.col.jobId"), width: 90 },
    { field: "siteName", headerName: t("pages.jobs.col.site"), flex: 1, minWidth: 200, valueFormatter: (v) => v || "—" },
    { field: "type", headerName: t("pages.jobs.col.type"), width: 180, valueGetter: (v) => t(`jobType.${v}`, v || "—") },
    {
      field: "archivedAt",
      headerName: t("pages.jobs.archive.col.archivedAt"),
      width: 150,
      valueFormatter: (v) => {
        if (!v) return "—";
        const d = v?.toDate ? v.toDate() : new Date(v);
        return dayjs(d).format("YYYY-MM-DD");
      },
    },
    {
      field: "_expiry",
      headerName: t("pages.jobs.archive.col.expiresIn"),
      width: 150,
      sortable: false,
      renderCell: (p) => <ArchiveExpiryCell archivedAt={p.row.archivedAt} />,
    },
  ], [t]);

  const onReset = () => {
    setSearch("");
    setSiteFilter("all");
    setStatus("all");
    setAssigned("all");
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    const site = sites.find((s) => s.id === createForm.siteId);
    try {
      const jobId = await getNextJobId();
      await addDoc(collection(db, "jobs"), {
        jobId,
        description:   createForm.description,
        siteId:        createForm.siteId || null,
        siteName:      site?.name || null,
        type:              createForm.type,
        requiredExpertise: createForm.requiredExpertise,
        deadline:
          createForm.hasDeadline && createForm.deadline
            ? dayjs(createForm.deadline).format("YYYY-MM-DD")
            : null,
        status:       "open",
        archived:     false,
        assignedTo:   null,
        assignedName: null,
        createdAt:    serverTimestamp(),
        updatedAt:    new Date().toISOString().slice(0, 10),
      });
      setOpenCreate(false);
      setCreateForm(emptyCreateForm());
    } catch (e) {
      console.error("Job create error:", e);
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title={t("pages.jobs.title")}
        subtitle={t("pages.jobs.subtitle")}
        primaryAction={isDemo ? undefined : {
          label: t("pages.jobs.create"),
          icon: <AddIcon />,
          onClick: () => { setCreateForm(emptyCreateForm()); setCreateError(""); setOpenCreate(true); },
        }}
      />

      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Tabs
          value={mainTab}
          onChange={(_, v) => setMainTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label={t("pages.jobs.tabs.active")} />
          <Tab label={t("pages.jobs.tabs.archive")} />
        </Tabs>

        {mainTab === 0 && (
          <Box sx={{ p: 2 }}>
            <FilterBar search={search} onSearchChange={setSearch} onReset={onReset}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>{t("pages.jobs.filter.site")}</InputLabel>
                <Select label={t("pages.jobs.filter.site")} value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                  <MenuItem value="all">{t("common.all")}</MenuItem>
                  {sites.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>{t("pages.jobs.filter.status")}</InputLabel>
                <Select label={t("pages.jobs.filter.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <MenuItem value="all">{t("common.all")}</MenuItem>
                  <MenuItem value="open">{t("status.open")}</MenuItem>
                  <MenuItem value="in_progress">{t("status.in_progress")}</MenuItem>
                  <MenuItem value="resolved">{t("status.resolved")}</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>{t("pages.jobs.filter.assignment")}</InputLabel>
                <Select label={t("pages.jobs.filter.assignment")} value={assigned} onChange={(e) => setAssigned(e.target.value)}>
                  <MenuItem value="all">{t("common.all")}</MenuItem>
                  <MenuItem value="assigned">{t("pages.jobs.filter.assigned")}</MenuItem>
                  <MenuItem value="unassigned">{t("pages.jobs.filter.unassigned")}</MenuItem>
                </Select>
              </FormControl>
            </FilterBar>

            <Box sx={{ height: 520 }}>
              <DataGrid
                rows={activeRows}
                columns={activeColumns}
                loading={loadingJobs}
                pageSizeOptions={[5, 10, 25]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10, page: 0 } },
                  sorting: { sortModel: [{ field: "updatedAt", sort: "desc" }] },
                }}
                onRowClick={(params) => navigate(`/jobs/${params.id}`)}
                sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
              />
            </Box>
          </Box>
        )}

        {mainTab === 1 && (
          <Box sx={{ p: 2, height: 560 }}>
            <DataGrid
              rows={archiveRows}
              columns={archiveColumns}
              loading={loadingJobs}
              pageSizeOptions={[5, 10, 25]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10, page: 0 } },
                sorting: { sortModel: [{ field: "archivedAt", sort: "desc" }] },
              }}
              onRowClick={(params) => navigate(`/jobs/${params.id}`)}
              sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
            />
          </Box>
        )}
      </Paper>

      {/* sukuria darbo dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("pages.jobs.dialog.title")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>{t("pages.jobs.form.site")}</InputLabel>
              <Select
                label={t("pages.jobs.form.site")}
                value={createForm.siteId}
                onChange={(e) => setCreateForm((p) => ({ ...p, siteId: e.target.value }))}
              >
                <MenuItem value="">{t("pages.jobs.form.noSite")}</MenuItem>
                {sites.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("pages.jobs.form.type")}</InputLabel>
              <Select
                label={t("pages.jobs.form.type")}
                value={createForm.type}
                onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}
              >
                {JOB_TYPE_KEYS.map((k) => (
                  <MenuItem key={k} value={k}>{t(`jobType.${k}`)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <ExpertiseCheckboxes
                value={createForm.requiredExpertise}
                onChange={(next) => setCreateForm((p) => ({ ...p, requiredExpertise: next }))}
              />
            </Paper>

            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={createForm.hasDeadline}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, hasDeadline: e.target.checked, deadline: null }))
                    }
                  />
                }
                label={t("pages.jobs.form.setDeadline")}
              />
              {createForm.hasDeadline && (
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label={t("pages.jobs.form.deadline")}
                    value={createForm.deadline ? dayjs(createForm.deadline) : null}
                    minDate={dayjs()}
                    onChange={(val) => setCreateForm((p) => ({ ...p, deadline: val }))}
                    slotProps={{ textField: { fullWidth: true, size: "small", sx: { mt: 1 } } }}
                  />
                </LocalizationProvider>
              )}
            </Box>

            <TextField
              label={t("pages.jobs.form.description")}
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />

            {createError && <Alert severity="error">{createError}</Alert>}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenCreate(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            {creating ? t("pages.jobs.creating") : t("pages.jobs.create")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

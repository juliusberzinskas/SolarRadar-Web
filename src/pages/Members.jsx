import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, storage, functions } from "../firebase";
import {
  Alert,
  Avatar,
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
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

import { DataGrid } from "@mui/x-data-grid";
import PageHeader from "../components/PageHeader";
import FilterBar from "../components/FilterBar";
import { useAuth } from "../contexts/AuthContext";

// ─── Expertise config ─────────────────────────────────────────────────────────
export const EXPERTISE_KEYS = ["electrician", "inv_elect", "mount_spec", "panel_spec"];

function getInitials(str) {
  if (!str) return "?";
  const parts = str.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : str.slice(0, 2).toUpperCase();
}

function yearsInCompany(hiredAt) {
  if (!hiredAt) return null;
  const years = dayjs().diff(dayjs(hiredAt), "year");
  return years < 1 ? "<1" : String(years);
}

function ActiveChip({ value }) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      label={value ? t("status.active") : t("status.inactive")}
      color={value ? "success" : "default"}
      variant="outlined"
    />
  );
}

function ExpertiseChips({ value }) {
  const { t } = useTranslation();
  const list = value || [];
  if (list.length === 0) return <Typography variant="body2" color="text.secondary">—</Typography>;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, alignItems: "center", py: 0.5 }}>
      {list.map((key) => (
        <Chip
          key={key}
          size="small"
          label={t(`expertise.short.${key}`, key)}
          variant="outlined"
          color="primary"
          sx={{ fontSize: "0.7rem", height: 20 }}
        />
      ))}
    </Box>
  );
}

function ExpertiseCheckboxes({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <FormGroup>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {t("pages.members.form.expertise")}
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

const emptyTechForm = () => ({
  displayName: "",
  email: "",
  active: true,
  hiredAt: dayjs(),
  expertise: [],
});

const emptyAdminForm = () => ({
  displayName: "",
  email: "",
  active: true,
});

const createAuthUser = httpsCallable(functions, "createAuthUser");
const deleteAuthUserFn = httpsCallable(functions, "deleteAuthUser");

// Returns next sequential member ID like SR01, SR02, SR03 ...
async function getNextMemberId() {
  const snap = await getDocs(collection(db, "users"));
  const nums = snap.docs
    .map((d) => d.data().memberId)
    .filter((id) => /^SR\d+$/.test(id))
    .map((id) => parseInt(id.slice(2), 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `SR${String(next).padStart(2, "0")}`;
}

// ─── Technicians tab ──────────────────────────────────────────────────────────

function TechniciansTab() {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const [members, setMembers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [minYears, setMinYears] = useState("all");

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyTechForm());
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [openDelete, setOpenDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "technician"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingData(false);
      },
      (err) => {
        console.error("Members listener error:", err);
        setLoadingData(false);
      }
    );
    return () => unsub();
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        (m.displayName || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q);
      const matchesActive =
        activeFilter === "all" ? true : activeFilter === "active" ? m.active : !m.active;
      const yearsStr = yearsInCompany(m.hiredAt);
      const yearsNum = yearsStr === "<1" ? 0 : Number(yearsStr ?? 0);
      const matchesMinYears = minYears === "all" ? true : yearsNum >= Number(minYears);
      return matchesSearch && matchesActive && matchesMinYears;
    });
  }, [members, search, activeFilter, minYears]);

  const columns = useMemo(
    () => [
      { field: "memberId", headerName: t("pages.members.col.id"), width: 90, renderCell: (p) => <b>{p.value ?? "—"}</b> },
      {
        field: "photoUrl",
        headerName: "",
        width: 72,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <Avatar
            src={p.row.photoUrl || undefined}
            sx={{ width: 48, height: 48, bgcolor: "#3b82f6", fontSize: "1rem" }}
          >
            {!p.row.photoUrl && getInitials(p.row.displayName || p.row.email)}
          </Avatar>
        ),
      },
      { field: "displayName", headerName: t("pages.members.col.name"), width: 200 },
      { field: "email", headerName: t("pages.members.col.email"), width: 200 },
      {
        field: "expertise",
        headerName: t("pages.members.col.expertise"),
        flex: 1,
        minWidth: 260,
        sortable: false,
        renderCell: (p) => <ExpertiseChips value={p.value} />,
      },
      {
        field: "active",
        headerName: t("pages.members.col.status"),
        width: 120,
        renderCell: (p) => <ActiveChip value={p.value} />,
        sortable: false,
      },
      { field: "hiredAt", headerName: t("pages.members.col.hiredAt"), width: 120 },
      {
        field: "years",
        headerName: t("pages.members.col.tenure"),
        width: 100,
        sortable: false,
        renderCell: (params) => {
          const y = yearsInCompany(params.row.hiredAt);
          return (
            <Chip
              size="small"
              label={y === "<1" ? "<1 m." : y ? `${y} m.` : "—"}
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          );
        },
      },
      {
        field: "actions",
        headerName: "",
        width: 60,
        sortable: false,
        filterable: false,
        renderCell: (p) => isDemo ? null : (
          <IconButton
            size="small"
            onClick={() => {
              setEditingRow(p.row);
              setForm({
                displayName: p.row.displayName ?? "",
                email: p.row.email ?? "",
                active: !!p.row.active,
                hiredAt: p.row.hiredAt ? dayjs(p.row.hiredAt) : dayjs(),
                expertise: p.row.expertise || [],
              });
              setSaveError("");
              setOpenEdit(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [t, isDemo]
  );

  const handleCreate = async () => {
    setSaveError("");
    setSaving(true);
    try {
      const { data } = await createAuthUser({ email: form.email });

      await sendPasswordResetEmail(auth, form.email);

      const memberId = await getNextMemberId();
      await setDoc(doc(db, "users", data.uid), {
        role:        "technician",
        memberId,
        displayName: form.displayName,
        email:       form.email,
        active:      form.active,
        hiredAt:     form.hiredAt ? form.hiredAt.format("YYYY-MM-DD") : null,
        expertise:   form.expertise,
        createdAt:   serverTimestamp(),
      });

      setOpenCreate(false);
      setSuccessMsg(t("pages.members.successCreate", { email: form.email }));
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setSaveError("");
    try {
      await updateDoc(doc(db, "users", editingRow.id), {
        displayName: form.displayName,
        email:       form.email,
        active:      form.active,
        hiredAt:     form.hiredAt ? form.hiredAt.format("YYYY-MM-DD") : null,
        expertise:   form.expertise,
      });
      setOpenEdit(false);
    } catch (e) {
      setSaveError(e.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete Firestore profile
      await deleteDoc(doc(db, "users", editingRow.id));

      await deleteAuthUserFn({ uid: editingRow.id });

      setOpenDelete(false);
      setOpenEdit(false);
      setDeleteConfirmText("");
      setEditingRow(null);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file || !editingRow) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Only image files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Image must be under 5 MB.");
      return;
    }
    setPhotoUploading(true);
    setPhotoUploadProgress(0);
    setSaveError("");
    try {
      const storageRef = ref(storage, `technicians/${editingRow.id}/photo`);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => setPhotoUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve
        );
      });
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", editingRow.id), { photoUrl: url });
      setEditingRow((prev) => ({ ...prev, photoUrl: url }));
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setPhotoUploading(false);
      setPhotoUploadProgress(0);
    }
  };

  return (
    <>
      <Box sx={{ mt: 2 }}>
        {!isDemo && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setForm(emptyTechForm()); setSaveError(""); setOpenCreate(true); }}
            >
              {t("pages.members.addTech")}
            </Button>
          </Box>
        )}

        <FilterBar search={search} onSearchChange={setSearch} onReset={() => { setSearch(""); setActiveFilter("all"); setMinYears("all"); }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t("pages.members.col.status")}</InputLabel>
            <Select label={t("pages.members.col.status")} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <MenuItem value="all">{t("common.all")}</MenuItem>
              <MenuItem value="active">{t("status.active")}</MenuItem>
              <MenuItem value="inactive">{t("status.inactive")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t("pages.members.filter.minYears")}</InputLabel>
            <Select label={t("pages.members.filter.minYears")} value={minYears} onChange={(e) => setMinYears(e.target.value)}>
              <MenuItem value="all">{t("common.all")}</MenuItem>
              <MenuItem value="0">0+</MenuItem>
              <MenuItem value="1">1+</MenuItem>
              <MenuItem value="3">3+</MenuItem>
              <MenuItem value="5">5+</MenuItem>
              <MenuItem value="10">10+</MenuItem>
            </Select>
          </FormControl>
        </FilterBar>

        <Paper sx={{ borderRadius: 2 }} variant="outlined">
          <Box sx={{ width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loadingData}
              pageSizeOptions={[5, 10, 25]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
              getRowHeight={() => 72}
              sx={{
                "& .MuiDataGrid-cell": { alignItems: "center", display: "flex" },
                "& .MuiDataGrid-row": { py: 0.5 },
              }}
              disableRowSelectionOnClick
            />
          </Box>
        </Paper>
      </Box>

      {/* Create dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("pages.members.dialog.createTech")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("pages.members.form.name")}
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              fullWidth
            />
            <TextField
              label={t("pages.members.form.email")}
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
            />
            <DatePicker
              label={t("pages.members.form.hiredAt")}
              value={form.hiredAt}
              onChange={(v) => setForm((p) => ({ ...p, hiredAt: v }))}
              slotProps={{ textField: { fullWidth: true } }}
            />

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <ExpertiseCheckboxes
                value={form.expertise}
                onChange={(next) => setForm((p) => ({ ...p, expertise: next }))}
              />
            </Paper>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>{t("pages.members.col.status")}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {form.active ? t("pages.members.form.active") : t("pages.members.form.inactive")}
                </Typography>
                <Switch checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
              </Stack>
            </Stack>

            {saveError && <Alert severity="error">{saveError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenCreate(false)} disabled={saving}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? t("pages.members.creating") : t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("pages.members.dialog.editTech")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t("pages.members.dialog.idLabel")}<b>{editingRow?.memberId ?? editingRow?.id}</b>
            </Typography>

            {/* Profile photo upload */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar
                src={editingRow?.photoUrl || undefined}
                sx={{ width: 72, height: 72, bgcolor: "#3b82f6", fontSize: "1.6rem" }}
              >
                {!editingRow?.photoUrl && getInitials(form.displayName || editingRow?.email)}
              </Avatar>
              <Box>
                <input
                  accept="image/*"
                  style={{ display: "none" }}
                  id="tech-photo-upload"
                  type="file"
                  onChange={(e) => handlePhotoUpload(e.target.files[0])}
                />
                <Tooltip title={t("pages.members.form.photoTooltip")}>
                  <label htmlFor="tech-photo-upload">
                    <Button
                      component="span"
                      variant="outlined"
                      size="small"
                      startIcon={<PhotoCameraIcon />}
                      disabled={photoUploading}
                    >
                      {t("pages.members.form.uploadPhoto")}
                    </Button>
                  </label>
                </Tooltip>
                {photoUploading && (
                  <LinearProgress
                    variant="determinate"
                    value={photoUploadProgress}
                    sx={{ mt: 1, width: 180, borderRadius: 1 }}
                  />
                )}
              </Box>
            </Box>
            <TextField
              label={t("pages.members.form.name")}
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              fullWidth
            />
            <TextField
              label={t("pages.members.form.email")}
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
            />
            <DatePicker
              label={t("pages.members.form.hiredAt")}
              value={form.hiredAt}
              onChange={(v) => setForm((p) => ({ ...p, hiredAt: v }))}
              slotProps={{ textField: { fullWidth: true } }}
            />

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <ExpertiseCheckboxes
                value={form.expertise}
                onChange={(next) => setForm((p) => ({ ...p, expertise: next }))}
              />
            </Paper>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>{t("pages.members.col.status")}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {form.active ? t("pages.members.form.active") : t("pages.members.form.inactive")}
                </Typography>
                <Switch checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
              </Stack>
            </Stack>

            {saveError && <Alert severity="error">{saveError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            color="error"
            onClick={() => { setDeleteConfirmText(""); setOpenDelete(true); }}
            sx={{ mr: "auto" }}
          >
            Delete
          </Button>
          <Button onClick={() => setOpenEdit(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleUpdate}>{t("pages.members.update")}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: "error.main" }}>Delete technician?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will permanently delete <b>{editingRow?.displayName || editingRow?.email}</b> and their login account. This cannot be undone.
          </Alert>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Type <b>Delete</b> to confirm:
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Delete"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            autoComplete="off"
          />
          {saveError && <Alert severity="error" sx={{ mt: 1 }}>{saveError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDelete(false)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteConfirmText !== "Delete" || deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMsg}
        autoHideDuration={6000}
        onClose={() => setSuccessMsg("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSuccessMsg("")} sx={{ width: "100%" }}>
          {successMsg}
        </Alert>
      </Snackbar>
    </>
  );
}

// ─── Administrators tab (superadmin only) ─────────────────────────────────────

function AdminsTab() {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState(emptyAdminForm());
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "admin"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setAdmins(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingData(false);
      },
      (err) => {
        console.error("Admins listener error:", err);
        setLoadingData(false);
      }
    );
    return () => unsub();
  }, []);

  const columns = useMemo(
    () => [
      { field: "memberId", headerName: t("pages.members.col.id"), width: 90, renderCell: (p) => <b>{p.value ?? "—"}</b> },
      { field: "displayName", headerName: t("pages.members.col.name"), flex: 1, minWidth: 220 },
      { field: "email", headerName: t("pages.members.col.email"), width: 240 },
      {
        field: "active",
        headerName: t("pages.members.col.status"),
        width: 130,
        renderCell: (p) => <ActiveChip value={p.value} />,
        sortable: false,
      },
    ],
    [t]
  );

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleCreate = async () => {
    setSaveError("");
    setSaving(true);
    try {
      const { data } = await createAuthUser({ email: form.email });

      await sendPasswordResetEmail(auth, form.email);

      await setDoc(doc(db, "users", data.uid), {
        role:        "admin",
        displayName: form.displayName,
        email:       form.email,
        active:      form.active,
        createdAt:   serverTimestamp(),
      });

      setOpenCreate(false);
      setSuccessMsg(t("pages.members.successCreate", { email: form.email }));
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box sx={{ mt: 2 }}>
        {!isDemo && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setForm(emptyAdminForm()); setSaveError(""); setOpenCreate(true); }}
            >
              {t("pages.members.addAdmin")}
            </Button>
          </Box>
        )}

        <Paper sx={{ borderRadius: 2 }} variant="outlined">
          <Box sx={{ height: 520, width: "100%" }}>
            <DataGrid
              rows={admins}
              columns={columns}
              loading={loadingData}
              pageSizeOptions={[5, 10, 25]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
              disableRowSelectionOnClick
            />
          </Box>
        </Paper>
      </Box>

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("pages.members.dialog.createAdmin")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("pages.members.form.name")}
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              fullWidth
            />
            <TextField
              label={t("pages.members.form.email")}
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
            />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>{t("pages.members.col.status")}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {form.active ? t("pages.members.form.active") : t("pages.members.form.inactive")}
                </Typography>
                <Switch checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
              </Stack>
            </Stack>
            {saveError && <Alert severity="error">{saveError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenCreate(false)} disabled={saving}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? t("pages.members.creating") : t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMsg}
        autoHideDuration={6000}
        onClose={() => setSuccessMsg("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSuccessMsg("")} sx={{ width: "100%" }}>
          {successMsg}
        </Alert>
      </Snackbar>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Members() {
  const { isSuperAdmin } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <PageHeader
          title={t("pages.members.title")}
          subtitle={t("pages.members.subtitle")}
        />

        {isSuperAdmin && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1, borderBottom: 1, borderColor: "divider" }}>
            <Tab label={t("pages.members.tabs.technicians")} />
            <Tab label={t("pages.members.tabs.admins")} />
          </Tabs>
        )}

        {tab === 0 && <TechniciansTab />}
        {tab === 1 && isSuperAdmin && <AdminsTab />}
      </Box>
    </LocalizationProvider>
  );
}

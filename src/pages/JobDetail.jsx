import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  listAll,
  getDownloadURL,
  getMetadata,
  uploadBytesResumable,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ArchiveIcon from "@mui/icons-material/Archive";
import { useAuth } from "../contexts/AuthContext";

dayjs.extend(relativeTime);

const JOB_TYPE_KEYS = ["inverter_fault", "communication", "string_issue", "inspection", "maintenance"];
const EXPERTISE_KEYS = ["electrician", "inv_elect", "mount_spec", "panel_spec"];

function ExpertiseCheckboxes({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <FormGroup row>
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

function formatDate(val) {
  if (!val) return "—";
  try {
    const d = typeof val.toDate === "function" ? val.toDate() : new Date(val);
    return dayjs(d).format("YYYY-MM-DD HH:mm");
  } catch { return "—"; }
}

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

function InfoTab({ job, jobId }) {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const [technicians, setTechnicians] = useState([]);
  const [form, setForm] = useState({
    status:            job.status,
    assignedTo:        job.assignedTo ?? "",
    type:              job.type || "inverter_fault",
    requiredExpertise: job.requiredExpertise || [],
    description:       job.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("role", "==", "technician"), where("active", "==", true)))
      .then((snap) =>
        setTechnicians(snap.docs.map((d) => ({ uid: d.id, displayName: d.data().displayName || d.id })))
      )
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const tech = technicians.find((tc) => tc.uid === form.assignedTo);
      await updateDoc(doc(db, "jobs", jobId), {
        status:            form.status,
        assignedTo:        form.assignedTo || null,
        assignedName:      tech?.displayName || null,
        type:              form.type,
        requiredExpertise: form.requiredExpertise,
        description:       form.description,
        updatedAt:         new Date().toISOString().slice(0, 10),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography fontWeight={700} sx={{ mb: 2 }}>{t("pages.jobDetail.info.sectionTitle")}</Typography>
        <Stack spacing={1.2}>
          {job.title && (
            <Stack direction="row" spacing={1}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>{t("pages.jobDetail.info.name")}</Typography>
              <Typography variant="body2" fontWeight={600}>{job.title}</Typography>
            </Stack>
          )}
          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>{t("pages.jobDetail.info.site")}</Typography>
            <Typography variant="body2">{job.siteName || "—"}</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>{t("pages.jobDetail.info.type")}</Typography>
            <Typography variant="body2">{t(`jobType.${job.type}`, job.type || "—")}</Typography>
          </Stack>
          {(job.requiredExpertise?.length > 0 || job.requiredLevel) && (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>{t("pages.jobDetail.info.reqExpertise")}</Typography>
              {job.requiredExpertise?.length > 0 ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {job.requiredExpertise.map((key) => (
                    <Chip key={key} size="small" label={t(`expertise.short.${key}`, key)} variant="outlined" color="primary" sx={{ fontSize: "0.7rem", height: 20 }} />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2">L{job.requiredLevel}</Typography>
              )}
            </Stack>
          )}
          {job.deadline && (
            <Stack direction="row" spacing={1}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>{t("pages.jobDetail.info.deadline")}</Typography>
              <Typography variant="body2">{job.deadline}</Typography>
            </Stack>
          )}
          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>{t("pages.jobDetail.info.created")}</Typography>
            <Typography variant="body2">{formatDate(job.createdAt)}</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>{t("pages.jobDetail.info.updated")}</Typography>
            <Typography variant="body2">{formatDate(job.updatedAt)}</Typography>
          </Stack>
          {job.description && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" spacing={1}>
                <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>{t("pages.jobDetail.info.description")}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{job.description}</Typography>
              </Stack>
            </>
          )}
        </Stack>
      </Paper>

      {!job.archived && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 2 }}>{t("pages.jobDetail.update.sectionTitle")}</Typography>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>{t("pages.jobDetail.update.status")}</InputLabel>
              <Select label={t("pages.jobDetail.update.status")} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <MenuItem value="open">{t("status.open")}</MenuItem>
                <MenuItem value="in_progress">{t("status.in_progress")}</MenuItem>
                <MenuItem value="resolved">{t("status.resolved")}</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("pages.jobDetail.update.assignedTech")}</InputLabel>
              <Select label={t("pages.jobDetail.update.assignedTech")} value={form.assignedTo} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))}>
                <MenuItem value="">{t("pages.jobDetail.update.unassigned")}</MenuItem>
                {technicians.map((tc) => (
                  <MenuItem key={tc.uid} value={tc.uid}>{tc.displayName}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t("pages.jobDetail.update.type")}</InputLabel>
              <Select label={t("pages.jobDetail.update.type")} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                {JOB_TYPE_KEYS.map((k) => (
                  <MenuItem key={k} value={k}>{t(`jobType.${k}`)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                {t("pages.jobDetail.update.reqExpertise")}
              </Typography>
              <ExpertiseCheckboxes
                value={form.requiredExpertise}
                onChange={(next) => setForm((p) => ({ ...p, requiredExpertise: next }))}
              />
            </Box>

            <TextField
              label={t("pages.jobDetail.update.description")}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />

            {saveError && <Alert severity="error">{saveError}</Alert>}
            {saved && <Alert severity="success">{t("common.savedOk")}</Alert>}

            {!isDemo && (
              <Box>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? t("common.saving") : t("common.saveChanges")}
                </Button>
              </Box>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function AttachmentsTab({ jobId }) {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const storageRef = ref(storage, `jobs/${jobId}/attachments`);
      const result = await listAll(storageRef);
      const items = await Promise.all(
        result.items.map(async (item) => {
          const [url, meta] = await Promise.all([getDownloadURL(item), getMetadata(item)]);
          return { name: item.name, url, size: meta.size, contentType: meta.contentType, ref: item };
        })
      );
      setFiles(items);
    } catch (e) {
      console.error("Error loading attachments:", e);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => { loadFiles(); }, [jobId]);

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    setUploading(true);
    setUploadError("");
    setUploadProgress(0);

    try {
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        const storageRef = ref(storage, `jobs/${jobId}/attachments/${Date.now()}_${file.name}`);
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round(((i + snap.bytesTransferred / snap.totalBytes) / selected.length) * 100);
              setUploadProgress(pct);
            },
            reject,
            resolve
          );
        });
      }
      await loadFiles();
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleDelete = async (file) => {
    try {
      await deleteObject(file.ref);
      setFiles((prev) => prev.filter((f) => f.name !== file.name));
    } catch (e) {
      console.error("Error deleting attachment:", e);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const isImage = (contentType) => contentType?.startsWith("image/");

  const countLabel = files.length === 1
    ? `1 ${t("pages.jobDetail.attachments.countSingular")}`
    : `${files.length} ${t("pages.jobDetail.attachments.countPlural")}`;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">{countLabel}</Typography>
        {!isDemo && (
          <>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {t("pages.jobDetail.attachments.upload")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xlsx,.csv"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </>
        )}
      </Stack>

      {uploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" color="text.secondary">
            {t("pages.jobDetail.attachments.uploading", { pct: uploadProgress })}
          </Typography>
        </Box>
      )}

      {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}

      {loadingFiles ? (
        <Stack spacing={1}>
          {[...Array(3)].map((_, i) => <Skeleton key={i} height={56} />)}
        </Stack>
      ) : files.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center" }}>
          <Typography color="text.secondary">{t("pages.jobDetail.attachments.none")}</Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {files.map((file) => (
            <Paper
              key={file.name}
              variant="outlined"
              sx={{ p: 1.5, borderRadius: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}
            >
              {isImage(file.contentType) && (
                <Box
                  component="img"
                  src={file.url}
                  alt={file.name}
                  sx={{ width: 48, height: 48, objectFit: "cover", borderRadius: 1, flexShrink: 0 }}
                />
              )}
              <Box sx={{ flex: 1, overflow: "hidden" }}>
                <Typography variant="body2" fontWeight={600} noWrap>{file.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {file.contentType} · {formatSize(file.size)}
                </Typography>
              </Box>
              <Tooltip title={t("pages.jobDetail.attachments.download")}>
                <IconButton size="small" component={Link} href={file.url} target="_blank" rel="noopener">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {!isDemo && (
                <Tooltip title={t("pages.jobDetail.attachments.delete")}>
                  <IconButton size="small" onClick={() => handleDelete(file)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "jobs", jobId),
      (snap) => {
        setJob(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("JobDetail error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [jobId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "jobs", jobId));
      navigate("/jobs");
    } catch (e) {
      console.error("Delete error:", e);
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await updateDoc(doc(db, "jobs", jobId), {
        archived:   true,
        archivedAt: serverTimestamp(),
      });
      setArchiveOpen(false);
      navigate("/jobs");
    } catch (e) {
      console.error("Archive error:", e);
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton width={200} height={40} sx={{ mb: 2 }} />
        <Skeleton height={300} />
      </Box>
    );
  }

  if (!job) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/jobs")}>
          {t("pages.jobDetail.backBtn")}
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>{t("pages.jobDetail.notFound")}</Alert>
      </Box>
    );
  }

  // prijungia prie info pasibaigimo datos
  let archiveExpiryLabel = null;
  if (job.archived && job.archivedAt) {
    const d = job.archivedAt?.toDate ? job.archivedAt.toDate() : new Date(job.archivedAt);
    const daysLeft = dayjs(d).add(14, "day").diff(dayjs().startOf("day"), "day");
    archiveExpiryLabel = daysLeft <= 0
      ? t("pages.jobDetail.archive.expiringSoon")
      : t("pages.jobDetail.archive.expiresIn", { count: daysLeft });
  }

  const displayTitle = job.jobId || job.title || t("pages.jobDetail.backBtn");

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }} flexWrap="wrap">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/jobs")}
          sx={{ flexShrink: 0 }}
        >
          {t("pages.jobDetail.backBtn")}
        </Button>

        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }} noWrap>
          {displayTitle}
        </Typography>

        <StatusChip value={job.status} />

        {!isDemo && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverIcon />}
            size="small"
            onClick={() => setDeleteOpen(true)}
          >
            {t("common.delete")}
          </Button>
        )}

        {job.archived ? (
          <Tooltip title={archiveExpiryLabel}>
            <Chip
              icon={<ArchiveIcon />}
              label={t("pages.jobDetail.archive.chip")}
              color="default"
              size="small"
            />
          </Tooltip>
        ) : job.status === "resolved" && !isDemo ? (
          <Button
            variant="outlined"
            color="success"
            startIcon={<ArchiveIcon />}
            size="small"
            onClick={() => setArchiveOpen(true)}
          >
            {t("pages.jobDetail.archive.button")}
          </Button>
        ) : null}
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label={t("pages.jobDetail.tabs.info")} />
          <Tab label={t("pages.jobDetail.tabs.attachments")} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tab} index={0}>
            <InfoTab job={job} jobId={jobId} />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <AttachmentsTab jobId={jobId} />
          </TabPanel>
        </Box>
      </Paper>

      {/* visam istrina pativirtinimo dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: "error.main" }}>{t("pages.jobDetail.delete.confirmTitle")}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1 }}>
            {t("pages.jobDetail.delete.confirmDesc")}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
            onClick={handleDelete}
            disabled={deleting}
          >
            {t("pages.jobDetail.delete.proceed")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* patvirtinimo info dialog */}
      <Dialog open={archiveOpen} onClose={() => setArchiveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("pages.jobDetail.archive.confirmTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{t("pages.jobDetail.archive.confirmDesc")}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setArchiveOpen(false)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"s
            color="success"
            startIcon={archiving ? <CircularProgress size={16} color="inherit" /> : <ArchiveIcon />}
            onClick={handleArchive}
            disabled={archiving}
          >
            {t("pages.jobDetail.archive.proceed")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

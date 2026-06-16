import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/lt";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import BuildIcon from "@mui/icons-material/Build";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

dayjs.locale("lt");

function StatusChip({ value }) {
  const { t } = useTranslation();
  const STATUS_CFG = {
    completed:            { key: "status.completed",            color: "success", icon: <CheckCircleIcon fontSize="small" /> },
    not_completed:        { key: "status.not_completed",        color: "error",   icon: <CancelIcon fontSize="small" /> },
    requires_maintenance: { key: "status.requires_maintenance", color: "warning", icon: <BuildIcon fontSize="small" /> },
  };
  const cfg = STATUS_CFG[value] || { key: value || "—", color: "default", icon: null };
  return (
    <Chip
      size="small"
      label={t(cfg.key, cfg.key)}
      color={cfg.color}
      icon={cfg.icon}
      variant="outlined"
    />
  );
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

function InfoTab({ report, reportId }) {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const [adminNotes, setAdminNotes] = useState(report.adminNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await updateDoc(doc(db, "reports", reportId), { adminNotes });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ label, value }) => (
    <Stack direction="row" spacing={1} sx={{ py: 0.8 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 180, flexShrink: 0, pt: 0.1 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1 }}>{value || "—"}</Typography>
    </Stack>
  );

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography fontWeight={700} sx={{ mb: 1.5 }}>{t("pages.reportDetail.info.sectionTitle")}</Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack>
          <Row label={t("pages.reportDetail.info.technician")} value={report.technicianName} />
          <Divider sx={{ opacity: 0.4 }} />
          <Row label={t("pages.reportDetail.info.job")} value={report.jobTitle} />
          <Divider sx={{ opacity: 0.4 }} />
          <Row label={t("pages.reportDetail.info.site")} value={report.siteName} />
          <Divider sx={{ opacity: 0.4 }} />
          <Stack direction="row" spacing={1} sx={{ py: 0.8 }}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 180, flexShrink: 0, pt: 0.1 }}>
              {t("pages.reportDetail.info.status")}
            </Typography>
            <StatusChip value={report.status} />
          </Stack>
          <Divider sx={{ opacity: 0.4 }} />
          <Row label={t("pages.reportDetail.info.submitted")} value={formatDate(report.submittedAt)} />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography fontWeight={700} sx={{ mb: 1.5 }}>{t("pages.reportDetail.techNotes.title")}</Typography>
        <Divider sx={{ mb: 2 }} />
        {report.notes ? (
          <Typography
            variant="body2"
            sx={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.75,
              backgroundColor: "grey.50",
              p: 2,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {report.notes}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            {t("pages.reportDetail.techNotes.empty")}
          </Typography>
        )}
      </Paper>

      {!isDemo && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 0.5 }}>{t("pages.reportDetail.adminNotes.title")}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            {t("pages.reportDetail.adminNotes.hint")}
          </Typography>
          <TextField
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            placeholder={t("pages.reportDetail.adminNotes.placeholder")}
          />
          {saveError && <Alert severity="error" sx={{ mt: 1.5 }}>{saveError}</Alert>}
          {saved && <Alert severity="success" sx={{ mt: 1.5 }}>{t("common.savedOk")}</Alert>}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t("common.saving") : t("pages.reportDetail.adminNotes.save")}
            </Button>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}

function PhotosTab({ report }) {
  const { t } = useTranslation();
  const photoUrls = Array.isArray(report.photoUrls) ? report.photoUrls : [];

  if (photoUrls.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 5, borderRadius: 2, textAlign: "center" }}>
        <Typography color="text.secondary" sx={{ mb: 0.5 }}>
          {t("pages.reportDetail.photos.none")}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t("pages.reportDetail.photos.hint")}
        </Typography>
      </Paper>
    );
  }

  const countLabel = photoUrls.length === 1
    ? `1 ${t("pages.reportDetail.photos.countSingular")}`
    : `${photoUrls.length} ${t("pages.reportDetail.photos.countPlural")}`;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {countLabel}
      </Typography>
      <ImageList cols={3} gap={12}>
        {photoUrls.map((url, idx) => (
          <ImageListItem key={idx} sx={{ borderRadius: 1.5, overflow: "hidden" }}>
            <img
              src={url}
              alt={t("pages.reportDetail.photos.label", { n: idx + 1 })}
              loading="lazy"
              style={{ height: 220, objectFit: "cover", width: "100%" }}
            />
            <ImageListItemBar
              actionIcon={
                <Tooltip title={t("pages.reportDetail.photos.open")}>
                  <IconButton
                    size="small"
                    sx={{ color: "rgba(255,255,255,0.85)" }}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
              title={t("pages.reportDetail.photos.label", { n: idx + 1 })}
              sx={{ "& .MuiImageListItemBar-title": { fontSize: "0.72rem" } }}
            />
          </ImageListItem>
        ))}
      </ImageList>
    </Box>
  );
}

export default function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "reports", reportId),
      (snap) => {
        setReport(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("ReportDetail error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [reportId]);

  if (loading) {
    return (
      <Box>
        <Skeleton width={200} height={40} sx={{ mb: 2 }} />
        <Skeleton height={300} />
      </Box>
    );
  }

  if (!report) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/reports")}>
          {t("pages.reportDetail.backBtn")}
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>{t("pages.reportDetail.notFound")}</Alert>
      </Box>
    );
  }

  const photoCount = Array.isArray(report.photoUrls) ? report.photoUrls.length : 0;

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/reports")}
          sx={{ flexShrink: 0 }}
        >
          {t("pages.reportDetail.backBtn")}
        </Button>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <Typography variant="h5" fontWeight={800} noWrap>
            {report.jobTitle || t("pages.reportDetail.fallbackTitle")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {report.technicianName || "—"} · {report.siteName || "—"} · {formatDate(report.submittedAt)}
          </Typography>
        </Box>
        <StatusChip value={report.status} />
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label={t("pages.reportDetail.tabs.info")} />
          <Tab
            label={
              <Stack direction="row" spacing={0.8} alignItems="center">
                <span>{t("pages.reportDetail.tabs.photos")}</span>
                {photoCount > 0 && (
                  <Chip size="small" label={photoCount} color="info" sx={{ height: 18, fontSize: "0.68rem" }} />
                )}
              </Stack>
            }
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tab} index={0}>
            <InfoTab report={report} reportId={reportId} />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <PhotosTab report={report} />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

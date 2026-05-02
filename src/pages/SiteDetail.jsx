import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  ref,
  listAll,
  getDownloadURL,
  uploadBytesResumable,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  InputLabel,
  LinearProgress,
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";

const REGIONS = ["Alytus", "Druskininkai", "Kaunas", "Klaipėda", "Marijampolė", "Mažeikiai", "Panevėžys", "Plungė", "Šiauliai", "Tauragė", "Telšiai", "Utena", "Vilnius"];
const MOUNTING_TYPES = ["Stogo", "Žemės"];

function StatusChip({ value }) {
  const { t } = useTranslation();
  const label = t(value === "active" ? "status.active" : "status.inactive");
  const color = value === "active" ? "success" : "default";
  return <Chip size="small" label={label} color={color} variant="outlined" />;
}

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

function InfoTab({ site, siteId }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!site) return;
    setForm({
      name: site.name ?? "",
      address: site.address ?? "",
      region: site.region ?? "Kaunas",
      status: site.status ?? "active",
      capacityKw: site.capacityKw != null ? String(site.capacityKw) : "",
    });
  }, [site]);

  if (!form) return <Skeleton height={300} />;

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await updateDoc(doc(db, "sites", siteId), {
        name: form.name,
        address: form.address,
        region: form.region,
        status: form.status,
        capacityKw: form.capacityKw !== "" ? parseFloat(form.capacityKw) : null,
        updatedAt: new Date().toISOString().slice(0, 10),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const f = (field) => ({
    value: form[field],
    onChange: (e) => setForm((p) => ({ ...p, [field]: e.target.value })),
  });

  const m = site.mounting ?? {};

  const infoRows = [
    { label: t("pages.siteDetail.info.name"),     value: site.name },
    { label: t("pages.siteDetail.info.address"),  value: site.address },
    { label: t("pages.siteDetail.info.region"),   value: site.region },
    { label: t("pages.siteDetail.info.status"),   value: site.status ? t(`status.${site.status}`, site.status) : null },
    { label: t("pages.siteDetail.info.capacity"), value: site.capacityKw != null ? `${site.capacityKw} kW` : null },
  ];

  const mountingRows = [
    { label: t("pages.siteDetail.mounting.panelType"),    value: m.panelType },
    { label: t("pages.siteDetail.mounting.panelCount"),   value: m.panelCount != null ? String(m.panelCount) : null },
    { label: t("pages.siteDetail.mounting.inverterModel"),value: m.inverterModel },
    { label: t("pages.siteDetail.mounting.mountingType"), value: m.mountingType ? t(`mountingType.${m.mountingType}`, m.mountingType) : null },
    { label: t("pages.siteDetail.mounting.installDate"),  value: m.installationDate },
  ];

  return (
    <Stack spacing={3}>
      {/* ── Edit form ── */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("pages.siteDetail.info.name")} fullWidth {...f("name")} />
            <TextField label={t("pages.siteDetail.info.address")} fullWidth {...f("address")} />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>{t("pages.siteDetail.info.region")}</InputLabel>
              <Select label={t("pages.siteDetail.info.region")} value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}>
                {REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t("pages.siteDetail.info.status")}</InputLabel>
              <Select label={t("pages.siteDetail.info.status")} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <MenuItem value="active">{t("status.active")}</MenuItem>
                <MenuItem value="inactive">{t("status.inactive")}</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <TextField
            label={t("pages.siteDetail.info.capacity")}
            type="number"
            inputProps={{ step: "0.1" }}
            fullWidth
            {...f("capacityKw")}
          />

          {saveError && <Alert severity="error">{saveError}</Alert>}
          {saved && <Alert severity="success">{t("common.savedOk")}</Alert>}

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
        </Stack>
      </Paper>

      {/* ── Read-only overview ── */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography fontWeight={700} sx={{ mb: 2 }}>
          {site.name}
        </Typography>

        <Stack spacing={0}>
          {/* Site info rows */}
          {infoRows.map(({ label, value }) => (
            <Stack
              key={label}
              direction="row"
              sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ width: 200, flexShrink: 0 }}>
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {value || "—"}
              </Typography>
            </Stack>
          ))}

          {/* Divider with mounting label */}
          <Stack
            direction="row"
            sx={{ py: 1.5, mt: 1, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ width: 200, flexShrink: 0 }}>
              {t("pages.siteDetail.tabs.mounting")}
            </Typography>
          </Stack>

          {/* Mounting rows */}
          {mountingRows.map(({ label, value }) => (
            <Stack
              key={label}
              direction="row"
              sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: "none" } }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ width: 200, flexShrink: 0 }}>
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {value || "—"}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

function MapTab({ site }) {
  const { t } = useTranslation();
  const address = site?.address;

  if (!address) {
    return (
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center" }}>
        <Typography color="text.secondary">
          {t("pages.siteDetail.map.noCoords")}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      <iframe
        title={t("pages.siteDetail.map.iframeTitle")}
        src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`}
        width="100%"
        height="480"
        style={{ border: 0, display: "block" }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </Paper>
  );
}

function MountingTab({ site, siteId }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!site) return;
    const m = site.mounting ?? {};
    setForm({
      panelType: m.panelType ?? "",
      panelCount: m.panelCount != null ? String(m.panelCount) : "",
      inverterModel: m.inverterModel ?? "",
      mountingType: m.mountingType ?? "Stogo",
      installationDate: m.installationDate ?? "",
    });
  }, [site]);

  if (!form) return <Skeleton height={300} />;

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await updateDoc(doc(db, "sites", siteId), {
        mounting: {
          panelType: form.panelType,
          panelCount: form.panelCount !== "" ? parseInt(form.panelCount, 10) : null,
          inverterModel: form.inverterModel,
          mountingType: form.mountingType,
          installationDate: form.installationDate,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const f = (field) => ({
    value: form[field],
    onChange: (e) => setForm((p) => ({ ...p, [field]: e.target.value })),
  });

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField label={t("pages.siteDetail.mounting.panelType")} placeholder={t("pages.siteDetail.mounting.panelTypePlaceholder")} fullWidth {...f("panelType")} />
          <TextField label={t("pages.siteDetail.mounting.panelCount")} type="number" inputProps={{ min: 1 }} fullWidth {...f("panelCount")} />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField label={t("pages.siteDetail.mounting.inverterModel")} fullWidth {...f("inverterModel")} />
          <FormControl fullWidth>
            <InputLabel>{t("pages.siteDetail.mounting.mountingType")}</InputLabel>
            <Select label={t("pages.siteDetail.mounting.mountingType")} value={form.mountingType} onChange={(e) => setForm((p) => ({ ...p, mountingType: e.target.value }))}>
              {MOUNTING_TYPES.map((mt) => <MenuItem key={mt} value={mt}>{t(`mountingType.${mt}`, mt)}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>

        <TextField
          label={t("pages.siteDetail.mounting.installDate")}
          type="date"
          fullWidth
          InputLabelProps={{ shrink: true }}
          {...f("installationDate")}
        />

        {saveError && <Alert severity="error">{saveError}</Alert>}
        {saved && <Alert severity="success">{t("common.savedOk")}</Alert>}

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
      </Stack>
    </Paper>
  );
}

function PhotosTab({ siteId }) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  const loadPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const storageRef = ref(storage, `sites/${siteId}/photos`);
      const result = await listAll(storageRef);
      const urls = await Promise.all(
        result.items.map(async (item) => ({
          name: item.name,
          url: await getDownloadURL(item),
          ref: item,
        }))
      );
      setPhotos(urls);
    } catch (e) {
      console.error("Error loading photos:", e);
    } finally {
      setLoadingPhotos(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [siteId]);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setUploadError("");
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `sites/${siteId}/photos/${Date.now()}_${file.name}`);
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round(((i + snap.bytesTransferred / snap.totalBytes) / files.length) * 100);
              setUploadProgress(pct);
            },
            reject,
            resolve
          );
        });
      }
      await loadPhotos();
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleDelete = async (photo) => {
    try {
      await deleteObject(photo.ref);
      setPhotos((prev) => prev.filter((p) => p.name !== photo.name));
    } catch (e) {
      console.error("Error deleting photo:", e);
    }
  };

  const countLabel = photos.length === 1
    ? `1 ${t("pages.siteDetail.photos.countSingular")}`
    : `${photos.length} ${t("pages.siteDetail.photos.countPlural")}`;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {countLabel}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {t("pages.siteDetail.photos.upload")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </Stack>

      {uploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" color="text.secondary">
            {t("pages.siteDetail.photos.uploading", { pct: uploadProgress })}
          </Typography>
        </Box>
      )}

      {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}

      {loadingPhotos ? (
        <Grid container spacing={1.5}>
          {[...Array(4)].map((_, i) => (
            <Grid item key={i} xs={6} sm={4} md={3}>
              <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      ) : photos.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center" }}>
          <Typography color="text.secondary">{t("pages.siteDetail.photos.none")}</Typography>
        </Paper>
      ) : (
        <ImageList cols={4} gap={12} sx={{ mt: 0 }}>
          {photos.map((photo) => (
            <ImageListItem key={photo.name} sx={{ borderRadius: 1, overflow: "hidden" }}>
              <img
                src={photo.url}
                alt={photo.name}
                loading="lazy"
                style={{ height: 160, objectFit: "cover", width: "100%" }}
              />
              <ImageListItemBar
                actionIcon={
                  <Tooltip title={t("pages.siteDetail.photos.delete")}>
                    <IconButton
                      size="small"
                      sx={{ color: "rgba(255,255,255,0.8)" }}
                      onClick={() => handleDelete(photo)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
                actionPosition="right"
                title={photo.name}
                sx={{ "& .MuiImageListItemBar-title": { fontSize: "0.7rem" } }}
              />
            </ImageListItem>
          ))}
        </ImageList>
      )}
    </Box>
  );
}

export default function SiteDetail() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "sites", siteId),
      (snap) => {
        setSite(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("SiteDetail error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [siteId]);

  if (loading) {
    return (
      <Box>
        <Skeleton width={200} height={40} sx={{ mb: 2 }} />
        <Skeleton height={300} />
      </Box>
    );
  }

  if (!site) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/sites")}>
          {t("pages.siteDetail.backBtn")}
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>{t("pages.siteDetail.notFound")}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/sites")}
          sx={{ flexShrink: 0 }}
        >
          {t("pages.siteDetail.backBtn")}
        </Button>
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }} noWrap>
          {site.name}
        </Typography>
        <StatusChip value={site.status} />
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label={t("pages.siteDetail.tabs.info")} />
          <Tab label={t("pages.siteDetail.tabs.map")} />
          <Tab label={t("pages.siteDetail.tabs.mounting")} />
          <Tab label={t("pages.siteDetail.tabs.photos")} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tab} index={0}>
            <InfoTab site={site} siteId={siteId} />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <MapTab site={site} />
          </TabPanel>
          <TabPanel value={tab} index={2}>
            <MountingTab site={site} siteId={siteId} />
          </TabPanel>
          <TabPanel value={tab} index={3}>
            <PhotosTab siteId={siteId} />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

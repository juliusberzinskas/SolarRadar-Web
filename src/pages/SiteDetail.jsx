import { useCallback, useEffect, useRef, useState } from "react";
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
import MyLocationIcon from "@mui/icons-material/MyLocation";

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

      {/* ── Read-only location map ── */}
      {site.location?.lat != null && (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
            <Typography variant="body2" fontWeight={700} color="text.secondary">
              {t("pages.siteDetail.map.legendSite")}
            </Typography>
          </Box>
          <MapContainer
            center={[site.location.lat, site.location.lng]}
            zoom={17}
            style={{ height: 500, width: "100%"}}
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[site.location.lat, site.location.lng]} icon={siteIcon}>
              <Popup>{site.name}</Popup>
            </Marker>
          </MapContainer>
        </Paper>
      )}
    </Stack>
  );
}

// ── Leaflet custom icons ──────────────────────────────────────────────────────

function pinSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
      fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.85"/>
  </svg>`;
}

const addressIcon = L.divIcon({
  className: "",
  html: pinSvg("#3b82f6"),
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -44],
});

const siteIcon = L.divIcon({
  className: "",
  html: pinSvg("#f97316"),
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -44],
});

// Handles map clicks when placement mode is active
function ClickHandler({ active, onPlace }) {
  const map = useMapEvents({
    click(e) {
      if (active) onPlace(e.latlng);
    },
  });
  useEffect(() => {
    map.getContainer().style.cursor = active ? "crosshair" : "";
  }, [active, map]);
  return null;
}

// ── MapTab ────────────────────────────────────────────────────────────────────

const LT_CENTER = [55.9, 23.9]; // Lithuania

function MapTab({ site, siteId }) {
  const { t } = useTranslation();

  // Saved location from Firestore
  const savedLoc = site?.location?.lat != null ? site.location : null;

  // Address marker — geocoded from the address string
  const [addrPos, setAddrPos]   = useState(null);
  const [geocoding, setGeocoding] = useState(false);

  // Pending site marker (not yet saved)
  const [siteLoc, setSiteLoc]   = useState(savedLoc);
  const [placing, setPlacing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved]       = useState(false);

  const isDirty = siteLoc && (
    !savedLoc ||
    siteLoc.lat !== savedLoc.lat ||
    siteLoc.lng !== savedLoc.lng
  );

  // Geocode address via Nominatim (free, no API key)
  useEffect(() => {
    if (!site?.address) return;
    setGeocoding(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(site.address)}&limit=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data[0]) setAddrPos({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      })
      .catch(() => {})
      .finally(() => setGeocoding(false));
  }, [site?.address]);

  const handlePlace = useCallback((latlng) => {
    setSiteLoc({ lat: latlng.lat, lng: latlng.lng });
    setPlacing(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await updateDoc(doc(db, "sites", siteId), { location: siteLoc });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const mapCenter = savedLoc
    ? [savedLoc.lat, savedLoc.lng]
    : addrPos
    ? [addrPos.lat, addrPos.lng]
    : LT_CENTER;

  return (
    <Stack spacing={2}>
      {/* Controls */}
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        <Button
          variant={placing ? "contained" : "outlined"}
          color={placing ? "warning" : "primary"}
          startIcon={<MyLocationIcon />}
          onClick={() => setPlacing((p) => !p)}
          size="small"
        >
          {placing ? t("pages.siteDetail.map.placing") : t("pages.siteDetail.map.setLocation")}
        </Button>

        {siteLoc && (
          <Typography variant="caption" color="text.secondary">
            {siteLoc.lat.toFixed(6)}, {siteLoc.lng.toFixed(6)}
          </Typography>
        )}

        {isDirty && (
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ ml: "auto" }}
          >
            {saving ? t("common.saving") : t("pages.siteDetail.map.saveLocation")}
          </Button>
        )}
      </Stack>

      {placing && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          {t("pages.siteDetail.map.placingHint")}
        </Alert>
      )}
      {geocoding && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          {t("pages.siteDetail.map.geocoding")}
        </Alert>
      )}
      {saveError && <Alert severity="error">{saveError}</Alert>}
      {saved    && <Alert severity="success">{t("common.savedOk")}</Alert>}

      {/* Legend */}
      <Stack direction="row" gap={2.5}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: "#3b82f6", border: "2px solid white", boxShadow: 1 }} />
          <Typography variant="caption" color="text.secondary">{t("pages.siteDetail.map.legendAddress")}</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: "#f97316", border: "2px solid white", boxShadow: 1 }} />
          <Typography variant="caption" color="text.secondary">{t("pages.siteDetail.map.legendSite")}</Typography>
        </Stack>
      </Stack>

      {/* Map */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <MapContainer
          center={mapCenter}
          zoom={savedLoc || addrPos ? 15 : 7}
          style={{ height: 480, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler active={placing} onPlace={handlePlace} />

          {addrPos && (
            <Marker position={[addrPos.lat, addrPos.lng]} icon={addressIcon}>
              <Popup>{t("pages.siteDetail.map.legendAddress")}<br />{site.address}</Popup>
            </Marker>
          )}

          {siteLoc && (
            <Marker position={[siteLoc.lat, siteLoc.lng]} icon={siteIcon}>
              <Popup>{t("pages.siteDetail.map.legendSite")}<br />{siteLoc.lat.toFixed(6)}, {siteLoc.lng.toFixed(6)}</Popup>
            </Marker>
          )}
        </MapContainer>
      </Paper>
    </Stack>
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
            <MapTab site={site} siteId={siteId} />
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

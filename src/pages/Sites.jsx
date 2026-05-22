import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  collection,
  onSnapshot,
  addDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Paper,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";

import PageHeader from "../components/PageHeader";
import FilterBar from "../components/FilterBar";
import { useAuth } from "../contexts/AuthContext";

async function getNextSiteId() {
  const snap = await getDocs(collection(db, "sites"));
  const nums = snap.docs
    .map((d) => d.data().siteId)
    .filter((id) => /^\d+$/.test(id))
    .map((id) => parseInt(id, 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(3, "0");
}

const REGIONS = ["Alytus", "Druskininkai", "Kaunas", "Klaipėda", "Marijampolė", "Mažeikiai", "Panevėžys", "Plungė", "Šiauliai", "Tauragė", "Telšiai", "Utena", "Vilnius"];

const emptyForm = () => ({
  name: "",
  address: "",
  region: "Kaunas",
  status: "active",
  capacityKw: "",
});

function StatusChip({ value }) {
  const { t } = useTranslation();
  const label = t(value === "active" ? "status.active" : "status.inactive");
  const color = value === "active" ? "success" : "default";
  return <Chip size="small" label={label} color={color} variant="outlined" />;
}

export default function Sites() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDemo } = useAuth();

  const [sites, setSites] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "sites"),
      (snapshot) => {
        setSites(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingData(false);
      },
      (err) => {
        console.error("Sites listener error:", err);
        setLoadingData(false);
      }
    );
    return () => unsub();
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((r) => {
      const matchesSearch =
        !q ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.address || "").toLowerCase().includes(q);
      const matchesRegion = region === "all" ? true : r.region === region;
      const matchesStatus = status === "all" ? true : r.status === status;
      return matchesSearch && matchesRegion && matchesStatus;
    });
  }, [sites, search, region, status]);

  const columns = useMemo(
    () => [
      { field: "siteId", headerName: "ID", width: 100, renderCell: (p) => <b>{p.value ?? "—"}</b> },
      { field: "name", headerName: t("pages.sites.col.name"), flex: 1, minWidth: 200 },
      { field: "address", headerName: t("pages.sites.col.address"), flex: 1, minWidth: 200 },
      { field: "region", headerName: t("pages.sites.col.region"), width: 130 },
      {
        field: "status",
        headerName: t("pages.sites.col.status"),
        width: 120,
        renderCell: (params) => <StatusChip value={params.value} />,
        sortable: false,
      },
      {
        field: "capacityKw",
        headerName: t("pages.sites.col.capacity"),
        width: 110,
        valueFormatter: (value) => (value != null ? `${value} kW` : "—"),
      },
      {
        field: "updatedAt",
        headerName: t("pages.sites.col.updated"),
        width: 130,
        valueFormatter: (value) => value || "—",
      },
    ],
    [t]
  );

  const onReset = () => {
    setSearch("");
    setRegion("all");
    setStatus("all");
  };

  const openCreateDialog = () => {
    setForm(emptyForm());
    setSaveError("");
    setOpenCreate(true);
  };

  const buildDocData = (f) => ({
    name: f.name,
    address: f.address,
    region: f.region,
    status: f.status,
    capacityKw: f.capacityKw !== "" ? parseFloat(f.capacityKw) : null,
    updatedAt: new Date().toISOString().slice(0, 10),
  });

  const handleCreate = async () => {
    setSaveError("");
    try {
      const siteId = await getNextSiteId();
      await addDoc(collection(db, "sites"), {
        ...buildDocData(form),
        siteId,
        createdAt: new Date().toISOString().slice(0, 10),
      });
      setOpenCreate(false);
    } catch (e) {
      console.error("Create site error:", e);
      setSaveError(e.message);
    }
  };

  const FormFields = (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField
        label={t("pages.sites.form.name")}
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        fullWidth
      />
      <TextField
        label={t("pages.sites.form.address")}
        value={form.address}
        onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
        fullWidth
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormControl fullWidth>
          <InputLabel>{t("pages.sites.form.region")}</InputLabel>
          <Select
            label={t("pages.sites.form.region")}
            value={form.region}
            onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
          >
            {REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>{t("pages.sites.form.status")}</InputLabel>
          <Select
            label={t("pages.sites.form.status")}
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          >
            <MenuItem value="active">{t("status.active")}</MenuItem>
            <MenuItem value="inactive">{t("status.inactive")}</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <TextField
        label={t("pages.sites.form.capacity")}
        value={form.capacityKw}
        onChange={(e) => setForm((p) => ({ ...p, capacityKw: e.target.value }))}
        fullWidth
        type="number"
        inputProps={{ step: "0.1" }}
      />
    </Stack>
  );

  return (
    <Box>
      <PageHeader
        title={t("pages.sites.title")}
        subtitle={t("pages.sites.subtitle")}
        primaryAction={isDemo ? undefined : {
          label: t("pages.sites.add"),
          icon: <AddIcon />,
          onClick: openCreateDialog,
        }}
      />

      <FilterBar search={search} onSearchChange={setSearch} onReset={onReset}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{t("pages.sites.filter.region")}</InputLabel>
          <Select label={t("pages.sites.filter.region")} value={region} onChange={(e) => setRegion(e.target.value)}>
            <MenuItem value="all">{t("common.all")}</MenuItem>
            {REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{t("pages.sites.filter.status")}</InputLabel>
          <Select label={t("pages.sites.filter.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="all">{t("common.all")}</MenuItem>
            <MenuItem value="active">{t("status.active")}</MenuItem>
            <MenuItem value="inactive">{t("status.inactive")}</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      <Paper sx={{ borderRadius: 2 }} variant="outlined">
        <Box sx={{ height: 520, width: "100%" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loadingData}
            pageSizeOptions={[5, 10, 25]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
            }}
            onRowClick={(params) => navigate(`/sites/${params.id}`)}
            sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
          />
        </Box>
      </Paper>

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("pages.sites.dialog.add")}</DialogTitle>
        <DialogContent>
          {FormFields}
          {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenCreate(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleCreate}>{t("common.save")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

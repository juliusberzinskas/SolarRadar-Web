import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AssignmentIcon from "@mui/icons-material/Assignment";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import PageHeader from "../components/PageHeader";
import FilterBar from "../components/FilterBar";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/lt";

dayjs.extend(relativeTime);

function StatusChip({ value }) {
  const { t } = useTranslation();
  const cfg = {
    completed:            { key: "status.completed",            color: "success" },
    not_completed:        { key: "status.not_completed",        color: "error"   },
    requires_maintenance: { key: "status.requires_maintenance", color: "warning" },
  };
  const c = cfg[value] || { key: value || "—", color: "default" };
  return <Chip size="small" label={t(c.key, c.key)} color={c.color} variant="outlined" />;
}

function formatDate(val) {
  if (!val) return "—";
  try {
    const d = typeof val.toDate === "function" ? val.toDate() : new Date(val);
    return dayjs(d).format("YYYY-MM-DD HH:mm");
  } catch { return "—"; }
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 6, textAlign: "center" }}>
      <AssignmentIcon sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
      <Typography variant="h6" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
        {t("pages.reports.empty.title")}
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 420, mx: "auto" }}>
        {t("pages.reports.empty.desc")} <b>reports</b>.
      </Typography>
    </Box>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [reports, setReports] = useState([]);
  const [sites, setSites] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reports"),
      (snap) => {
        setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingReports(false);
      },
      (err) => {
        console.error("Reports error:", err);
        setLoadingReports(false);
      }
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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const matchesSearch =
        !q ||
        (r.technicianName || "").toLowerCase().includes(q) ||
        (r.jobTitle || "").toLowerCase().includes(q) ||
        (r.siteName || "").toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesSite   = siteFilter === "all"   || r.siteId === siteFilter;
      return matchesSearch && matchesStatus && matchesSite;
    });
  }, [reports, search, statusFilter, siteFilter]);

  const columns = useMemo(() => [
    {
      field: "editFlag",
      headerName: "",
      width: 50,
      sortable: false,
      filterable: false,
      renderCell: (p) =>
        p.value ? (
          <Tooltip title={`Edited by ${p.row.editedByTechnicianName || "technician"}`} arrow>
            <DriveFileRenameOutlineIcon
              fontSize="small"
              sx={{ color: "#ef4444", mt: "2px" }}
            />
          </Tooltip>
        ) : null,
    },
    {
      field: "technicianName",
      headerName: t("pages.reports.col.technician"),
      width: 180,
      valueFormatter: (v) => v || "—",
    },
    {
      field: "jobTitle",
      headerName: t("pages.reports.col.job"),
      flex: 1,
      minWidth: 200,
      valueFormatter: (v) => v || "—",
    },
    {
      field: "siteName",
      headerName: t("pages.reports.col.site"),
      width: 180,
      valueFormatter: (v) => v || "—",
    },
    {
      field: "status",
      headerName: t("pages.reports.col.status"),
      width: 200,
      renderCell: (p) => <StatusChip value={p.value} />,
      sortable: false,
    },
    {
      field: "photoUrls",
      headerName: t("pages.reports.col.photos"),
      width: 120,
      sortable: false,
      renderCell: (p) => {
        const count = Array.isArray(p.value) ? p.value.length : 0;
        return (
          <Chip
            size="small"
            label={count > 0 ? t("pages.reports.photosCount", { count }) : "—"}
            variant="outlined"
            color={count > 0 ? "info" : "default"}
          />
        );
      },
    },
    {
      field: "submittedAt",
      headerName: t("pages.reports.col.submitted"),
      width: 160,
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary">
          {formatDate(p.value)}
        </Typography>
      ),
    },
  ], [t]);

  const onReset = () => {
    setSearch("");
    setStatusFilter("all");
    setSiteFilter("all");
  };

  return (
    <Box>
      <PageHeader
        title={t("pages.reports.title")}
        subtitle={t("pages.reports.subtitle")}
      />

      <FilterBar search={search} onSearchChange={setSearch} onReset={onReset}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t("pages.reports.filter.status")}</InputLabel>
          <Select label={t("pages.reports.filter.status")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="all">{t("common.all")}</MenuItem>
            <MenuItem value="completed">{t("status.completed")}</MenuItem>
            <MenuItem value="not_completed">{t("status.not_completed")}</MenuItem>
            <MenuItem value="requires_maintenance">{t("status.requires_maintenance")}</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{t("pages.reports.filter.site")}</InputLabel>
          <Select label={t("pages.reports.filter.site")} value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <MenuItem value="all">{t("common.all")}</MenuItem>
            {sites.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </Select>
        </FormControl>
      </FilterBar>

      <Paper sx={{ borderRadius: 2 }} variant="outlined">
        {!loadingReports && reports.length === 0 ? (
          <EmptyState />
        ) : (
          <Box sx={{ height: 560, width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loadingReports}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10, page: 0 } },
                sorting: { sortModel: [{ field: "submittedAt", sort: "desc" }] },
              }}
              onRowClick={(params) => navigate(`/reports/${params.id}`)}
              sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}

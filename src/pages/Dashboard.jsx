import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/lt";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Box,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AssignmentLateIcon       from "@mui/icons-material/AssignmentLate";
import SyncIcon                 from "@mui/icons-material/Sync";
import CheckCircleOutlineIcon   from "@mui/icons-material/CheckCircleOutline";
import SolarPowerIcon           from "@mui/icons-material/SolarPower";
import PageHeader               from "../components/PageHeader";

dayjs.extend(relativeTime);

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C_AMBER  = "#f59e0b";
const C_BLUE   = "#3b82f6";
const C_GREEN  = "#22c55e";
const C_RED    = "#ef4444";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatAgo(val, locale) {
  if (!val) return "—";
  try {
    const date = typeof val.toDate === "function" ? val.toDate() : new Date(val);
    return dayjs(date).locale(locale).fromNow();
  } catch { return "—"; }
}

function shortName(name = "") {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

// ── Small reusable components ─────────────────────────────────────────────────
function StatusChip({ value }) {
  const { t } = useTranslation();
  const cfg = {
    open:        { key: "status.open",        color: "warning" },
    in_progress: { key: "status.in_progress", color: "info"    },
    resolved:    { key: "status.resolved",    color: "success" },
  };
  const c = cfg[value] || { key: value, color: "default" };
  return <Chip size="small" label={t(c.key, c.key)} color={c.color} variant="outlined" />;
}

function PriorityChip({ value }) {
  const { t } = useTranslation();
  const cfg = {
    low:    { key: "priority.low",    color: "default" },
    medium: { key: "priority.medium", color: "info"    },
    high:   { key: "priority.high",   color: "error"   },
  };
  const c = cfg[value] || { key: value, color: "default" };
  return <Chip size="small" label={t(c.key, c.key)} color={c.color} variant="outlined" />;
}

function KpiCard({ label, count, icon, accentColor, loading }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 2,
        borderLeft: `4px solid ${accentColor}`,
        display: "flex",
        alignItems: "center",
        gap: 2,
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          width: 52, height: 52, borderRadius: 2,
          bgcolor: `${accentColor}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accentColor, flexShrink: 0, fontSize: 28,
        }}
      >
        {icon}
      </Box>
      <Box>
        {loading
          ? <Skeleton width={48} height={44} />
          : <Typography variant="h4" fontWeight={800} lineHeight={1}>{count}</Typography>
        }
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{label}</Typography>
      </Box>
    </Paper>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
function ChartPanel({ title, subtitle, children, loading, sx }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, ...sx }}>
      <Box sx={{ mb: 2 }}>
        <Typography fontWeight={700} fontSize="0.9rem">{title}</Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </Box>
      {loading
        ? <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
        : children
      }
    </Paper>
  );
}

function EmptyChart({ height = 180 }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Typography variant="body2" color="text.secondary">
        {t("pages.dashboard.charts.noData")}
      </Typography>
    </Box>
  );
}

function ChartTooltip({ active, payload, label }) {
  const theme = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <Paper
      elevation={6}
      sx={{
        px: 1.5, py: 1, borderRadius: 1.5, minWidth: 110,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      {label && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.4 }}>
          {label}
        </Typography>
      )}
      {payload.map((p, i) => (
        <Stack key={i} direction="row" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              bgcolor: p.fill || p.color || p.payload?.color,
            }}
          />
          <Typography variant="caption" fontWeight={700}>
            {p.name ?? p.dataKey}: {p.value}
          </Typography>
        </Stack>
      ))}
    </Paper>
  );
}

function DonutChart({ data, total, centerLabel }) {
  const { t } = useTranslation();
  if (!data.length) return <EmptyChart />;
  return (
    <>
      <Box sx={{ position: "relative", height: 180 }}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              isAnimationActive
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label */}
        <Box
          sx={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none",
          }}
        >
          <Typography variant="h5" fontWeight={800} lineHeight={1}>{total}</Typography>
          <Typography variant="caption" color="text.secondary" lineHeight={1}>
            {centerLabel ?? t("pages.dashboard.charts.total")}
          </Typography>
        </Box>
      </Box>

      {/* Legend */}
      <Stack spacing={0.8} sx={{ mt: 1.5 }}>
        {data.map((item) => (
          <Stack key={item.name} direction="row" alignItems="center" gap={1}>
            <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: item.color, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {item.name}
            </Typography>
            <Typography variant="caption" fontWeight={700}>{item.value}</Typography>
          </Stack>
        ))}
      </Stack>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const theme  = useTheme();
  const locale = i18n.language === "lt" ? "lt" : "en";

  // ── Data ────────────────────────────────────────────────────────────────────
  const [jobs,           setJobs]           = useState([]);
  const [sitesCount,     setSitesCount]     = useState(0);
  const [reports,        setReports]        = useState([]);
  const [loadingJobs,    setLoadingJobs]    = useState(true);
  const [loadingSites,   setLoadingSites]   = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [timeRange,      setTimeRange]      = useState(6); // months

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "jobs"),
      (snap) => { setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadingJobs(false); },
      () => setLoadingJobs(false)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "sites"),
      (snap) => { setSitesCount(snap.size); setLoadingSites(false); },
      () => setLoadingSites(false)
    );
    return () => unsub();
  }, []);

  // One-time fetch of reports from the last 12 months
  useEffect(() => {
    const cutoff = Timestamp.fromDate(dayjs().subtract(12, "month").toDate());
    getDocs(query(collection(db, "reports"), where("submittedAt", ">=", cutoff)))
      .then((snap) => {
        setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingReports(false);
      })
      .catch(() => setLoadingReports(false));
  }, []);

  // ── KPI counts ──────────────────────────────────────────────────────────────
  const openCount       = useMemo(() => jobs.filter((j) => j.status === "open").length,        [jobs]);
  const inProgressCount = useMemo(() => jobs.filter((j) => j.status === "in_progress").length, [jobs]);
  const resolvedCount   = useMemo(() => jobs.filter((j) => j.status === "resolved").length,    [jobs]);

  const recentJobs = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => (b.createdAt?.toDate?.()?.getTime() ?? 0) - (a.createdAt?.toDate?.()?.getTime() ?? 0))
        .slice(0, 6),
    [jobs]
  );

  // ── Chart data ──────────────────────────────────────────────────────────────

  // Chart 1 — jobs resolved per month (uses updatedAt date string on resolved jobs)
  const resolvedPerMonth = useMemo(() => {
    const months = Array.from({ length: timeRange }, (_, i) => {
      const d = dayjs().subtract(timeRange - 1 - i, "month");
      return { key: d.format("YYYY-MM"), label: d.locale(locale).format("MMM"), count: 0 };
    });
    jobs
      .filter((j) => j.status === "resolved" && j.updatedAt)
      .forEach((j) => {
        const key = dayjs(j.updatedAt).format("YYYY-MM");
        const m = months.find((m) => m.key === key);
        if (m) m.count++;
      });
    return months.map(({ label, count }) => ({ month: label, count }));
  }, [jobs, timeRange, locale]);

  // Chart 2 — job status donut
  const statusChartData = useMemo(() => [
    { name: t("status.open"),        value: openCount,       color: C_AMBER },
    { name: t("status.in_progress"), value: inProgressCount, color: C_BLUE  },
    { name: t("status.resolved"),    value: resolvedCount,   color: C_GREEN },
  ].filter((d) => d.value > 0), [openCount, inProgressCount, resolvedCount, t]);

  // Reports filtered to current time range (for charts 3 & 4)
  const filteredReports = useMemo(() => {
    const cutoff = dayjs().subtract(timeRange, "month");
    return reports.filter((r) => {
      const date = r.submittedAt?.toDate?.();
      return date && dayjs(date).isAfter(cutoff);
    });
  }, [reports, timeRange]);

  // Chart 3 — top 3 technicians by report count
  const topTechnicians = useMemo(() => {
    const counts = {};
    filteredReports.forEach((r) => {
      if (r.technicianName) counts[r.technicianName] = (counts[r.technicianName] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name: shortName(name), count }));
  }, [filteredReports]);

  // Chart 4 — report outcomes donut
  const reportOutcomes = useMemo(() => {
    const c = { completed: 0, requires_maintenance: 0, not_completed: 0 };
    filteredReports.forEach((r) => { if (r.status in c) c[r.status]++; });
    return [
      { name: t("status.completed"),            value: c.completed,            color: C_GREEN },
      { name: t("status.requires_maintenance"), value: c.requires_maintenance, color: C_AMBER },
      { name: t("status.not_completed"),        value: c.not_completed,        color: C_RED   },
    ].filter((d) => d.value > 0);
  }, [filteredReports, t]);

  const loading = loadingJobs || loadingSites;

  // ── Axis/grid theme colours ──────────────────────────────────────────────────
  const axisColor  = theme.palette.text.secondary;
  const gridColor  = theme.palette.divider;

  return (
    <Box>
      <PageHeader
        title={t("pages.dashboard.title")}
        subtitle={t("pages.dashboard.subtitle")}
      />

      {/* ── KPI cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label={t("pages.dashboard.kpi.open")}        count={openCount}       icon={<AssignmentLateIcon fontSize="inherit" />}     accentColor={C_AMBER}  loading={loading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label={t("pages.dashboard.kpi.inProgress")}  count={inProgressCount} icon={<SyncIcon fontSize="inherit" />}               accentColor={C_BLUE}   loading={loading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label={t("pages.dashboard.kpi.resolved")}    count={resolvedCount}   icon={<CheckCircleOutlineIcon fontSize="inherit" />}  accentColor={C_GREEN}  loading={loading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label={t("pages.dashboard.kpi.activeSites")} count={sitesCount}      icon={<SolarPowerIcon fontSize="inherit" />}          accentColor="#a855f7"  loading={loading} />
        </Grid>
      </Grid>

      {/* ── Charts section ── */}
      <Box sx={{ mb: 3 }}>
        {/* Section header */}
        <Stack
          direction="row"
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          flexWrap="wrap"
          gap={1}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography fontWeight={700} fontSize="0.95rem">
              {t("pages.dashboard.charts.title")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("pages.dashboard.charts.subtitle")}
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={(_, v) => v && setTimeRange(v)}
            size="small"
          >
            <ToggleButton value={3}  sx={{ px: 1.8, fontWeight: 600 }}>3M</ToggleButton>
            <ToggleButton value={6}  sx={{ px: 1.8, fontWeight: 600 }}>6M</ToggleButton>
            <ToggleButton value={12} sx={{ px: 1.8, fontWeight: 600 }}>12M</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {/* ── All charts — single responsive row that wraps ── */}
        <Grid container spacing={2}>

          {/* Chart 1 — Jobs Resolved per Month */}
          <Grid item xs={12} sm={6} lg={3}>
            <ChartPanel
              title={t("pages.dashboard.charts.resolvedPerMonth.title")}
              subtitle={`${resolvedCount} ${t("pages.dashboard.charts.resolved")}`}
              loading={loadingJobs}
            >
              {resolvedPerMonth.every((d) => d.count === 0) ? (
                <EmptyChart height={220} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={resolvedPerMonth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridColor}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: axisColor, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: theme.palette.action.hover }}
                    />
                    <Bar
                      dataKey="count"
                      name={t("pages.dashboard.charts.resolved")}
                      fill={C_GREEN}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>
          </Grid>

          {/* Chart 2 — Job Status Donut */}
          <Grid item xs={12} sm={6} lg={3}>
            <ChartPanel
              title={t("pages.dashboard.charts.statusBreakdown.title")}
              subtitle={t("pages.dashboard.charts.statusBreakdown.subtitle")}
              loading={loadingJobs}
            >
              <DonutChart
                data={statusChartData}
                total={jobs.length}
                centerLabel={t("pages.dashboard.charts.total")}
              />
            </ChartPanel>
          </Grid>

          {/* Chart 3 — Top 3 Technicians (horizontal bar) */}
          <Grid item xs={12} sm={6} lg={3}>
            <ChartPanel
              title={t("pages.dashboard.charts.topTechnicians.title")}
              subtitle={t("pages.dashboard.charts.topTechnicians.subtitle")}
              loading={loadingReports}
            >
              {topTechnicians.length === 0 ? (
                <EmptyChart height={180} />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    layout="vertical"
                    data={topTechnicians}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridColor}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fill: axisColor, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fill: theme.palette.text.primary, fontSize: 12, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: theme.palette.action.hover }}
                    />
                    <Bar
                      dataKey="count"
                      name={t("pages.dashboard.charts.reports")}
                      radius={[0, 6, 6, 0]}
                      maxBarSize={30}
                    >
                      {topTechnicians.map((_, i) => (
                        <Cell
                          key={i}
                          fill={[C_BLUE, "#60a5fa", "#93c5fd"][i] ?? C_BLUE}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>
          </Grid>

          {/* Chart 4 — Report Outcomes Donut */}
          <Grid item xs={12} sm={6} lg={3}>
            <ChartPanel
              title={t("pages.dashboard.charts.reportOutcomes.title")}
              subtitle={t("pages.dashboard.charts.reportOutcomes.subtitle")}
              loading={loadingReports}
            >
              <DonutChart
                data={reportOutcomes}
                total={filteredReports.length}
                centerLabel={t("pages.dashboard.charts.reports")}
              />
            </ChartPanel>
          </Grid>
        </Grid>
      </Box>

      {/* ── Recent jobs list ── */}
      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Box sx={{ px: 2.5, py: 1.8 }}>
          <Typography fontWeight={700} fontSize="0.95rem">
            {t("pages.dashboard.recentJobs")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("pages.dashboard.recentJobsCaption", { count: recentJobs.length })}
          </Typography>
        </Box>
        <Divider />

        {loadingJobs ? (
          <Box sx={{ p: 2 }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} height={52} sx={{ mb: 0.5 }} />)}
          </Box>
        ) : recentJobs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">{t("pages.dashboard.noJobs")}</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {recentJobs.map((job, idx) => (
              <Box key={job.id}>
                <ListItem
                  sx={{ px: 2.5, py: 1.4 }}
                  secondaryAction={
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <PriorityChip value={job.priority} />
                      <StatusChip   value={job.status}   />
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={
                      <Typography fontWeight={600} fontSize="0.9rem" noWrap sx={{ maxWidth: 340 }}>
                        {job.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {job.siteName || "—"} · {formatAgo(job.createdAt, locale)}
                      </Typography>
                    }
                  />
                </ListItem>
                {idx < recentJobs.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}

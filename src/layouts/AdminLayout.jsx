import * as React from "react";
import { useTranslation } from "react-i18next";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SolarPowerIcon from "@mui/icons-material/SolarPower";
import WorkIcon from "@mui/icons-material/Work";
import GroupIcon from "@mui/icons-material/Group";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const drawerWidth = 260;

// ── Sidebar colours (sidebar is always dark in both modes) ────────────────────
const MENU_TEXT        = "rgba(255,255,255,0.72)";
const MENU_TEXT_ACTIVE = "#ffffff";
const MENU_ICON        = "rgba(255,255,255,0.48)";
const MENU_ICON_ACTIVE = "#60a5fa";
const MENU_HOVER_BG    = "rgba(255,255,255,0.06)";
const MENU_ACTIVE_BG   = "rgba(96,165,250,0.14)";
const MENU_ACTIVE_LINE = "#3b82f6";
const SIDEBAR_DIVIDER  = "rgba(255,255,255,0.08)";
// ─────────────────────────────────────────────────────────────────────────────

const menuItems = [
  { labelKey: "menu.dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { labelKey: "menu.sites",     path: "/sites",     icon: <SolarPowerIcon /> },
  { labelKey: "menu.jobs",      path: "/jobs",      icon: <WorkIcon /> },
  { labelKey: "menu.members",   path: "/members",   icon: <GroupIcon /> },
  { labelKey: "menu.timesheets",path: "/timesheets",icon: <AccessTimeIcon /> },
  { labelKey: "menu.reports",   path: "/reports",   icon: <AssessmentIcon /> },
  { labelKey: "menu.settings",  path: "/settings",  icon: <SettingsIcon /> },
];

function getInitials(str) {
  if (!str) return "?";
  const parts = str.split(/[\s@]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : str.slice(0, 2).toUpperCase();
}

const LS_KEY = "solarradar_reports_last_seen";

function useNewReportsCount() {
  const [count, setCount] = React.useState(0);
  const location = useLocation();

  // Mark as seen when on the reports page
  React.useEffect(() => {
    if (location.pathname === "/reports") {
      localStorage.setItem(LS_KEY, new Date().toISOString());
      setCount(0);
    }
  }, [location.pathname]);

  // Listen to reports collection — count new submissions AND technician edits
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, "reports"), (snap) => {
      const lastSeen = localStorage.getItem(LS_KEY);
      const lastSeenDate = lastSeen ? new Date(lastSeen) : null;

      const newCount = snap.docs.filter((d) => {
        const data = d.data();

        const toDate = (v) => v ? (v.toDate ? v.toDate() : new Date(v)) : null;
        const submittedAt = toDate(data.submittedAt);
        const editedAt    = toDate(data.editedAt);

        const isNewSubmission = submittedAt && (!lastSeenDate || submittedAt > lastSeenDate);
        const isNewEdit       = editedAt    && (!lastSeenDate || editedAt    > lastSeenDate);

        return isNewSubmission || isNewEdit;
      }).length;

      if (window.location.pathname !== "/reports") {
        setCount(newCount);
      }
    });
    return () => unsub();
  }, []);

  return count;
}

function SidebarContent({ onNavigate }) {
  const location = useLocation();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const newReportsCount = useNewReportsCount();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>

      {/* ── Logo ── */}
      <Box sx={{ px: 2.5, py: 2.2, display: "flex", alignItems: "center", gap: 1.4 }}>
        <TrackChangesIcon sx={{ fontSize: 32, color: "#60a5fa" }} />
        <Typography variant="h6" sx={{ fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
          {t("app.title")}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />

      {/* ── Navigation ── */}
      <List sx={{ pt: 1.5, pb: 1 }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              component={NavLink}
              to={item.path}
              onClick={onNavigate}
              sx={{
                mx: 1.5,
                my: 0.25,
                borderRadius: 1.5,
                borderLeft: `3px solid ${active ? MENU_ACTIVE_LINE : "transparent"}`,
                backgroundColor: active ? MENU_ACTIVE_BG : "transparent",
                "&:hover": { backgroundColor: active ? MENU_ACTIVE_BG : MENU_HOVER_BG },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: active ? MENU_ICON_ACTIVE : MENU_ICON }}>
                {item.path === "/reports" && newReportsCount > 0 ? (
                  <Badge
                    badgeContent={newReportsCount > 9 ? "9+" : newReportsCount}
                    sx={{
                      "& .MuiBadge-badge": {
                        backgroundColor: "#ef4444",
                        color: "#fff",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        minWidth: 16,
                        height: 16,
                        padding: "0 4px",
                      },
                    }}
                  >
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText
                primary={t(item.labelKey)}
                primaryTypographyProps={{
                  sx: {
                    color: active ? MENU_TEXT_ACTIVE : MENU_TEXT,
                    fontWeight: active ? 700 : 400,
                    fontSize: "0.9rem",
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flex: 1 }} />

      {/* ── User info ── */}
      {user && (
        <>
          <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />
          <Box sx={{ px: 2.2, py: 1.6, display: "flex", alignItems: "center", gap: 1.4 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: "#3b82f6", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {getInitials(profile?.displayName || user.email)}
            </Avatar>
            <Box sx={{ overflow: "hidden", flex: 1 }}>
              <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: "0.83rem", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile?.displayName || "Admin"}
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.42)", fontSize: "0.71rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </Typography>
            </Box>
          </Box>
        </>
      )}

      {/* ── Import Data button ── */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <ListItemButton
          component={NavLink}
          to="/import"
          onClick={onNavigate}
          sx={{
            borderRadius: 1.5,
            border: "1px solid rgba(96,165,250,0.30)",
            backgroundColor: "rgba(96,165,250,0.08)",
            "&:hover": { backgroundColor: "rgba(96,165,250,0.16)" },
            py: 0.9,
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "#60a5fa" }}>
            <UploadFileIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t("menu.import")}
            primaryTypographyProps={{
              sx: { color: "#93c5fd", fontWeight: 600, fontSize: "0.85rem" },
            }}
          />
        </ListItemButton>
      </Box>

      <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />

      {/* ── Logout ── */}
      <List sx={{ px: 1.5, py: 1 }}>
        <ListItemButton
          sx={{
            borderRadius: 1.5,
            "&:hover": { backgroundColor: "rgba(239,68,68,0.12)" },
          }}
          onClick={handleLogout}
        >
          <ListItemIcon sx={{ minWidth: 38, color: "rgba(239,68,68,0.70)" }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText
            primary={t("menu.logout")}
            primaryTypographyProps={{
              sx: { color: "rgba(239,68,68,0.80)", fontWeight: 500, fontSize: "0.9rem" },
            }}
          />
        </ListItemButton>
      </List>
    </Box>
  );
}

export default function AdminLayout() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const SIDEBAR_BG = isDark ? "#0f172a" : "#111827";
  const CONTENT_BG = theme.palette.background.default;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const location = useLocation();

  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);
  const handleNavigate = () => { if (isMobile) setMobileOpen(false); };

  // Map path → page title for the topbar
  const PAGE_TITLES = {
    "/dashboard":  t("menu.dashboard"),
    "/sites":      t("menu.sites"),
    "/jobs":       t("menu.jobs"),
    "/members":    t("menu.members"),
    "/timesheets": t("menu.timesheets"),
    "/reports":    t("menu.reports"),
    "/settings":   t("menu.settings"),
    "/import":     t("menu.import"),
  };
  const pageTitle = PAGE_TITLES[location.pathname] || t("app.title");

  const drawerContent = (
    <SidebarContent onNavigate={handleNavigate} />
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />

      {/* ── Top bar ── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          color: "text.primary",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton edge="start" onClick={handleDrawerToggle}>
              <MenuIcon />
            </IconButton>
          )}

          <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>
            {pageTitle}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {user && (
            <Tooltip title={user.email || ""} arrow>
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: "primary.main",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "default",
                }}
              >
                {getInitials(profile?.displayName || user.email)}
              </Avatar>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      {/* ── Sidebar ── */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {/* Mobile */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              backgroundColor: SIDEBAR_BG,
              borderRight: "none",
              boxShadow: isDark
                ? "4px 0 24px rgba(0,0,0,0.6), 1px 0 0 rgba(255,255,255,0.04)"
                : "4px 0 24px rgba(0,0,0,0.15)",
              transition: "background-color 0.25s ease",
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              backgroundColor: SIDEBAR_BG,
              borderRight: "none",
              boxShadow: isDark
                ? "4px 0 24px rgba(0,0,0,0.6), 1px 0 0 rgba(255,255,255,0.04)"
                : "4px 0 24px rgba(0,0,0,0.12)",
              transition: "background-color 0.25s ease",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* ── Main content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          bgcolor: CONTENT_BG,
          transition: "background-color 0.25s ease",
          pt: 9,
          px: { xs: 2, md: 3 },
          pb: 3,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}

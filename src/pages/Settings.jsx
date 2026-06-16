import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import PageHeader from "../components/PageHeader";
import { useAppTheme } from "../contexts/ThemeContext";
import { usePushNotifications } from "../hooks/usePushNotifications";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useAppTheme();
  const { supported, permission, enabled, loading, dismissed, toggle } = usePushNotifications();
  const { isDemo } = useAuth();
  const [lang, setLang] = useState(i18n.language || "en");

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setLang(i18n.language || "en");
  }, [i18n.language]);

  const languageOptions = useMemo(
    () => [
      { value: "lt", label: "Lietuvių (LT)" },
      { value: "en", label: "English (EN)" },
    ],
    []
  );

  const onChangeLang = async (newLang) => {
    setLang(newLang);
    await i18n.changeLanguage(newLang);
    localStorage.setItem("lang", newLang);
  };

  const notifDenied = permission === "denied";
  const notifUnsupported = !supported;
  const notifDismissed = dismissed && permission === "default";

  return (
    <Box>
      <PageHeader
        title={t("pages.settings.title")}
        subtitle={t("pages.settings.subtitle")}
      />

      <Stack spacing={2}>
        {/* ── Appearance ── */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography fontWeight={800} sx={{ mb: 2 }}>
              {t("pages.settings.appearance.title")}
            </Typography>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" gap={1.5}>
                {darkMode
                  ? <DarkModeIcon sx={{ color: "primary.main" }} />
                  : <LightModeIcon sx={{ color: "warning.main" }} />}
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {t("pages.settings.appearance.darkMode")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {darkMode
                      ? t("pages.settings.appearance.on")
                      : t("pages.settings.appearance.off")}
                  </Typography>
                </Box>
              </Stack>
              <Switch checked={darkMode} onChange={toggleDarkMode} />
            </Stack>
          </CardContent>
        </Card>

        {/* ── Push Notifications — hidden for demo accounts ── */}
        {!isDemo && <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography fontWeight={800} sx={{ mb: 2 }}>
              {t("pages.settings.notifications.title")}
            </Typography>

            {notifUnsupported ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                {t("pages.settings.notifications.unsupported")}
              </Alert>
            ) : notifDenied ? (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {t("pages.settings.notifications.denied")}
              </Alert>
            ) : notifDismissed ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {t("pages.settings.notifications.pending")}
              </Alert>
            ) : (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" gap={1.5}>
                  {enabled
                    ? <NotificationsActiveIcon sx={{ color: "primary.main" }} />
                    : <NotificationsOffIcon sx={{ color: "text.secondary" }} />}
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {t("pages.settings.notifications.label")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {enabled
                        ? t("pages.settings.notifications.on")
                        : t("pages.settings.notifications.off")}
                    </Typography>
                  </Box>
                </Stack>
                <Switch
                  checked={enabled}
                  disabled={loading}
                  onChange={toggle}
                />
              </Stack>
            )}
          </CardContent>
        </Card>}

        {/* ── kalba ── */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography fontWeight={800} sx={{ mb: 1 }}>
              {t("pages.settings.lang.title")}
            </Typography>

            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>{t("pages.settings.lang.choose")}</InputLabel>
              <Select
                label={t("pages.settings.lang.choose")}
                value={lang}
                onChange={(e) => onChangeLang(e.target.value)}
              >
                {languageOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {/* ── accountas ── */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography fontWeight={800} sx={{ mb: 1 }}>
              {t("pages.settings.account.title")}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Button variant="contained" color="error" onClick={handleLogout}>
              {t("menu.logout")}
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

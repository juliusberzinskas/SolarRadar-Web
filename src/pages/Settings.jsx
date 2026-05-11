import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import {
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
import PageHeader from "../components/PageHeader";
import { useAppTheme } from "../contexts/ThemeContext";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useAppTheme();
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

  return (
    <Box>
      <PageHeader
        title={t("pages.settings.title")}
        subtitle={t("pages.settings.subtitle")}
      />

      <Stack spacing={2}>
        {/* Appearance */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography fontWeight={800} sx={{ mb: 2 }}>
              {t("pages.settings.appearance.title")}
            </Typography>

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" gap={1.5}>
                {darkMode
                  ? <DarkModeIcon sx={{ color: "primary.main" }} />
                  : <LightModeIcon sx={{ color: "warning.main" }} />
                }
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

        {/* Language */}
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

        {/* Account */}
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

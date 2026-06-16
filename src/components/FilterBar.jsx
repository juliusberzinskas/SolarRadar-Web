import { Box, Button, Paper, Stack, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";

// priklauso visiem page
export default function FilterBar({ search, onSearchChange, children, onReset }) {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 1.5, borderRadius: 2, mb: 2 }} variant="outlined">
      <Stack direction={{ xs: "column", md: "row" }} gap={1.5} alignItems={{ xs: "stretch", md: "center" }}>
        <TextField
          size="small"
          label={t("common.search")}
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ minWidth: { xs: "100%", md: 320 } }}
        />

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" gap={1} flexWrap="wrap">
          {children}
          <Button variant="outlined" onClick={onReset}>
            {t("common.reset")}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
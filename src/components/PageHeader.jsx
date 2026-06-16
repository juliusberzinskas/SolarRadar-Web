import { Box, Button, Stack, Typography } from "@mui/material";

export default function PageHeader({
  title,
  subtitle,
  actions, // keisti i custom buttonus
  primaryAction, 
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        gap={2}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        <Stack direction="row" gap={1} flexWrap="wrap">
          {actions}
          {primaryAction && (
            <Button
              variant="contained"
              startIcon={primaryAction.icon}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
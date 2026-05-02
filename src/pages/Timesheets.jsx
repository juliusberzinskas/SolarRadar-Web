import { Alert, Box, Typography } from "@mui/material";

export default function Timesheets() {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
        Darbo laikas
      </Typography>

      <Alert severity="info">
        vėliau
      </Alert>
    </Box>
  );
}

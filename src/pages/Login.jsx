import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

// firebase error codes i LT
function friendlyError(code) {
  const map = {
    "auth/invalid-credential":       "Neteisingas el. paštas arba slaptažodis.",
    "auth/wrong-password":           "Neteisingas slaptažodis.",
    "auth/user-not-found":           "Vartotojas su tokiu el. paštu nerastas.",
    "auth/invalid-email":            "Neteisingas el. pašto formatas.",
    "auth/too-many-requests":        "Per daug bandymų. Bandykite vėliau.",
    "auth/network-request-failed":   "Tinklo klaida. Patikrinkite interneto ryšį.",
    "auth/user-disabled":            "Ši paskyra išjungta.",
  };
  return map[code] || "Prisijungimo klaida. Bandykite dar kartą.";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [signing, setSigning] = useState(false);

  const { isAdmin, isDemo, loading } = useAuth();

  if (!loading && (isAdmin || isDemo)) {
    return <Navigate to="/dashboard" replace />;
  }

  const onLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setSigning(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // is admin true nukreipia, nereikia navigate()
    } catch (error) {
      setErr(friendlyError(error.code));
      setSigning(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #0b1a33 0%, #1a3a6e 60%, #0d2248 100%)",
        px: 2,
      }}
    >
      <Paper
        elevation={12}
        sx={{
          width: "100%",
          maxWidth: 420,
          borderRadius: "20px",
          overflow: "hidden",
        }}
      >
        {/* top bar isvaisd */}
        <Box
          sx={{
            height: 6,
            background: "linear-gradient(90deg, #1976d2, #42a5f5)",
          }}
        />

        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Branding */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <TrackChangesIcon sx={{ fontSize: 36, color: "primary.main" }} />
            <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>
              SolarRadar
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Administratoriaus prisijungimas
          </Typography>

          <Divider sx={{ mb: 3 }} />

          {/* Form */}
          <form onSubmit={onLogin}>
            <TextField
              label="El. paštas"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoComplete="email"
              autoFocus
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Slaptažodis"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              autoComplete="current-password"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            {err && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {err}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={signing}
              startIcon={signing ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ py: 1.4, fontWeight: 700, fontSize: "1rem" }}
            >
              {signing ? "Jungiamasi..." : "Prisijungti"}
            </Button>
          </form>

          {/* Footer */}
          <Typography
            variant="caption"
            color="text.disabled"
            display="block"
            textAlign="center"
            sx={{ mt: 3 }}
          >
            SolarRdar © Julius {new Date().getFullYear()}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

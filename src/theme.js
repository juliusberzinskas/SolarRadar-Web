import { createTheme, alpha } from "@mui/material/styles";

const BLUE       = "#3b82f6";
const BLUE_LIGHT = "#60a5fa";

export function createAppTheme(dark) {
  return createTheme({
    palette: {
      mode: dark ? "dark" : "light",
      primary: {
        main:         dark ? BLUE_LIGHT : BLUE,
        light:        "#93c5fd",
        dark:         "#2563eb",
        contrastText: "#ffffff",
      },
      ...(dark
        ? {
            background: { default: "#0f172a", paper: "#1e293b" },
            text:       { primary: "#e2e8f0", secondary: "#94a3b8" },
            divider:    "rgba(255,255,255,0.08)",
          }
        : {
            background: { default: "#f0f4f8", paper: "#ffffff" },
            text:       { primary: "#0f172a", secondary: "#64748b" },
            divider:    "rgba(0,0,0,0.08)",
          }),
    },

    shape: { borderRadius: 12 },

    typography: {
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    },

    components: {
      // ── Global ────────────────────────────────────────────────────────────────
      MuiCssBaseline: {
        styleOverrides: {
          body: { transition: "background-color 0.25s ease" },
        },
      },

      // ── Paper / Card ──────────────────────────────────────────────────────────
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            ...(dark && {
              boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.45)",
              "&.MuiPaper-outlined": { borderColor: "rgba(255,255,255,0.08)" },
            }),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            ...(dark
              ? {
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)",
                }
              : {
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.04)",
                }),
          },
        },
      },

      // ── Buttons ───────────────────────────────────────────────────────────────
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            transition: "all 0.2s ease",
          },
          containedPrimary: {
            boxShadow: `0 2px 8px ${alpha(dark ? BLUE_LIGHT : BLUE, 0.35)}`,
            "&:hover": {
              boxShadow: `0 4px 20px ${alpha(dark ? BLUE_LIGHT : BLUE, 0.55)}`,
              transform: "translateY(-1px)",
            },
            "&:active": { transform: "translateY(0)" },
          },
          outlinedPrimary: {
            "&:hover": { backgroundColor: alpha(dark ? BLUE_LIGHT : BLUE, 0.08) },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { transition: "background-color 0.2s ease, color 0.2s ease" },
        },
      },

      // ── AppBar ────────────────────────────────────────────────────────────────
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            ...(dark
              ? {
                  backgroundColor: "#1e293b",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.4)",
                }
              : {
                  backgroundColor: "#ffffff",
                  borderBottom: "1px solid rgba(0,0,0,0.07)",
                  boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)",
                }),
          },
        },
      },

      // ── Dialogs ───────────────────────────────────────────────────────────────
      MuiDialog: {
        styleOverrides: {
          paper: dark
            ? {
                backgroundImage: "none",
                backgroundColor: "#1e293b",
                boxShadow: "0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
              }
            : {},
        },
      },

      // ── Inputs ────────────────────────────────────────────────────────────────
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: dark
            ? { borderColor: "rgba(255,255,255,0.14)" }
            : {},
          root: dark
            ? {
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.28)",
                },
              }
            : {},
        },
      },

      // ── Misc ──────────────────────────────────────────────────────────────────
      MuiDivider: {
        styleOverrides: {
          root: dark ? { borderColor: "rgba(255,255,255,0.08)" } : {},
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500 },
          outlinedPrimary: dark
            ? { borderColor: alpha(BLUE_LIGHT, 0.5), color: BLUE_LIGHT }
            : {},
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: dark
            ? {
                backgroundColor: "#334155",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }
            : {},
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: dark ? { backgroundColor: "rgba(255,255,255,0.1)" } : {},
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: dark ? { borderColor: "rgba(255,255,255,0.07)" } : {},
        },
      },
      MuiSwitch: {
        styleOverrides: {
          track: dark ? { backgroundColor: "rgba(255,255,255,0.2)" } : {},
        },
      },
    },
  });
}

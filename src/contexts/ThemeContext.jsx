import { createContext, useContext, useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { createAppTheme } from "../theme";

const ThemeCtx = createContext({ darkMode: false, toggleDarkMode: () => {} });

export const useAppTheme = () => useContext(ThemeCtx);

export function AppThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true"
  );

  const toggleDarkMode = () =>
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("darkMode", String(next));
      return next;
    });

  const theme = useMemo(() => createAppTheme(darkMode), [darkMode]);

  return (
    <ThemeCtx.Provider value={{ darkMode, toggleDarkMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeCtx.Provider>
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./i18n";

import { AuthProvider } from "./contexts/AuthContext.jsx";
import { AppThemeProvider } from "./contexts/ThemeContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppThemeProvider>
  </React.StrictMode>
);

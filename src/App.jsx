import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import AdminRoute from "./components/AdminRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sites from "./pages/Sites";
import SiteDetail from "./pages/SiteDetail";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Members from "./pages/Members";
import Timesheets from "./pages/Timesheets";
import Reports from "./pages/Reports";
import ReportDetail from "./pages/ReportDetail";
import Settings from "./pages/Settings";
import Import from "./pages/Import";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* visi admin puslapiai saugomi AdminRoute */}
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sites" element={<Sites />} />
          <Route path="/sites/:siteId" element={<SiteDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />
          <Route path="/members" element={<Members />} />
          <Route path="/timesheets" element={<Timesheets />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:reportId" element={<ReportDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import" element={<Import />} />
        </Route>

        {/* 404 catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

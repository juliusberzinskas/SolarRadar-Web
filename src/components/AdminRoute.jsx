import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AdminRoute({ children }) {
  const { user, isAdmin, isDemo, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Kraunama...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin && !isDemo) return <Navigate to="/login" replace />;

  return children;
}



// prideti veliau loading vaizda !!!!!!!!!
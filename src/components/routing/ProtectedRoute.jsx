import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FullScreenLoader } from "../ui";
import NoAccess from "../../pages/NoAccess";

// Gate for every signed-in route: wait for Firebase Auth, send signed-out
// visitors to /login, and stop signed-in accounts that aren't leaders.
export default function ProtectedRoute() {
  const { user, hasAccess, loading, signedOut } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  // Remember where a visitor was headed so sign-in can take them there —
  // unless they just signed out on purpose.
  if (!user) return <Navigate to="/login" replace state={signedOut ? null : { from: location.pathname }} />;
  if (!hasAccess) return <NoAccess />;

  return <Outlet />;
}

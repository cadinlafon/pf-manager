import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import Sidebar from "../navigation/Sidebar";
import BottomNav from "../navigation/BottomNav";
import { useAuth } from "../../context/AuthContext";
import { AnnouncementsProvider } from "../../context/AnnouncementsContext";

// Shell for every signed-in page: sidebar on desktop, bottom nav on mobile.
export default function AppLayout() {
  const { isPreview } = useAuth();

  return (
    <AnnouncementsProvider>
      <div className="shell">
        <Sidebar />
        <div className="shell-main">
          {isPreview && (
            <div className="preview-banner">Preview mode — not signed in. Development only.</div>
          )}
          <TopBar />
          <main className="page">
            <Outlet />
          </main>
        </div>
        <BottomNav />
      </div>
    </AnnouncementsProvider>
  );
}

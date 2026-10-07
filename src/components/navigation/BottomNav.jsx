import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import Modal from "../ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { MORE_ITEMS, PRIMARY_ITEMS } from "./navItems";

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  // Close the More sheet whenever the route changes.
  useEffect(() => setMoreOpen(false), [pathname]);

  const moreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.path));

  return (
    <>
      <nav className="bottom-nav" aria-label="Main">
        {PRIMARY_ITEMS.map((item) => {
          const Icon = item.icon;
          if (item.unavailable) {
            return (
              <span key={item.path} className="bottom-link unavailable" aria-disabled="true" title={`${item.label} is unavailable`}>
                <span className="pill"><Icon size={20} aria-hidden /></span>
                <span>Unavailable</span>
              </span>
            );
          }
          return (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `bottom-link${isActive ? " active" : ""}`}>
              <span className="pill"><Icon size={20} aria-hidden /></span>
              <span>{item.short}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          className={`bottom-link${moreActive || moreOpen ? " active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="pill"><Menu size={20} aria-hidden /></span>
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <Modal title="More" onClose={() => setMoreOpen(false)}>
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.path} type="button" className="menu-item" onClick={() => navigate(item.path)}>
                <Icon size={18} aria-hidden />
                <span style={{ flex: 1 }}>{item.label}</span>
                <ChevronRight size={16} aria-hidden />
              </button>
            );
          })}
          <button type="button" className="menu-item danger" onClick={signOut}>
            <LogOut size={18} aria-hidden />
            Sign out
          </button>
        </Modal>
      )}
    </>
  );
}

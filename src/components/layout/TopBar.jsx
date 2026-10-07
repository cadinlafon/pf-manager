import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import Brand from "../navigation/Brand";
import { titleForPath } from "../navigation/navItems";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { timeAgo, useAnnouncements } from "../../context/AnnouncementsContext";
import { LEADER_ROLES } from "../../firebase/collections";

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
}

// A button with a dropdown that closes on outside click, Escape, or navigation.
function Dropdown({ button, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu-wrap" ref={ref}>
      {button({ open, toggle: () => setOpen((value) => !value) })}
      {open && <div className="menu" role="menu">{children}</div>}
    </div>
  );
}

export default function TopBar() {
  const { pathname } = useLocation();
  const { user, name, role, signOut } = useAuth();
  const { preference, cycleTheme } = useTheme();
  const ThemeIcon = THEME_ICONS[preference];
  const { notifications, unreadCount, markAllSeen } = useAnnouncements();
  const [freshKeys, setFreshKeys] = useState(() => new Set());

  return (
    <header className="topbar">
      <Brand />
      <h1 className="topbar-title">{titleForPath(pathname)}</h1>

      <div className="topbar-actions">
        <button type="button" className="icon-btn" onClick={cycleTheme} aria-label={`Theme: ${preference}. Change theme`} title={`Theme: ${preference}`}>
          <ThemeIcon size={18} />
        </button>

        <Dropdown
          button={({ open, toggle }) => (
            <button
              type="button"
              className="icon-btn"
              aria-expanded={open}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              onClick={() => {
                // Remember what was unread for this opening, then mark everything seen.
                if (!open) {
                  setFreshKeys(new Set(notifications.filter((event) => event.unread).map((event) => event.key)));
                  markAllSeen();
                }
                toggle();
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="notif-dot" aria-hidden />}
            </button>
          )}
        >
          <div className="menu-head" style={{ marginBottom: 0 }}>
            <strong>Notifications</strong>
          </div>
          {notifications.length === 0 ? (
            <div className="menu-empty">
              <strong>No notifications</strong>
              <br />
              Announcements and comments from managers will show up here.
            </div>
          ) : (
            <div className="notif-list">
              {notifications.slice(0, 6).map((event) => (
                <Link
                  key={event.key}
                  to="/announcements"
                  state={{ focus: event.item.id, openComments: event.type === "comment" }}
                  className={`notif-item${freshKeys.has(event.key) ? " unread" : ""}`}
                  role="menuitem"
                >
                  {event.type === "comment" ? (
                    <>
                      <span className="notif-title">{event.byName || "A manager"} commented</span>
                      <span className="notif-body">on “{event.item.title}”</span>
                    </>
                  ) : (
                    <>
                      <span className="notif-title">{event.item.title}</span>
                      <span className="notif-body">{event.item.body}</span>
                    </>
                  )}
                  <span className="notif-meta">
                    {event.type === "post" && `${event.byName || "A manager"} · `}{timeAgo(event.at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <Link to="/announcements" className="menu-item" role="menuitem" style={{ justifyContent: "center", color: "var(--accent-strong)" }}>
            View all announcements
          </Link>
        </Dropdown>

        <Dropdown
          button={({ open, toggle }) => (
            <button type="button" className="user-btn" onClick={toggle} aria-label="Account menu" aria-expanded={open}>
              <span className="avatar">{initials(name)}</span>
              <span className="user-btn-name">{name}</span>
            </button>
          )}
        >
          <div className="menu-head">
            <strong>{name}</strong>
            <span>{user?.email}</span>
            <span>{LEADER_ROLES[role]}</span>
          </div>
          <Link to="/settings" className="menu-item" role="menuitem">
            <Settings size={16} aria-hidden />
            Settings
          </Link>
          <button type="button" className="menu-item danger" role="menuitem" onClick={signOut}>
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </Dropdown>
      </div>
    </header>
  );
}

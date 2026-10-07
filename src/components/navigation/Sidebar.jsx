import { Fragment } from "react";
import { NavLink, useLocation } from "react-router-dom";
import Brand from "./Brand";
import { NAV_ITEMS, NAV_SECTIONS } from "./navItems";

function SidebarLink({ item }) {
  const { pathname } = useLocation();
  const Icon = item.icon;
  if (item.unavailable) {
    return (
      <span className="sidebar-link unavailable" aria-disabled="true">
        <Icon size={18} aria-hidden />
        {item.label}
        <span className="nav-tag">Unavailable</span>
      </span>
    );
  }
  // A section with sub-pages opens its list while you're anywhere inside it.
  const open = Boolean(item.children) && pathname.startsWith(item.path);
  return (
    <>
      <NavLink to={item.path} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`} aria-expanded={item.children ? open : undefined}>
        <Icon size={18} aria-hidden />
        {item.label}
      </NavLink>
      {open && (
        <div className="sidebar-sub">
          {item.children.map((child) => (
            <NavLink key={child.path} to={child.path} end={child.end} className={({ isActive }) => `sidebar-sublink${isActive ? " active" : ""}`}>
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

export default function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Main">
      <Brand />
      {NAV_SECTIONS.map((section) => (
        <Fragment key={section}>
          <div className="sidebar-section">{section}</div>
          {NAV_ITEMS.filter((item) => item.section === section).map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </Fragment>
      ))}
      <div className="sidebar-foot">Palouse Fellowship Management</div>
    </nav>
  );
}

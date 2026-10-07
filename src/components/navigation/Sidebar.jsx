import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import Brand from "./Brand";
import { NAV_ITEMS, NAV_SECTIONS } from "./navItems";

function SidebarLink({ item }) {
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
  return (
    <NavLink to={item.path} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
      <Icon size={18} aria-hidden />
      {item.label}
    </NavLink>
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

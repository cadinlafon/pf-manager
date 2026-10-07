import { NavLink } from "react-router-dom";
import { PEOPLE_SECTIONS } from "../navigation/navItems";

// All People / Members / Groups. On desktop these live in the sidebar under
// People, so this strip only shows on phones and tablets, where there is no sidebar.
export default function PeopleTabs() {
  return (
    <nav className="subnav" aria-label="People sections">
      {PEOPLE_SECTIONS.map((section) => (
        <NavLink key={section.path} to={section.path} end={section.end} className={({ isActive }) => (isActive ? "active" : "")}>
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}

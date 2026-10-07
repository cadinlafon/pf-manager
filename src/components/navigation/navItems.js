import { Bookmark, CalendarDays, ClipboardList, HeartHandshake, Home, Mail, Megaphone, Package, Settings, Users, Wallet } from "lucide-react";
import { FINANCE_ENABLED } from "../../lib/features";

// `end` = only active on exactly that address (otherwise /people would also
// light up for /people/members).
export const PEOPLE_SECTIONS = [
  { path: "/people", label: "All People", end: true },
  { path: "/people/members", label: "Members" },
  { path: "/people/groups", label: "Groups" },
];

// Single source of truth for navigation. `primary` items sit in the mobile
// bottom bar; the rest go under its More menu. The desktop sidebar shows all,
// grouped by `section`. An `unavailable` item is shown greyed out and can't be opened.
export const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", short: "Home", icon: Home, section: "Manage", primary: true },
  { path: "/calendar", label: "Calendar", short: "Calendar", icon: CalendarDays, section: "Manage", primary: true },
  { path: "/finance", label: "Finance", short: "Finance", icon: Wallet, section: "Manage", primary: true, unavailable: !FINANCE_ENABLED },
  {
    path: "/people", label: "People", short: "People", icon: Users, section: "Manage", primary: true,
    // Shown indented under People in the sidebar while you're in that section
    // (and as tabs at the top of those pages on phones).
    children: PEOPLE_SECTIONS,
  },
  { path: "/inventory", label: "Inventory", short: "Inventory", icon: Package, section: "Manage", primary: true },
  { path: "/saved", label: "Saved", icon: Bookmark, section: "Manage" },
  { path: "/forms", label: "Signup Forms", icon: ClipboardList, section: "Forms" },
  { path: "/volunteers", label: "Volunteers", icon: HeartHandshake, section: "Forms" },
  { path: "/announcements", label: "Announcements", icon: Megaphone, section: "More" },
  { path: "/email-list", label: "Email List", icon: Mail, section: "More" },
  { path: "/settings", label: "Settings", icon: Settings, section: "More" },
];

export const NAV_SECTIONS = ["Manage", "Forms", "More"];
export const PRIMARY_ITEMS = NAV_ITEMS.filter((item) => item.primary);
export const MORE_ITEMS = NAV_ITEMS.filter((item) => !item.primary);

export function titleForPath(pathname) {
  return NAV_ITEMS.find((item) => pathname.startsWith(item.path))?.label || "PF Management";
}

// Shared logic for volunteer signups (leader pages and the public page).

export const STATUS_FILTERS = ["All", "Open", "Full", "Closed", "Past", "Draft"];

export function newPosition(name = "", spotsNeeded = 1, description = "") {
  // IDs are used as Firestore field names (filledCounts.<id>), so keep them alphanumeric.
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return { id, name, description, spotsNeeded };
}

const todayString = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD

export function filledFor(signup, positionId) {
  return Math.max(0, signup.filledCounts?.[positionId] || 0);
}

export function totals(signup) {
  const needed = signup.positions.reduce((sum, p) => sum + p.spotsNeeded, 0);
  const filled = signup.positions.reduce((sum, p) => sum + Math.min(filledFor(signup, p.id), p.spotsNeeded), 0);
  return { needed, filled, available: Math.max(0, needed - filled), percent: needed ? Math.round((filled / needed) * 100) : 0 };
}

// What leaders see. Stored status is only "open" | "closed" | "draft";
// Past and Full are worked out from the date and the counts.
export function displayStatus(signup) {
  if (signup.status === "draft") return "Draft";
  if (signup.date < todayString()) return "Past";
  if (signup.status === "closed") return "Closed";
  const { needed, filled } = totals(signup);
  return needed > 0 && filled >= needed ? "Full" : "Open";
}

export function formatDate(date) {
  if (!date) return "";
  return new Date(`${date}T00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function formatTime(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatTimeRange({ startTime, endTime }) {
  if (!startTime) return "";
  return endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : formatTime(startTime);
}

// Upcoming first (soonest at the top), then past ones (most recent first).
export function sortSignups(signups) {
  const today = todayString();
  const key = (s) => `${s.date} ${s.startTime || ""}`;
  const upcoming = signups.filter((s) => s.date >= today).sort((a, b) => key(a).localeCompare(key(b)));
  const past = signups.filter((s) => s.date < today).sort((a, b) => key(b).localeCompare(key(a)));
  return [...upcoming, ...past];
}

export function validateSignup({ title, date, startTime, endTime, positions }) {
  if (!title.trim()) return "Give the signup a title.";
  if (!date) return "Choose a date.";
  if (startTime && endTime && endTime <= startTime) return "The end time needs to be after the start time.";
  if (endTime && !startTime) return "Add a start time, or clear the end time.";
  if (positions.length === 0) return "Add at least one position.";
  if (positions.some((p) => !p.name.trim())) return "Every position needs a name.";
  return null;
}

export function volunteerPath(id) {
  return `/volunteer/${id}`;
}

export function volunteerUrl(id) {
  const base = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${base.replace(/\/$/, "")}${volunteerPath(id)}`;
}

// Demo records for dev preview mode only (see src/firebase/volunteers.js).
// Dates are relative to today so they always look current.
export function demoSignups() {
  const inDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-CA");
  };
  const build = (base, positions, people) => {
    const made = positions.map(([name, spots, description]) => newPosition(name, spots, description));
    const volunteers = [];
    const filledCounts = {};
    made.forEach((position, i) => {
      filledCounts[position.id] = people[i].length;
      people[i].forEach((name) => volunteers.push({ positionId: position.id, name: `${name} (demo)`, email: "", phone: "" }));
    });
    return { signup: { ...base, positions: made, filledCounts, allowCancellation: true }, volunteers };
  };
  return [
    build(
      { title: "Fellowship Dinner Volunteers (Demo)", description: "Help us prepare, serve, and clean up after the fellowship dinner.", date: inDays(11), startTime: "17:00", endTime: "19:30", location: "Fellowship Hall", status: "open" },
      [["Setup", 4, "Help arrange tables and chairs."], ["Food Service", 3, "Serve the meal."], ["Cleanup", 4, "Wash up and put the room back."], ["Greeters", 2, "Welcome people at the door."]],
      [["Jane S.", "John S.", "Sarah J."], ["Ann P.", "Lee M.", "Kim R."], ["Bob J."], ["Pat T.", "Sam W."]]
    ),
    build(
      { title: "Fall Work Day (Demo)", description: "Getting the building and grounds ready for winter.", date: inDays(25), startTime: "09:00", endTime: "", location: "Church Grounds", status: "open" },
      [["Landscaping", 5, ""], ["Cleaning", 5, ""], ["Setup", 5, ""]],
      [["Jane S.", "John S."], ["Bob J."], ["Ann P."]]
    ),
  ];
}

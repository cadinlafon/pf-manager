// Helpers for the embedded Google Calendar.
//
// Leaders paste whatever Google gives them (embed code, a calendar link, or a
// calendar ID). We never render what they paste: we pull the calendar ID(s)
// out, check them, and build our own embed URL from scratch.

const CALENDAR_ID = /^[^\s@<>"'&?/]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export const VIEW_MODES = [
  { value: "MONTH", label: "Month" },
  { value: "WEEK", label: "Week" },
  { value: "AGENDA", label: "Schedule" },
];

export const SIZES = [
  { value: "compact", label: "Compact", height: 460 },
  { value: "medium", label: "Medium", height: 640 },
  { value: "large", label: "Large", height: 860 },
];

export const WEEK_STARTS = [
  { value: "1", label: "Sunday" },
  { value: "2", label: "Monday" },
];

export const DEFAULT_DISPLAY = { mode: "MONTH", size: "medium", weekStart: "1" };

// "Add to calendar" links carry the ID base64-encoded in ?cid=, with Google's
// shorthand for its long domains.
function decodeCid(cid) {
  if (cid.includes("@")) return cid;
  try {
    const padded = cid.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(cid.length / 4) * 4, "=");
    return atob(padded)
      .replace(/@g$/, "@group.calendar.google.com")
      .replace(/@m$/, "@gmail.com");
  } catch {
    return "";
  }
}

// Returns { calendarIds, timezone } or { error }.
export function parseCalendarInput(raw) {
  const text = (raw || "").trim();
  if (!text) return { error: "Paste the calendar's embed code or URL first." };

  // Embed code: take the iframe's src.
  const iframeSrc = text.match(/src\s*=\s*["']([^"']+)["']/i);
  const candidate = (iframeSrc ? iframeSrc[1] : text).replace(/&amp;/g, "&").trim();

  let ids = [];
  let timezone = "";

  if (/^https?:\/\//i.test(candidate)) {
    let url;
    try {
      url = new URL(candidate);
    } catch {
      return { error: "That doesn't look like a complete link. Copy it again from Google Calendar." };
    }
    if (!/(^|\.)google\.com$/i.test(url.hostname)) {
      return { error: "That isn't a Google Calendar link. Copy it from Settings and sharing → Integrate calendar." };
    }
    ids = url.searchParams.getAll("src");
    const cid = url.searchParams.get("cid");
    if (cid) ids.push(decodeCid(cid));
    const ical = url.pathname.match(/\/calendar\/ical\/([^/]+)\//);
    if (ical) ids.push(decodeURIComponent(ical[1]));
    timezone = url.searchParams.get("ctz") || "";
  } else {
    ids = [candidate];
  }

  const calendarIds = [...new Set(ids.map((id) => id.trim()))].filter((id) => CALENDAR_ID.test(id));
  if (calendarIds.length === 0) {
    return {
      error: "Couldn't find a calendar in that. Paste the Embed code, the Public URL, or the Calendar ID from Integrate calendar.",
    };
  }

  return {
    calendarIds,
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  };
}

export function buildEmbedUrl({ calendarIds, timezone }, display = DEFAULT_DISPLAY) {
  const params = new URLSearchParams();
  calendarIds.forEach((id) => params.append("src", id));
  if (timezone) params.set("ctz", timezone);
  params.set("mode", display.mode);
  params.set("wkst", display.weekStart);
  params.set("showTitle", "0");
  params.set("showPrint", "0");
  params.set("showCalendars", "0");
  params.set("showTabs", "0");
  params.set("showTz", "0");
  return `https://calendar.google.com/calendar/embed?${params}`;
}

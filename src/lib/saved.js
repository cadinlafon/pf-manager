// Shared definitions and logic for the Saved resource library.
import { File, FileText, Image, Link2, Lock, StickyNote, UserRound, Users } from "lucide-react";
import { domainOf } from "./format";

// `addLabel` is the wording in the "What would you like to save?" menu.
export const TYPES = {
  link: { label: "Link", plural: "Links", addLabel: "Link", hint: "A website address", icon: Link2 },
  document: { label: "Document", plural: "Documents", addLabel: "Upload Document", hint: "PDF, Word, Excel, PowerPoint, text", icon: FileText },
  note: { label: "Note", plural: "Notes", addLabel: "Note", hint: "Text you write here", icon: StickyNote },
  image: { label: "Image", plural: "Images", addLabel: "Image", hint: "A photo or picture", icon: Image },
  file: { label: "File", plural: "Files", addLabel: "File", hint: "Any other file", icon: File },
};
export const TYPE_ORDER = ["link", "document", "note", "image", "file"];
export const isFileType = (type) => type === "document" || type === "image" || type === "file";

// Stored by name, so the list can grow (or become custom) later without
// touching saved records.
export const CATEGORIES = [
  "Administration", "Finance", "Members", "Volunteers", "Worship", "Children's Ministry", "Youth",
  "Events", "Facilities", "Policies", "Resources", "Forms", "Inventory", "Other",
];

export const VISIBILITY = {
  personal: { label: "Personal", hint: "Only you", icon: UserRound },
  leaders: { label: "Managers", hint: "Every manager", icon: Users },
  admins: { label: "Main Admins", hint: "Main admins only", icon: Lock },
};

// ── Files ────────────────────────────────────────────────────────────
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods", "odp", "pages", "numbers", "key"];
// Programs and web pages could run code when opened, so they are never
// accepted. The Storage rules enforce the same list.
const BLOCKED_EXTENSIONS = [
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl", "js", "mjs", "jse", "vbs", "vbe", "wsf", "ps1", "sh", "bash", "command",
  "app", "dmg", "pkg", "deb", "rpm", "jar", "apk", "ipa", "html", "htm", "xhtml", "svg", "php", "py", "rb", "pl", "dll", "sys", "lnk", "reg", "hta",
];

export const FILE_ACCEPT = {
  document: DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(","),
  image: "image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif,image/bmp",
  file: "",
};

const extensionOf = (name) => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

// Returns a message if this file can't be saved as `type`, otherwise null.
export function fileProblem(file, type) {
  const ext = extensionOf(file.name);
  if (file.size > MAX_FILE_BYTES) return "That file is larger than 25 MB.";
  if (file.size === 0) return "That file is empty.";
  if (BLOCKED_EXTENSIONS.includes(ext) || /^(text\/html|image\/svg|application\/javascript|text\/javascript)/.test(file.type)) {
    return "Programs and web pages can't be saved here, for safety.";
  }
  if (type === "document" && !DOCUMENT_EXTENSIONS.includes(ext)) return "That isn't a document type. Choose File instead to save it.";
  if (type === "image" && !file.type.startsWith("image/")) return "That isn't an image. Choose Document or File instead.";
  return null;
}

// Keep the name readable but safe to use in a storage path.
export function safeFileName(name) {
  return name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || "file";
}

export function canPreview(resource) {
  if (resource.type === "image") return "image";
  if (resource.fileType === "application/pdf" || extensionOf(resource.fileName || "") === "pdf") return "pdf";
  return null;
}

// ── Tags ─────────────────────────────────────────────────────────────
// "Finance, #2026 policy" → ["finance", "2026", "policy"]
export function parseTags(text) {
  const tags = (text || "")
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9-_]/g, ""))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 12);
}

// ── Permissions (the security rules enforce the same thing) ──────────
export function canManage(resource, uid, role) {
  return resource.createdBy === uid || (role === "main_admin" && resource.visibility !== "personal");
}
export const canPin = (resource, role) => role === "main_admin" && resource.visibility !== "personal";

// ── Search + filters ─────────────────────────────────────────────────
export function searchText(resource) {
  return [
    resource.title, resource.description, resource.category, resource.fileName, resource.url, domainOf(resource.url || ""),
    resource.type === "note" ? resource.content : "", ...(resource.tags || []).map((tag) => `#${tag}`),
  ].filter(Boolean).join(" ").toLowerCase();
}

export const EMPTY_FILTERS = { view: "all", type: "all", category: "all", visibility: "all", favorites: false, pinned: false, tag: "" };

export function matchesFilters(resource, filters, { uid, favorites, search }) {
  if (filters.view === "mine" && resource.createdBy !== uid) return false;
  if (filters.view === "church" && resource.visibility === "personal") return false;
  if (filters.type !== "all" && resource.type !== filters.type) return false;
  if (filters.category !== "all" && resource.category !== filters.category) return false;
  if (filters.visibility !== "all" && resource.visibility !== filters.visibility) return false;
  if (filters.favorites && !favorites.has(resource.id)) return false;
  if (filters.pinned && !resource.pinned) return false;
  if (filters.tag && !(resource.tags || []).includes(filters.tag)) return false;
  // Every word typed must appear somewhere.
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    const text = searchText(resource);
    if (!words.every((word) => text.includes(word))) return false;
  }
  return true;
}

// Pinned first, then most recently updated.
export function sortSaved(resources) {
  return [...resources].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.updatedAt || 0) - (a.updatedAt || 0));
}

export const savedPath = (id) => `/saved/${id}`;
export function savedUrl(id) {
  const base = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${base.replace(/\/$/, "")}${savedPath(id)}`;
}

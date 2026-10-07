// Small formatting helpers shared across pages.

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatMoney = (amount) => currency.format(amount);
export const formatSignedMoney = (amount) => `${amount >= 0 ? "+" : "−"}${currency.format(Math.abs(amount))}`;

// Local date as YYYY-MM-DD (toISOString() would give the UTC date).
export const todayString = () => new Date().toLocaleDateString("en-CA");

// "2026-10-05" → "Oct 5" (adds the year when it isn't this year).
export function formatDay(date) {
  if (!date) return "";
  const d = new Date(`${date}T00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

// Download rows (arrays of cells) as a CSV file.
export function downloadCsv(filename, rows) {
  // Prefix cells a spreadsheet would run as a formula, then quote everything.
  const cell = (value) => {
    const text = String(value ?? "");
    return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Only ever link to http(s) addresses. Returns the cleaned URL, or null if the
// text isn't a usable web address.
export function normalizeUrl(input) {
  const text = (input || "").trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

// "https://www.tithe.ly/give" → "tithe.ly"
export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

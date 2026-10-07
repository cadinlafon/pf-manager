// Feature switches, set in the .env file (see .env.example). Vite reads .env
// when the dev server starts or the app is built, so restart / rebuild after
// changing one.

// VITE_FINANCE_ENABLED=false turns the Finance page off: it stays in the
// navigation marked "Unavailable" but can't be opened. Anything other than
// the word false (including leaving it unset) keeps Finance on.
export const FINANCE_ENABLED = String(import.meta.env.VITE_FINANCE_ENABLED ?? "true").trim().toLowerCase() !== "false";

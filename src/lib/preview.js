// Development-only: `npm run dev:preview` renders the app with a stand-in
// leader so the UI can be worked on without signing in. import.meta.env.DEV is
// false in production builds, so this can never be switched on there.
export const PREVIEW = import.meta.env.DEV && import.meta.env.VITE_AUTH_PREVIEW === "1";

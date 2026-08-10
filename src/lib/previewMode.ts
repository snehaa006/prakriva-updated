// Shared helper for the dev-only preview bypass wired in
// `src/context/AppContext.tsx`. When active, that bypass signs in a fake
// patient (`id: "preview-patient"`) without touching Supabase auth — so real
// data-fetching hooks scoped to `user.id` come back empty everywhere.
//
// Pages/hooks that want to show realistic content in that state should
// short-circuit their data fetch with `isPreviewMode()` *before* the real
// Supabase call, and leave the real path completely untouched for everyone
// else. Mirrors the exact condition in AppContext's preview-bypass effect —
// keep these in sync if that ever changes.
export const isPreviewMode = (): boolean =>
  import.meta.env.DEV &&
  (localStorage.getItem("prakriva_preview_bypass") ?? "patient") === "patient";

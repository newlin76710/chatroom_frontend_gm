const ANL = parseInt(import.meta.env.VITE_ADMIN_MIN_LEVEL, 10) || 91;
export function expForNextLevel(level) { const MAX_LEVEL = ANL-1; level = Math.min(level, MAX_LEVEL); return Math.floor(120 * level * level + 200); }

export const safeText = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    if (v.text) return String(v.text);
    if (v.name) return String(v.name);
    if (v.user) return String(v.user);
    if (v.message) return String(v.message);
    return JSON.stringify(v);
  }
  return String(v);
};
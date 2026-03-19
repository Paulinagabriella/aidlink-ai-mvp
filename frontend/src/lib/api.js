// frontend/src/lib/api.js
export const API = "/api";

// Safe JSON fetch (clear errors instead of the "<!doctype" surprise)
export async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${txt.slice(0, 120)}`);
  }
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Expected JSON, got ${ct}. First bytes: ${txt.slice(0, 80)}`);
  }
  return res.json();
}

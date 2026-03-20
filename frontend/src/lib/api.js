export const API = "https://aidlink-ai-mvp-backend.onrender.com";

export async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${txt.slice(0, 200)}`);
  }

  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Expected JSON, got ${ct}. First bytes: ${txt.slice(0, 120)}`);
  }

  return res.json();
}
import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const API = "/api";

// ---------- helpers ----------
async function getJsonWithFallback(pathWithApiPrefix, pathNoPrefix) {
  const tryFetch = async (url) => {
    const res = await fetch(url);
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 160)}`);
    }
    if (!ct.includes("application/json")) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Expected JSON, got ${ct}. First bytes: ${txt.slice(0, 80)}`);
    }
    return res.json();
  };

  try {
    return await tryFetch(pathWithApiPrefix);
  } catch {
    return await tryFetch(pathNoPrefix);
  }
}

function normalizeCategories(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function categoryColor(cat) {
  switch (cat) {
    case "water":
      return "#1e90ff";
    case "food":
      return "#2ecc71";
    case "shelter":
      return "#f39c12";
    case "medical":
      return "#e74c3c";
    case "donation":
      return "#8e44ad";
    default:
      return "#111111";
  }
}

function makeDotMarker({ color, size = 16, border = "2px solid white" }) {
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "999px";
  el.style.background = color;
  el.style.border = border;
  el.style.boxShadow = "0 1px 6px rgba(0,0,0,0.35)";
  return el;
}

function makeStarMarker() {
  const el = document.createElement("div");
  el.style.width = "18px";
  el.style.height = "18px";
  el.style.borderRadius = "999px";
  el.style.background = "gold";
  el.style.border = "2px solid #333";
  el.style.boxShadow = "0 1px 6px rgba(0,0,0,0.35)";
  return el;
}

function LegendRow({ color, label, border = "2px solid white" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          background: color,
          border,
          boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
          display: "inline-block",
        }}
      />
      <span style={{ color: "#111" }}>{label}</span>
    </div>
  );
}

/**
 * Pick a category for a Need.
 * Priority:
 *  1) explicit categories
 *  2) infer from title/description keywords
 */
function pickCategoryFromNeed(need) {
  const cats = normalizeCategories(need?.categories).map((c) => c.toLowerCase());

  // 1) explicit categories (authoritative)
  if (cats.some((c) => c.includes("medical") || c.includes("health") || c.includes("medicine"))) return "medical";
  if (cats.some((c) => c.includes("water"))) return "water";
  if (cats.some((c) => c.includes("food"))) return "food";
  if (cats.some((c) => c.includes("shelter") || c.includes("housing"))) return "shelter";
  if (cats.some((c) => c.includes("donation") || c.includes("drop") || c.includes("donate"))) return "donation";

  // 2) infer from text (fallback)
  const text = `${need?.title ?? ""} ${need?.description ?? ""}`.toLowerCase();

  // MEDICAL keywords (this is what fixes "insulin" => red)
  if (
    text.includes("insulin") ||
    text.includes("medicine") ||
    text.includes("medication") ||
    text.includes("pharmacy") ||
    text.includes("hospital") ||
    text.includes("clinic") ||
    text.includes("doctor") ||
    text.includes("emergency") ||
    text.includes("injury") ||
    text.includes("wound") ||
    text.includes("antibiotic")
  ) {
    return "medical";
  }

  if (text.includes("water") || text.includes("drink")) return "water";
  if (text.includes("food") || text.includes("hungry") || text.includes("meal")) return "food";
  if (text.includes("shelter") || text.includes("housing") || text.includes("roof")) return "shelter";
  if (text.includes("donate") || text.includes("donation") || text.includes("drop off")) return "donation";

  return "other";
}

// ---------- component ----------
export default function MapView({ results = [], userLoc }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  const needsMarkersRef = useRef([]);
  const resultsMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);

  const [needs, setNeeds] = useState([]);
  const [mapError, setMapError] = useState("");

  const center = useMemo(() => {
    if (userLoc && typeof userLoc.lat === "number" && typeof userLoc.lng === "number") {
      return [userLoc.lng, userLoc.lat];
    }
    return [-77.8601, 40.7934];
  }, [userLoc]);

  // init map once
  useEffect(() => {
    if (mapRef.current) return;
    const container = mapContainerRef.current;
    if (!container) return;

    try {
      const map = new maplibregl.Map({
        container,
        style: "https://demotiles.maplibre.org/style.json",
        center,
        zoom: 11,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;

      setTimeout(() => {
        try {
          map.resize();
        } catch {}
      }, 0);

      return () => {
        try {
          map.remove();
        } catch {}
        mapRef.current = null;
      };
    } catch (e) {
      console.error(e);
      setMapError("Map failed to initialize. Check console for details.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // resize map if container size changes
  useEffect(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;

    const ro = new ResizeObserver(() => {
      try {
        map.resize();
      } catch {}
    });

    ro.observe(container);
    return () => {
      try {
        ro.disconnect();
      } catch {}
    };
  }, []);

  // center when userLoc changes + user marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({ center, duration: 600 });

    if (userLoc && typeof userLoc.lat === "number" && typeof userLoc.lng === "number") {
      if (!userMarkerRef.current) {
        userMarkerRef.current = new maplibregl.Marker({ element: makeStarMarker() })
          .setLngLat([userLoc.lng, userLoc.lat])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([userLoc.lng, userLoc.lat]);
      }
    }
  }, [center, userLoc]);

  // load needs
  useEffect(() => {
    let cancelled = false;

    async function loadNeeds() {
      try {
        const data = await getJsonWithFallback(`${API}/needs`, `/needs`);
        if (!cancelled) setNeeds(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn("Failed to load needs for map:", e);
        if (!cancelled) setNeeds([]);
      }
    }

    loadNeeds();
    const t = setInterval(loadNeeds, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  function clearMarkers(ref) {
    for (const m of ref.current) {
      try {
        m.remove();
      } catch {}
    }
    ref.current = [];
  }

  // draw needs markers (colored by category / inferred keywords)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    clearMarkers(needsMarkersRef);

    for (const n of needs) {
      const loc = n.location;
      if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") continue;

      const cat = pickCategoryFromNeed(n);
      const color = categoryColor(cat);
      const markerEl = makeDotMarker({ color, size: 16 });

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; min-width: 220px;">
          <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(n.title || "Need")}</div>
          <div style="font-size: 12px; color: #555; margin-bottom: 6px;">
            Category: ${escapeHtml(cat)} • Severity: ${escapeHtml(String(n.severity ?? ""))}
          </div>
          ${n.description ? `<div style="font-size: 12px; color: #333;">${escapeHtml(String(n.description))}</div>` : ""}
        </div>
      `;

      const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml))
        .addTo(map);

      needsMarkersRef.current.push(marker);
    }
  }, [needs]);

  // results markers (still shown; not in legend)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    clearMarkers(resultsMarkersRef);

    for (const r of results || []) {
      const loc = r.location;
      if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") continue;

      const markerEl = makeDotMarker({ color: "#00bcd4", size: 14, border: "2px solid #0b2230" });

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; min-width: 220px;">
          <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(r.title || "Result")}</div>
          <div style="font-size: 12px; color: #555;">
            ${r.type ? `Type: ${escapeHtml(String(r.type))}` : ""}
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml))
        .addTo(map);

      resultsMarkersRef.current.push(marker);
    }
  }, [results]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 620,
        minHeight: 520,
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.12)",
        overflow: "hidden",
        background: "#f3f4f6",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Legend (donation + nearby results removed as requested) */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 2,
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 12,
          padding: "10px 12px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          fontSize: 13,
          lineHeight: 1.2,
          maxWidth: 220,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Legend</div>
        <LegendRow color="#1e90ff" label="Water" />
        <LegendRow color="#2ecc71" label="Food" />
        <LegendRow color="#f39c12" label="Shelter" />
        <LegendRow color="#e74c3c" label="Medical" />
        <div style={{ height: 8 }} />
        <LegendRow color="gold" label="Search location" border="2px solid #333" />
      </div>

      {mapError && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            zIndex: 2,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 12,
            padding: "10px 12px",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {mapError}
        </div>
      )}
    </div>
  );
}

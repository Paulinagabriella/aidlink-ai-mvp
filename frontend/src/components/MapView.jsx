import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * MapView
 * - needs: array of Need (colored pins)
 * - highlights: [{km, org}] for nearest orgs (⭐ markers)
 * - userLoc: {lat, lng} or null
 */
export default function MapView({ needs, highlights = [], userLoc = null }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // init map
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: divRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [0, 20],
      zoom: 2.2,
    });
    mapRef.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
  }, []);

  // render markers on change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear old
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // need pins
    needs.forEach((n) => {
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      el.style.boxShadow = "0 0 0 2px white";
      el.style.background =
        n.category === "food" ? "#2b8a3e" :
        n.category === "water" ? "#1971c2" :
        n.category === "shelter" ? "#e8590c" : "#c2255c";

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([n.location.lng, n.location.lat])
        .setPopup(new maplibregl.Popup().setHTML(`<b>${n.title}</b><br>${n.category}`))
        .addTo(map);
      markersRef.current.push(marker);
    });

    // ⭐ nearest orgs
    highlights.forEach((h) => {
      const o = h.org;
      const el = document.createElement("div");
      el.style.fontSize = "18px";
      el.style.lineHeight = "18px";
      el.style.userSelect = "none";
      el.style.transform = "translate(-3px, -3px)";
      el.textContent = "⭐";
      el.title = `${o.name} • ${h.km} km`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([o.location.lng, o.location.lat])
        .setPopup(new maplibregl.Popup().setHTML(
          `<b>${o.name}</b><br>${o.categories.join(", ")}<br>${h.km} km`
        ))
        .addTo(map);
      markersRef.current.push(marker);
    });

    // user dot
    if (userLoc) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.background = "#2563eb";
      el.style.boxShadow = "0 0 0 2px white";
      el.title = "You are here";

      const m = new maplibregl.Marker({ element: el })
        .setLngLat([userLoc.lng, userLoc.lat])
        .setPopup(new maplibregl.Popup().setHTML("<b>Your location</b>"))
        .addTo(map);
      markersRef.current.push(m);
    }

    // fit to all
    const bounds = new maplibregl.LngLatBounds();
    let hasAny = false;
    needs.forEach((n) => { bounds.extend([n.location.lng, n.location.lat]); hasAny = true; });
    highlights.forEach((h) => { bounds.extend([h.org.location.lng, h.org.location.lat]); hasAny = true; });
    if (userLoc) { bounds.extend([userLoc.lng, userLoc.lat]); hasAny = true; }

    if (!hasAny) {
      map.flyTo({ center: [0, 20], zoom: 2.2 });
    } else if (needs.length + highlights.length + (userLoc ? 1 : 0) === 1) {
      let center = [0,0];
      if (userLoc) center = [userLoc.lng, userLoc.lat];
      else if (highlights.length) {
        const o = highlights[0].org; center = [o.location.lng, o.location.lat];
      } else if (needs.length) {
        const n = needs[0]; center = [n.location.lng, n.location.lat];
      }
      map.flyTo({ center, zoom: 10 });
    } else {
      map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 800 });
    }
  }, [needs, highlights, userLoc]);

  return (
    <div
      ref={divRef}
      style={{ height: "60vh", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}
    />
  );
}

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function addCircleMarker(map, lng, lat, color, size = 14) {
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "999px";
  el.style.background = color;
  el.style.border = "2px solid #1f2937";
  el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
  return new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
}

export default function MapView({ needs = [], results = [], userLoc = null }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: userLoc ? [userLoc.lng, userLoc.lat] : [-77.8600, 40.7934],
      zoom: 11,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [userLoc]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (userLoc) {
      markersRef.current.push(
        addCircleMarker(map, userLoc.lng, userLoc.lat, "#facc15", 18)
      );
      map.flyTo({
        center: [userLoc.lng, userLoc.lat],
        zoom: 11,
        essential: true,
      });
    }

    needs.forEach((n) => {
      if (!n.location) return;
      let color = "#3b82f6";
      if (n.category === "food") color = "#22c55e";
      if (n.category === "shelter") color = "#f59e0b";
      if (n.category === "medical") color = "#ef4444";

      const marker = addCircleMarker(map, n.location.lng, n.location.lat, color, 14);
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
        <div>
          <strong>${n.title}</strong><br/>
          Category: ${n.category}<br/>
          Severity: ${n.severity}
        </div>
      `);
      marker.setPopup(popup);
      markersRef.current.push(marker);
    });

    results.forEach((r) => {
      const org = r.org;
      if (!org?.location) return;
      const marker = addCircleMarker(
        map,
        org.location.lng,
        org.location.lat,
        "#111827",
        12
      );
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
        <div>
          <strong>${org.name}</strong><br/>
          Distance: ${r.km} km<br/>
          Categories: ${(org.categories || []).join(", ")}
        </div>
      `);
      marker.setPopup(popup);
      markersRef.current.push(marker);
    });
  }, [needs, results, userLoc]);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "700px",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid #d1d5db",
      }}
    >
      <div
        style={{
          position: "absolute",
          zIndex: 2,
          top: 16,
          left: 16,
          background: "white",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Legend</div>
        <div>🔵 Water</div>
        <div>🟢 Food</div>
        <div>🟠 Shelter</div>
        <div>🔴 Medical</div>
        <div>🟡 Search location</div>
      </div>

      <div ref={mapContainerRef} style={{ width: "100%", height: "700px" }} />
    </div>
  );
}
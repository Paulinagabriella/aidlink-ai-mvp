from typing import Any, Dict, List, Optional
import requests

# Try multiple Overpass endpoints (some go down / rate limit)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
]

def _post_overpass(endpoint: str, query: str) -> Optional[Dict[str, Any]]:
    """
    Returns JSON dict or None if endpoint fails.
    Never raises (we handle errors and return None).
    """
    try:
        r = requests.post(
            endpoint,
            data={"data": query},
            headers={"User-Agent": "AidLinkAI/1.0 (dev)"},
            timeout=25,
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return None

def _run_overpass(query: str) -> Dict[str, Any]:
    """
    Try endpoints until one works. If none work, return empty structure.
    """
    for ep in OVERPASS_ENDPOINTS:
        data = _post_overpass(ep, query)
        if isinstance(data, dict) and "elements" in data:
            return data
    return {"elements": []}

def search_resources(query_text: str, lat: float, lng: float, radius_m: int = 12000) -> List[Dict[str, Any]]:
    """
    Returns nearby resources from OpenStreetMap via Overpass.
    For insulin/medical needs, returns pharmacies/clinics/hospitals.
    Never raises; returns [] on failure.
    """
    try:
        q = (query_text or "").strip().lower()

        want_medical = any(k in q for k in [
            "insulin", "medicine", "medication", "meds",
            "pharmacy", "drug", "rx",
            "clinic", "hospital", "doctor", "urgent", "health"
        ])

        if want_medical:
            overpass_q = f"""
            [out:json][timeout:25];
            (
              node(around:{radius_m},{lat},{lng})["amenity"="pharmacy"];
              way(around:{radius_m},{lat},{lng})["amenity"="pharmacy"];
              relation(around:{radius_m},{lat},{lng})["amenity"="pharmacy"];

              node(around:{radius_m},{lat},{lng})["amenity"="clinic"];
              way(around:{radius_m},{lat},{lng})["amenity"="clinic"];
              relation(around:{radius_m},{lat},{lng})["amenity"="clinic"];

              node(around:{radius_m},{lat},{lng})["amenity"="hospital"];
              way(around:{radius_m},{lat},{lng})["amenity"="hospital"];
              relation(around:{radius_m},{lat},{lng})["amenity"="hospital"];
            );
            out center tags;
            """
        else:
            overpass_q = f"""
            [out:json][timeout:25];
            (
              node(around:{radius_m},{lat},{lng})["amenity"="community_centre"];
              way(around:{radius_m},{lat},{lng})["amenity"="community_centre"];
              relation(around:{radius_m},{lat},{lng})["amenity"="community_centre"];

              node(around:{radius_m},{lat},{lng})["amenity"="social_facility"];
              way(around:{radius_m},{lat},{lng})["amenity"="social_facility"];
              relation(around:{radius_m},{lat},{lng})["amenity"="social_facility"];
            );
            out center tags;
            """

        data = _run_overpass(overpass_q)
        elements = data.get("elements", []) or []

        results: List[Dict[str, Any]] = []
        for el in elements:
            tags = el.get("tags", {}) or {}

            title = (
                tags.get("name")
                or tags.get("operator")
                or tags.get("brand")
                or "Resource"
            )

            # nodes have lat/lon; ways/relations have "center"
            if "lat" in el and "lon" in el:
                rlat, rlng = float(el["lat"]), float(el["lon"])
            else:
                center = el.get("center") or {}
                if "lat" not in center or "lon" not in center:
                    continue
                rlat, rlng = float(center["lat"]), float(center["lon"])

            kind = tags.get("amenity") or tags.get("social_facility") or "resource"

            results.append(
                {
                    "id": f"osm:{el.get('type')}:{el.get('id')}",
                    "title": title,
                    "type": kind,
                    "location": {"lat": rlat, "lng": rlng},
                    "tags": tags,
                }
            )

        # light dedupe
        seen = set()
        deduped: List[Dict[str, Any]] = []
        for r in results:
            key = (r["title"], round(r["location"]["lat"], 5), round(r["location"]["lng"], 5))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(r)

        return deduped
    except Exception:
        # Absolute safety: never crash the API
        return []

import os
import uuid
import asyncio
from math import radians, sin, cos, asin, sqrt
from typing import Optional, List

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.models import Need, GeoPoint
from backend.scoring import cluster_needs

app = FastAPI(title="AidLink AI API", version="1.2")


def get_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]

    # keep local dev working too
    local_defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    return list(dict.fromkeys(local_defaults + origins))


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# In-memory demo data
# ----------------------------
needs: List[Need] = [
    Need(
        id="1",
        title="Flooded village needs clean water",
        category="water",
        location=GeoPoint(lat=31.15, lng=74.20),
        severity=5,
        population_density=800,
        available_aid=20,
        notes="Urgent request near Lahore",
    ),
]

# Simple Org model for nearest suggestions
class Org(BaseModel):
    id: str
    name: str
    categories: List[str]
    location: GeoPoint
    accepts_donations: bool = True
    methods: List[str] = []


orgs: List[Org] = [
    Org(
        id="o-lhr-water-1",
        name="Lahore Clean Water Point",
        categories=["water"],
        location=GeoPoint(lat=31.170, lng=74.250),
        methods=["Stripe", "PayPal"],
    ),
    Org(
        id="o-lhr-shelter-1",
        name="ShelterNow Lahore",
        categories=["shelter"],
        location=GeoPoint(lat=31.120, lng=74.180),
        methods=["Bank"],
    ),
    Org(
        id="o-psu-water-1",
        name="PSU Community Water Station",
        categories=["water"],
        location=GeoPoint(lat=40.806, lng=-77.862),
        methods=["PayPal"],
    ),
    Org(
        id="o-psu-food-1",
        name="State College Food Bank",
        categories=["food"],
        location=GeoPoint(lat=40.800, lng=-77.870),
        methods=["Stripe"],
    ),
    Org(
        id="o-psu-shelter-1",
        name="Centre County Shelter Services",
        categories=["shelter"],
        location=GeoPoint(lat=40.792, lng=-77.860),
        methods=["Stripe", "PayPal"],
    ),
    Org(
        id="o-psu-med-1",
        name="Mount Nittany First Aid",
        categories=["medical"],
        location=GeoPoint(lat=40.805, lng=-77.848),
        methods=["Bank"],
    ),
]


class NeedCreate(BaseModel):
    id: Optional[str] = None
    title: str
    category: str
    location: GeoPoint
    severity: int
    population_density: Optional[int] = None
    available_aid: Optional[int] = None
    notes: Optional[str] = None


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * R * asin(sqrt(a))


async def fetch_population_density(lat: float, lng: float) -> int:
    stats_url = (
        "https://www.worldpop.org/sdi/advancedapi?dataset=wpgppop"
        f"&service=sample&lon={lng}&lat={lat}"
    )
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(stats_url)
            if r.status_code == 200:
                js = r.json()
                if isinstance(js, dict) and "sample" in js and js["sample"]:
                    v = js["sample"][0].get("value")
                    if isinstance(v, (int, float)):
                        return int(round(v))
    except Exception:
        pass
    return 0


OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TAG_MAP = {
    "water": ['amenity="drinking_water"', 'amenity="water_point"', 'man_made="water_tap"'],
    "food": ['amenity="food_bank"', 'amenity="soup_kitchen"', 'shop="supermarket"', 'amenity="marketplace"'],
    "shelter": ['amenity="shelter"', 'social_facility="shelter"'],
    "medical": ['amenity="clinic"', 'amenity="hospital"', 'amenity="pharmacy"'],
}


def build_overpass_query(lat: float, lng: float, category: str, radius_m: int = 10000) -> str:
    tags = TAG_MAP.get(category.lower().strip(), [])
    if not tags:
        tags = ["amenity"]
    ors = "|".join([t.replace('"', '\\"') for t in tags])
    return f"""
    [out:json][timeout:10];
    (
      node(around:{radius_m},{lat},{lng})[{ors}];
      way(around:{radius_m},{lat},{lng})[{ors}];
      relation(around:{radius_m},{lat},{lng})[{ors}];
    );
    out center;
    """


async def fetch_available_aid(lat: float, lng: float, category: str) -> int:
    try:
        q = build_overpass_query(lat, lng, category)
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(OVERPASS_URL, data={"data": q})
            if r.status_code == 200:
                js = r.json()
                return int(len(js.get("elements", [])))
    except Exception:
        pass
    return 0


async def enrich(lat: float, lng: float, category: str) -> dict:
    pd_task = fetch_population_density(lat, lng)
    aid_task = fetch_available_aid(lat, lng, category)
    pd, aid = await asyncio.gather(pd_task, aid_task)
    return {"population_density": pd, "available_aid": aid}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/needs", response_model=List[Need])
def list_needs():
    return needs


@app.post("/needs", response_model=Need)
async def create_need(n: NeedCreate):
    pd = n.population_density if (n.population_density not in (None, 0)) else None
    aid = n.available_aid if (n.available_aid not in (None, 0)) else None

    if pd is None or aid is None:
        e = await enrich(n.location.lat, n.location.lng, n.category)
        pd = e["population_density"] if pd is None else pd
        aid = e["available_aid"] if aid is None else aid

    new_id = n.id or str(uuid.uuid4())
    if any(x.id == new_id for x in needs):
        new_id = str(uuid.uuid4())

    item = Need(
        id=new_id,
        title=n.title,
        category=n.category,
        location=n.location,
        severity=n.severity,
        population_density=int(pd or 0),
        available_aid=int(aid or 0),
        notes=n.notes,
    )
    needs.append(item)
    return item


@app.delete("/needs/{need_id}")
def delete_need(need_id: str):
    for i, n in enumerate(needs):
        if n.id == need_id:
            needs.pop(i)
            return {"message": f"Deleted {need_id}"}
    raise HTTPException(status_code=404, detail="Need not found")


@app.get("/priorities")
def get_priorities(k: int = 3):
    return {"top_regions": cluster_needs(needs, k)}


@app.get("/nearest-orgs")
def nearest_orgs(lat: float, lng: float, category: str, limit: int = 5):
    c = category.lower().strip()
    candidates = [o for o in orgs if c in o.categories]

    if not candidates:
        candidates = orgs

    scored = [
        {"km": round(haversine_km(lat, lng, o.location.lat, o.location.lng), 2), "org": o}
        for o in candidates
    ]
    scored.sort(key=lambda x: x["km"])
    return scored[: max(1, min(limit, 10))]

@app.get("/enrich")
async def enrich_preview(lat: float, lng: float, category: str):
    return await enrich(lat, lng, category)

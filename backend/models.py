from enum import Enum
from pydantic import BaseModel
from typing import List, Optional

# -----------------------------
# Enum for need categories
# -----------------------------
class NeedCategory(str, Enum):
    food = "food"
    water = "water"
    shelter = "shelter"
    medical = "medical"

# -----------------------------
# Geographic point (latitude/longitude)
# -----------------------------
class GeoPoint(BaseModel):
    lat: float
    lng: float

# -----------------------------
# Need model (main data object)
# -----------------------------
class Need(BaseModel):
    id: str
    title: str
    category: NeedCategory
    location: GeoPoint
    severity: int
    population_density: int
    available_aid: int
    notes: Optional[str] = None

# -----------------------------
# Organization (optional)
# -----------------------------
class Org(BaseModel):
    id: str
    name: str
    categories: List[str]               # e.g., ["food", "water"]
    location: GeoPoint
    accepts_donations: bool = True
    methods: List[str] = []             # e.g., ["Stripe", "PayPal"]

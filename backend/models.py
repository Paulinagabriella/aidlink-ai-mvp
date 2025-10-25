from pydantic import BaseModel
from typing import Literal, Optional

NeedCategory = Literal["food", "water", "shelter", "medical"]

class GeoPoint(BaseModel):
    lat: float
    lng: float

class Need(BaseModel):
    id: str
    title: str
    category: NeedCategory
    location: GeoPoint
    severity: int
    population_density: int
    available_aid: int
    notes: Optional[str] = None

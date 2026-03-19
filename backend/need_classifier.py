from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict

import torch
import torch.nn as nn
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer


# ---------- Request/Response ----------
class ClassifyRequest(BaseModel):
    text: str


class ClassifyResponse(BaseModel):
    category: str
    severity: str


# ---------- Model definition (matches saved state_dict indices: 0,3,6) ----------
class MLP(nn.Module):
    def __init__(self, in_dim: int, h1: int, h2: int, out_dim: int, dropout: float = 0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, h1),   # net.0
            nn.ReLU(),               # net.1
            nn.Dropout(dropout),     # net.2
            nn.Linear(h1, h2),       # net.3
            nn.ReLU(),               # net.4
            nn.Dropout(dropout),     # net.5
            nn.Linear(h2, out_dim),  # net.6
        )

    def forward(self, x):
        return self.net(x)



@dataclass
class NeedClassifier:
    """
    Loads:
      - sentence-transformers/all-MiniLM-L6-v2
      - backend/models/category_mlp.pt
      - backend/models/severity_mlp.pt (optional)
    """
    base_dir: Path = Path(__file__).resolve().parent
    models_dir: Path = Path(__file__).resolve().parent / "models"

    def __post_init__(self):
        # Embeddings
        self.embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

        # Category labels must match your training order
        self.category_labels = ["food", "water", "shelter", "medical", "other"]
        self.severity_labels = ["low", "medium", "high"]

        # Determine embedding dimension (MiniLM-L6-v2 is 384)
        embed_dim = self.embedder.get_sentence_embedding_dimension()
        assert embed_dim is not None, "Embedding dimension could not be determined"
        self.embed_dim = embed_dim


        # Load category model
        cat_path = self.models_dir / "category_mlp.pt"
        if not cat_path.exists():
            raise RuntimeError(
                f"Missing {cat_path}. Put your trained model files in backend/models/ (category_mlp.pt, severity_mlp.pt)."
            )

        self.category_labels = ["food", "water", "shelter", "medical", "other"]  # 5 classes
        self.cat_model = MLP(in_dim=self.embed_dim, h1=256, h2=128, out_dim=len(self.category_labels))
        self.cat_model.load_state_dict(torch.load(cat_path, map_location="cpu"))
        self.cat_model.eval()

        # Load severity model (optional)
        sev_path = self.models_dir / "severity_mlp.pt"
        self.sev_model: Optional[MLP] = None
        if sev_path.exists():
            self.sev_model = MLP(in_dim=self.embed_dim, h1=256, h2=128, out_dim=len(self.severity_labels))
            self.sev_model.load_state_dict(torch.load(sev_path, map_location="cpu"))
            self.sev_model.eval()

        # Keyword nudges so “diapers” doesn’t classify weirdly
        self.retail_keywords = {"diaper", "diapers", "formula", "baby", "wipes"}
        self.medical_keywords = {"insulin", "medicine", "antibiotic", "bandage", "wound"}
        self.food_keywords = {"food", "hungry", "meal", "pantry", "groceries"}
        self.water_keywords = {"water", "drink", "thirsty"}
        self.shelter_keywords = {"shelter", "housing", "roof", "homeless"}

    def _predict(self, text: str) -> Dict[str, str]:
        emb = self.embedder.encode([text], convert_to_tensor=True)
        with torch.no_grad():
            cat_logits = self.cat_model(emb)
            cat_idx = int(torch.argmax(cat_logits, dim=1).item())
        category = self.category_labels[cat_idx]

        severity = "medium"
        if self.sev_model is not None:
            with torch.no_grad():
                sev_logits = self.sev_model(emb)
                sev_idx = int(torch.argmax(sev_logits, dim=1).item())
            severity = self.severity_labels[sev_idx]

        return {"category": category, "severity": severity}

    def classify(self, text: str) -> ClassifyResponse:
        t = (text or "").strip()
        if not t:
            return ClassifyResponse(category="food", severity="medium")

        lower = t.lower()
        # Retail keywords: keep category as-is but helps the frontend add retail search
        # (We don't return "retail" as a category because your model labels are only 4)
        is_retail = any(k in lower for k in self.retail_keywords)


        # Keyword nudges (keeps demo sane)
        if any(k in lower for k in self.water_keywords):
            category = "water"
        elif any(k in lower for k in self.shelter_keywords):
            category = "shelter"
        elif any(k in lower for k in self.medical_keywords):
            category = "medical"
        elif any(k in lower for k in self.food_keywords):
            category = "food"
        else:
            pred = self._predict(t)
            category = pred["category"]

        # Severity from model if available; else default
        pred2 = self._predict(t)
        severity = pred2["severity"]

        return ClassifyResponse(category=category, severity=severity)

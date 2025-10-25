from typing import List
import numpy as np
from sklearn.cluster import KMeans
from backend.models import Need

def risk_score(n: Need) -> float:
    return (n.population_density * n.severity) / (n.available_aid + 1)

def cluster_needs(needs: List[Need], k: int = 3):
    if not needs:
        return []
    X = np.array([[n.location.lat, n.location.lng] for n in needs])
    k = min(k, len(needs))
    model = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = model.fit_predict(X)
    results = []
    for n, label in zip(needs, labels):
        results.append({
            "need": n.model_dump(),
            "cluster": int(label),
            "risk_score": risk_score(n)
        })
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results

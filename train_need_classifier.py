import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sentence_transformers import SentenceTransformer
from sklearn.preprocessing import LabelEncoder
import joblib
from pathlib import Path

DATA_PATH = Path("data/needs.csv")
OUT_DIR = Path("models")
OUT_DIR.mkdir(parents=True, exist_ok=True)

EMBEDDER_NAME = "sentence-transformers/all-MiniLM-L6-v2"
BATCH_SIZE = 32
EPOCHS = 12
LR = 1e-3

class MLP(nn.Module):
    def __init__(self, in_dim: int, out_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, out_dim),
        )

    def forward(self, x):
        return self.net(x)

def train_head(X: np.ndarray, y: np.ndarray, num_classes: int) -> MLP:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    X_t = torch.tensor(X, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.long)

    ds = TensorDataset(X_t, y_t)
    dl = DataLoader(ds, batch_size=BATCH_SIZE, shuffle=True)

    model = MLP(X.shape[1], num_classes).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=LR)
    loss_fn = nn.CrossEntropyLoss()

    model.train()
    for epoch in range(EPOCHS):
        total = 0.0
        for xb, yb in dl:
            xb, yb = xb.to(device), yb.to(device)
            opt.zero_grad()
            logits = model(xb)
            loss = loss_fn(logits, yb)
            loss.backward()
            opt.step()
            total += loss.item() * xb.size(0)

        avg = total / len(ds)
        print(f"epoch {epoch+1}/{EPOCHS} loss={avg:.4f}")

    return model.cpu()

def main():
    df = pd.read_csv(DATA_PATH)
    df["text"] = df["text"].astype(str)

    embedder = SentenceTransformer(EMBEDDER_NAME)
    X = embedder.encode(df["text"].tolist(), normalize_embeddings=True)

    cat_enc = LabelEncoder()
    sev_enc = LabelEncoder()

    y_cat = cat_enc.fit_transform(df["category"].astype(str))
    y_sev = sev_enc.fit_transform(df["severity"].astype(str))

    cat_model = train_head(X, y_cat, num_classes=len(cat_enc.classes_))
    sev_model = train_head(X, y_sev, num_classes=len(sev_enc.classes_))

    torch.save(cat_model.state_dict(), OUT_DIR / "category_mlp.pt")
    torch.save(sev_model.state_dict(), OUT_DIR / "severity_mlp.pt")

    joblib.dump(cat_enc, OUT_DIR / "category_encoder.joblib")
    joblib.dump(sev_enc, OUT_DIR / "severity_encoder.joblib")
    joblib.dump({"embedder_name": EMBEDDER_NAME, "embedding_dim": X.shape[1]}, OUT_DIR / "meta.joblib")

    print("Saved models to:", OUT_DIR.resolve())

if __name__ == "__main__":
    main()

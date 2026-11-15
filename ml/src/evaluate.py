"""
Model Evaluation Module — AcadFlow ML (Phase 3).

Evaluates saved models and generates metric summaries for documentation.
Includes strict quality gate validation (PR-AUC >= 0.70).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict

import joblib
import numpy as np
import pandas as pd

ML_ROOT = Path(__file__).resolve().parent.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

VENDOR_DIR = ML_ROOT / "vendor_packages"
if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

from src.features import FEATURE_NAMES
from src.train import evaluate_predictions

MIN_PR_AUC_THRESHOLD = 0.70


def evaluate_saved_model() -> Dict[str, float]:
    models_dir = ML_ROOT / "models"
    model_path = models_dir / "best_model.joblib"
    csv_path = models_dir / "simulated_cohort.csv"

    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at {model_path}. Run train.py first.")

    model = joblib.load(model_path)
    df = pd.read_csv(csv_path)

    X = df[FEATURE_NAMES].values
    y = df["label_at_risk"].values

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)[:, 1]
    else:
        probs = model.predict(X)

    metrics = evaluate_predictions(y, probs)
    print("Evaluated model metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # Quality Gate Check
    pr_auc = metrics.get("pr_auc", 0.0)
    if pr_auc < MIN_PR_AUC_THRESHOLD:
        print(f"QUALITY GATE FAILED: PR-AUC {pr_auc:.4f} is below minimum threshold {MIN_PR_AUC_THRESHOLD:.4f}")
        sys.exit(1)

    print(f"QUALITY GATE PASSED: PR-AUC {pr_auc:.4f} >= {MIN_PR_AUC_THRESHOLD:.4f}")
    return metrics


if __name__ == "__main__":
    evaluate_saved_model()

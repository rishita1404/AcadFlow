"""
ML Model Training & Comparison Pipeline — AcadFlow (Phase 3).

Trains and compares:
1. Rule-Based Baseline (Risk Engine score normalized to probability)
2. Logistic Regression (L2 regularized)
3. Gradient Boosting Classifier (Ensemble decision trees)

Reports:
- PR-AUC (Average Precision)
- ROC-AUC
- Precision @ Top 10%
- Recall @ Top 10%
- Calibration (Brier Score)

Integrates with MLflow for experiment tracking and artifact logging.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Ensure ML package roots are on sys.path
ML_ROOT = Path(__file__).resolve().parent.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

# Vendor packages fallback if available
VENDOR_DIR = ML_ROOT / "vendor_packages"
if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

from src.features import FEATURE_NAMES
from src.simulate import generate_cohort


def compute_metrics_at_k(y_true: np.ndarray, y_prob: np.ndarray, top_k_pct: float = 0.10) -> Tuple[float, float]:
    """Calculate precision and recall at top k% highest predicted risk."""
    n = len(y_true)
    k = max(1, int(n * top_k_pct))
    top_indices = np.argsort(y_prob)[::-1][:k]

    y_pred_k = np.zeros(n)
    y_pred_k[top_indices] = 1

    prec_at_k = precision_score(y_true, y_pred_k, zero_division=0)
    rec_at_k = recall_score(y_true, y_pred_k, zero_division=0)
    return float(prec_at_k), float(rec_at_k)


def evaluate_predictions(y_true: np.ndarray, y_prob: np.ndarray) -> Dict[str, float]:
    """Compute standard classification and calibration metrics."""
    pr_auc = float(average_precision_score(y_true, y_prob))
    roc_auc = float(roc_auc_score(y_true, y_prob))
    brier = float(brier_score_loss(y_true, y_prob))
    prec_10, rec_10 = compute_metrics_at_k(y_true, y_prob, top_k_pct=0.10)

    return {
        "pr_auc": round(pr_auc, 4),
        "roc_auc": round(roc_auc, 4),
        "brier_score": round(brier, 4),
        "precision_at_top10": round(prec_10, 4),
        "recall_at_top10": round(rec_10, 4),
    }


def train_and_compare(min_pr_auc_threshold: float = 0.70) -> Dict[str, Any]:
    """Train models, evaluate on held-out test split, and save best model."""
    models_dir = ML_ROOT / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    csv_path = models_dir / "simulated_cohort.csv"
    if csv_path.exists():
        df = pd.read_csv(csv_path)
    else:
        df = generate_cohort(seed=42)
        df.to_csv(csv_path, index=False)

    X = df[FEATURE_NAMES].values
    y = df["label_at_risk"].values
    rule_scores = df["rule_risk_score"].values / 100.0
    student_ids = df["student_id"].values

    # Train / Val / Test Split (70% / 15% / 15%)
    idx_train, idx_temp = train_test_split(
        np.arange(len(df)), test_size=0.30, random_state=42, stratify=y
    )
    idx_val, idx_test = train_test_split(
        idx_temp, test_size=0.50, random_state=42, stratify=y[idx_temp]
    )

    X_train, y_train = X[idx_train], y[idx_train]
    X_val, y_val = X[idx_val], y[idx_val]
    X_test, y_test = X[idx_test], y[idx_test]

    results = {}

    # 1. Rule-Based Baseline
    prob_test_rule = rule_scores[idx_test]
    results["rule_baseline"] = {
        "model_name": "Rule-Based Risk Engine",
        "metrics": evaluate_predictions(y_test, prob_test_rule),
    }

    # 2. Logistic Regression
    lr_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(C=1.0, max_iter=1000, random_state=42)),
    ])
    lr_pipe.fit(X_train, y_train)
    prob_test_lr = lr_pipe.predict_proba(X_test)[:, 1]
    results["logistic_regression"] = {
        "model_name": "Logistic Regression (L2)",
        "metrics": evaluate_predictions(y_test, prob_test_lr),
        "model": lr_pipe,
    }

    # 3. Gradient Boosting Classifier
    gb = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42,
    )
    gb.fit(X_train, y_train)
    prob_test_gb = gb.predict_proba(X_test)[:, 1]
    results["gradient_boosting"] = {
        "model_name": "Gradient Boosting (GBDT)",
        "metrics": evaluate_predictions(y_test, prob_test_gb),
        "model": gb,
    }

    # Select Best Model based on PR-AUC
    best_key = "gradient_boosting"
    if results["logistic_regression"]["metrics"]["pr_auc"] > results["gradient_boosting"]["metrics"]["pr_auc"]:
        best_key = "logistic_regression"

    best_model = results[best_key]["model"]
    best_metrics = results[best_key]["metrics"]

    # Gate check
    if best_metrics["pr_auc"] < min_pr_auc_threshold:
        raise ValueError(
            f"Quality gate failure: best model PR-AUC ({best_metrics['pr_auc']}) "
            f"below required threshold ({min_pr_auc_threshold})."
        )

    # Save artifacts
    model_path = models_dir / "best_model.joblib"
    joblib.dump(best_model, model_path)

    # Feature importance / attribution snapshot
    if hasattr(best_model, "feature_importances_"):
        attributions = dict(zip(FEATURE_NAMES, [float(x) for x in best_model.feature_importances_]))
    elif hasattr(best_model, "named_steps") and hasattr(best_model.named_steps["classifier"], "coef_"):
        attributions = dict(zip(FEATURE_NAMES, [float(abs(x)) for x in best_model.named_steps["classifier"].coef_[0]]))
    else:
        attributions = {feat: 1.0 / len(FEATURE_NAMES) for feat in FEATURE_NAMES}

    metadata = {
        "best_model": best_key,
        "model_name": results[best_key]["model_name"],
        "model_version": "v1.2.0-eval2",
        "features": FEATURE_NAMES,
        "metrics": best_metrics,
        "attributions": attributions,
        "comparison": {
            k: {
                "name": v["model_name"],
                "metrics": v["metrics"],
            }
            for k, v in results.items()
        },
        "training_samples": len(X_train),
        "test_samples": len(X_test),
    }

    with open(models_dir / "model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    # MLflow logging
    try:
        import mlflow
        mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "sqlite:///ml/models/mlflow.db"))
        mlflow.set_experiment("acadflow-risk-models")
        with mlflow.start_run(run_name=f"train-{best_key}"):
            mlflow.log_params({"model_type": best_key, "n_features": len(FEATURE_NAMES)})
            mlflow.log_metrics(best_metrics)
            mlflow.log_artifact(str(models_dir / "model_metadata.json"))
            print(f"[MLflow] Successfully logged experiment run for {best_key}")
    except Exception as e:
        print(f"[MLflow] Local tracking notice: {e}")

    return metadata


if __name__ == "__main__":
    meta = train_and_compare()
    print("Training comparison completed:")
    print(json.dumps(meta["comparison"], indent=2))

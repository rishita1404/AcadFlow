"""
Distribution Drift Monitoring (PSI & KS Test) — AcadFlow ML (Phase 3).

Computes:
1. Population Stability Index (PSI) per feature:
   - PSI < 0.1  : Stable (no significant distribution shift)
   - 0.1 <= PSI < 0.2 : Moderate drift (warning threshold)
   - PSI >= 0.2 : Significant drift (retraining trigger)
2. Two-sample Kolmogorov-Smirnov (KS) test:
   - Evaluates whether current rolling window samples originate from the
     training reference distribution (p-value < 0.05 indicates drift).

Rolling Window Buffer:
- Retains up to `max_window_size` recent production inference feature vectors.
"""

from __future__ import annotations

import collections
import json
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats

from src.features import FEATURE_NAMES

ML_ROOT = Path(__file__).resolve().parent.parent


def compute_psi(
    expected: np.ndarray,
    actual: np.ndarray,
    num_buckets: int = 10,
    epsilon: float = 1e-4,
) -> float:
    """
    Compute Population Stability Index (PSI) between reference (expected)
    and current (actual) numerical 1D arrays.
    """
    expected = np.asarray(expected, dtype=float)
    actual = np.asarray(actual, dtype=float)

    if len(expected) == 0 or len(actual) == 0:
        return 0.0

    # Quantile bin edges based on expected distribution
    percentiles = np.linspace(0, 100, num_buckets + 1)
    bin_edges = np.percentile(expected, percentiles)
    # Deduplicate bin edges if repeated values occur
    bin_edges = np.unique(bin_edges)
    if len(bin_edges) < 2:
        return 0.0

    # Ensure bounds cover min and max of both sets
    bin_edges[0] = min(bin_edges[0], np.min(actual)) - 1e-5
    bin_edges[-1] = max(bin_edges[-1], np.max(actual)) + 1e-5

    # Frequency histograms
    exp_counts, _ = np.histogram(expected, bins=bin_edges)
    act_counts, _ = np.histogram(actual, bins=bin_edges)

    # Convert to proportions with epsilon smoothing
    exp_pct = (exp_counts / len(expected)) + epsilon
    act_pct = (act_counts / len(actual)) + epsilon

    # Re-normalize
    exp_pct = exp_pct / np.sum(exp_pct)
    act_pct = act_pct / np.sum(act_pct)

    # PSI sum
    psi_value = np.sum((act_pct - exp_pct) * np.log(act_pct / exp_pct))
    return float(np.maximum(0.0, psi_value))


def check_ks_drift(
    reference_dist: np.ndarray,
    current_dist: np.ndarray,
) -> Tuple[float, float, bool]:
    """
    Run 2-sample Kolmogorov-Smirnov test.
    Returns (statistic, p_value, is_drift_detected).
    """
    reference_dist = np.asarray(reference_dist, dtype=float)
    current_dist = np.asarray(current_dist, dtype=float)

    if len(reference_dist) == 0 or len(current_dist) == 0:
        return 0.0, 1.0, False

    stat, p_val = stats.ks_2samp(reference_dist, current_dist)
    is_drift = bool(p_val < 0.05)
    return float(stat), float(p_val), is_drift


class DriftMonitor:
    """Thread-safe rolling buffer and drift detector for serving."""

    def __init__(self, max_window_size: int = 500):
        self.max_window_size = max_window_size
        self._lock = threading.Lock()
        self._window: collections.deque = collections.deque(maxlen=max_window_size)
        self._reference_data: Dict[str, np.ndarray] = {}
        self._load_reference_data()

    def _load_reference_data(self):
        csv_path = ML_ROOT / "models" / "simulated_cohort.csv"
        if csv_path.exists():
            df = pd.read_csv(csv_path)
            for f in FEATURE_NAMES:
                if f in df.columns:
                    self._reference_data[f] = df[f].values.astype(float)
        else:
            # Fallback default synthetic reference
            for f in FEATURE_NAMES:
                self._reference_data[f] = np.random.uniform(0, 100, 500)

    def record_inference(self, feature_vector: List[float]):
        """Record an inference request into the rolling evaluation window."""
        with self._lock:
            self._window.append(feature_vector)

    def record_batch(self, feature_matrix: List[List[float]]):
        """Record a batch of inference inputs into rolling window."""
        with self._lock:
            for vec in feature_matrix:
                self._window.append(vec)

    def compute_drift_status(self) -> Dict:
        """Compute PSI and KS drift for all monitored features."""
        with self._lock:
            if len(self._window) < 10:
                return {
                    "status": "insufficient_samples",
                    "window_size": len(self._window),
                    "min_required": 10,
                    "overall_drift": False,
                    "features": {},
                }
            current_matrix = np.array(list(self._window))

        feature_reports = {}
        has_critical_drift = False

        for idx, feat in enumerate(FEATURE_NAMES):
            ref_vals = self._reference_data.get(feat, np.array([]))
            cur_vals = current_matrix[:, idx]

            psi = compute_psi(ref_vals, cur_vals)
            ks_stat, ks_pval, ks_drift = check_ks_drift(ref_vals, cur_vals)

            drift_level = "stable"
            if psi >= 0.2 or (ks_drift and psi >= 0.15):
                drift_level = "critical"
                has_critical_drift = True
            elif psi >= 0.1 or ks_drift:
                drift_level = "warning"

            feature_reports[feat] = {
                "psi": round(psi, 4),
                "ks_statistic": round(ks_stat, 4),
                "ks_p_value": round(ks_pval, 4),
                "drift_level": drift_level,
            }

        return {
            "status": "active",
            "window_size": len(current_matrix),
            "overall_drift": has_critical_drift,
            "features": feature_reports,
        }

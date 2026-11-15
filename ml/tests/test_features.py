import sys
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

VENDOR_DIR = ML_DIR / "vendor_packages"
if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

from src.features import FEATURE_NAMES, extract_features, map_feature_contributions


def test_extract_features_valid():
    sample = {
        "attendance_margin": 0.45,
        "attendance_trend_4w": -3.2,
        "deadline_pressure": 2,
        "missed_submissions_count": 1,
        "current_attendance_pct": 78.4,
        "past_quiz_avg": 72.0,
    }
    feats = extract_features(sample)
    assert len(feats) == len(FEATURE_NAMES)
    assert feats[0] == 0.45
    assert feats[1] == -3.2
    assert feats[4] == 78.4


def test_map_feature_contributions():
    sample = {
        "attendance_margin": 0.9,
        "attendance_trend_4w": -6.5,
        "deadline_pressure": 4,
        "missed_submissions_count": 3,
        "current_attendance_pct": 62.0,
        "past_quiz_avg": 50.0,
    }
    weights = {
        "attendance_margin": 0.45,
        "missed_submissions_count": 0.25,
        "attendance_trend_4w": 0.15,
        "current_attendance_pct": 0.10,
    }
    factors = map_feature_contributions(sample, weights)
    assert len(factors) >= 3
    # Check that highest weight is first
    assert factors[0]["feature"] == "attendance_margin"
    assert factors[0]["severity"] == "high"

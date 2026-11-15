"""
ML Feature Engineering & Schema Definition — AcadFlow.

Single source of truth for ML features used across training, evaluation,
and serving. Mirrors the components of AcadFlow's rule-based risk engine:
1. attendance_margin      : Relative margin pressure [0.0, 1.0] (1.0 = buffer exhausted)
2. attendance_trend_4w    : 4-week percentage trajectory slope [-25.0, +25.0]
3. deadline_pressure      : Pending assignments due in next 7 days [0, 20]
4. missed_submissions_count: Total past deadlines missed without excuse [0, 50]
5. current_attendance_pct : Cumulative attendance percentage [0.0, 100.0]
6. past_quiz_avg          : Historical academic quiz / lab average [0.0, 100.0]

This module has NO heavy dependencies and is safely importable by both
the ML service and the backend FastAPI application.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

FEATURE_NAMES: List[str] = [
    "attendance_margin",
    "attendance_trend_4w",
    "deadline_pressure",
    "missed_submissions_count",
    "current_attendance_pct",
    "past_quiz_avg",
]

# Validation boundaries for strict Pydantic parsing
FEATURE_BOUNDS: Dict[str, Tuple[float, float]] = {
    "attendance_margin": (0.0, 1.0),
    "attendance_trend_4w": (-50.0, 50.0),
    "deadline_pressure": (0.0, 50.0),
    "missed_submissions_count": (0.0, 100.0),
    "current_attendance_pct": (0.0, 100.0),
    "past_quiz_avg": (0.0, 100.0),
}


def extract_features(raw_data: Dict[str, Any]) -> List[float]:
    """
    Extract and sanitize numerical feature vector from raw dictionary.
    Handles legacy keys (e.g. buffer_classes fallback to attendance_margin).
    """
    margin = raw_data.get("attendance_margin")
    if margin is None:
        buf = raw_data.get("buffer_classes", 0)
        rem = raw_data.get("remaining_classes", 20)
        if rem <= 0:
            margin = 1.0 if buf < 0 else 0.0
        else:
            margin = max(0.0, min(1.0, 1.0 - (buf / rem))) if buf >= 0 else 1.0

    trend = float(raw_data.get("attendance_trend_4w", 0.0))
    deadlines = float(raw_data.get("deadline_pressure", 0.0))
    missed = float(raw_data.get("missed_submissions_count", 0.0))
    att_pct = float(raw_data.get("current_attendance_pct", raw_data.get("attendance_pct", 75.0)))
    quiz_avg = float(raw_data.get("past_quiz_avg", 70.0))

    return [
        float(margin),
        float(trend),
        float(deadlines),
        float(missed),
        float(att_pct),
        float(quiz_avg),
    ]


def map_feature_contributions(
    feature_values: Dict[str, float],
    shap_or_coef_weights: Dict[str, float],
) -> List[Dict[str, Any]]:
    """
    Convert raw feature values and model attribution weights into plain-language
    explainability factors for students, faculty, and coordinators.
    """
    factors: List[Dict[str, Any]] = []

    # 1. Attendance margin
    margin = feature_values.get("attendance_margin", 0.0)
    w_margin = shap_or_coef_weights.get("attendance_margin", 0.0)
    if margin > 0.6 or w_margin > 0.1:
        factors.append({
            "feature": "attendance_margin",
            "weight": round(w_margin, 3),
            "label": "Low Attendance Buffer",
            "detail": f"Class attendance buffer is narrow (margin pressure {int(margin*100)}%).",
            "severity": "high" if margin >= 0.8 else "medium",
        })

    # 2. 4-Week Trend
    trend = feature_values.get("attendance_trend_4w", 0.0)
    w_trend = shap_or_coef_weights.get("attendance_trend_4w", 0.0)
    if trend < -2.0:
        factors.append({
            "feature": "attendance_trend_4w",
            "weight": round(w_trend, 3),
            "label": "Downward Attendance Trend",
            "detail": f"Attendance dropped by {abs(round(trend, 1))}% over the trailing 4 weeks.",
            "severity": "high" if trend < -5.0 else "medium",
        })
    elif trend > 2.0:
        factors.append({
            "feature": "attendance_trend_4w",
            "weight": round(w_trend, 3),
            "label": "Improving Attendance Trajectory",
            "detail": f"Attendance improved by +{round(trend, 1)}% over the trailing 4 weeks.",
            "severity": "positive",
        })

    # 3. Missed submissions
    missed = feature_values.get("missed_submissions_count", 0.0)
    w_missed = shap_or_coef_weights.get("missed_submissions_count", 0.0)
    if missed > 0:
        factors.append({
            "feature": "missed_submissions_count",
            "weight": round(w_missed, 3),
            "label": "Missed Assignment Deadlines",
            "detail": f"{int(missed)} assignment{'s' if missed > 1 else ''} passed deadline without submission.",
            "severity": "critical" if missed >= 3 else ("high" if missed == 2 else "medium"),
        })

    # 4. Deadline Pressure
    deadlines = feature_values.get("deadline_pressure", 0.0)
    w_deadlines = shap_or_coef_weights.get("deadline_pressure", 0.0)
    if deadlines >= 3:
        factors.append({
            "feature": "deadline_pressure",
            "weight": round(w_deadlines, 3),
            "label": "High Upcoming Workload",
            "detail": f"{int(deadlines)} deadlines scheduled in the coming 7 days.",
            "severity": "medium",
        })

    # 5. Overall percentage
    pct = feature_values.get("current_attendance_pct", 75.0)
    if pct < 75.0:
        factors.append({
            "feature": "current_attendance_pct",
            "weight": round(shap_or_coef_weights.get("current_attendance_pct", 0.0), 3),
            "label": "Below Mandatory Threshold",
            "detail": f"Current overall attendance is {round(pct, 1)}% (below institutional minimum of 75%).",
            "severity": "critical" if pct < 65.0 else "high",
        })

    # Sort factors by absolute attribution weight descending
    factors.sort(key=lambda x: abs(x["weight"]), reverse=True)
    return factors

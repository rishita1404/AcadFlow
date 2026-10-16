"""
Feature definition shared across training and online serving pipelines.
"""
FEATURE_NAMES = [
    "attendance_pct",
    "buffer_classes",
    "missed_submissions_count",
    "avg_days_to_submit",
    "past_quiz_avg"
]

def extract_features(raw_data: dict) -> list[float]:
    return [float(raw_data.get(feat, 0.0)) for feat in FEATURE_NAMES]

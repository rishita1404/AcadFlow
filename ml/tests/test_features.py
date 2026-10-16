from src.features import extract_features

def test_extract_features():
    sample = {
        "attendance_pct": 82.5,
        "buffer_classes": 4,
        "missed_submissions_count": 0,
        "avg_days_to_submit": 1.2,
        "past_quiz_avg": 85.0
    }
    feats = extract_features(sample)
    assert len(feats) == 5
    assert feats[0] == 82.5

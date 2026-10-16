from app.services.risk import compute_rule_risk_score


def test_compute_rule_risk_score():
    score = compute_rule_risk_score(attendance_pct=85.0, missed_assignments=0)
    assert score == 0.0

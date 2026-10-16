def compute_rule_risk_score(attendance_pct: float, missed_assignments: int) -> float:
    """Rule-based fallback risk score calculation [0.0 - 1.0]."""
    attendance_factor = max(0.0, (75.0 - attendance_pct) / 75.0) if attendance_pct < 75.0 else 0.0
    assignment_factor = min(1.0, missed_assignments * 0.2)
    return min(1.0, (attendance_factor * 0.6) + (assignment_factor * 0.4))

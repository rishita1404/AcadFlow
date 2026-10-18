"""
Unit tests for the rule-based risk score v1.
Member 3 (Raghav) — Evaluation 1

All expected values derived from PRD Section 8 formulas independently.

Run:
    cd backend && python -m pytest tests/unit/test_risk.py -v
"""

import pytest
from app.services.risk import (
    DEFAULT_RISK_CONFIG,
    RiskConfig,
    classify_band,
    compute_deadline_score,
    compute_missed_score,
    compute_risk_score,
    compute_trend_score,
)


# ──────────────────────────────────────────────────────────────────────────────
# Band classification
# ──────────────────────────────────────────────────────────────────────────────

class TestBandClassification:

    def test_safe_lower_bound(self):
        assert classify_band(0.0) == "Safe"

    def test_safe_upper_bound(self):
        assert classify_band(29.9) == "Safe"

    def test_watch_lower_bound(self):
        assert classify_band(30.0) == "Watch"

    def test_watch_upper_bound(self):
        assert classify_band(54.9) == "Watch"

    def test_at_risk_lower_bound(self):
        assert classify_band(55.0) == "At risk"

    def test_at_risk_upper_bound(self):
        assert classify_band(79.9) == "At risk"

    def test_critical_lower_bound(self):
        assert classify_band(80.0) == "Critical"

    def test_critical_max(self):
        assert classify_band(100.0) == "Critical"

    def test_determinism(self):
        for score in [0, 15, 29, 30, 54, 55, 79, 80, 100]:
            assert classify_band(float(score)) == classify_band(float(score))


# ──────────────────────────────────────────────────────────────────────────────
# RiskConfig validation
# ──────────────────────────────────────────────────────────────────────────────

class TestRiskConfigValidation:

    def test_default_config_is_valid(self):
        cfg = DEFAULT_RISK_CONFIG
        assert cfg.w_margin == 50.0
        assert cfg.w_trend == 20.0
        assert cfg.w_deadline == 20.0
        assert cfg.w_missed == 10.0
        assert cfg.t_watch == 30.0
        assert cfg.t_risk == 55.0
        assert cfg.t_critical == 80.0

    def test_invalid_threshold_order(self):
        with pytest.raises(ValueError, match="strictly increasing"):
            RiskConfig(t_watch=55.0, t_risk=30.0, t_critical=80.0)

    def test_negative_weight(self):
        with pytest.raises(ValueError, match="Weight"):
            RiskConfig(w_margin=-1.0)

    def test_threshold_out_of_range(self):
        with pytest.raises(ValueError, match="Threshold"):
            RiskConfig(t_watch=30.0, t_risk=55.0, t_critical=110.0)


# ──────────────────────────────────────────────────────────────────────────────
# Component functions
# ──────────────────────────────────────────────────────────────────────────────

class TestTrendScore:

    def test_none_slope_zero_penalty(self):
        pts, _ = compute_trend_score(None)
        assert pts == 0.0

    def test_positive_slope_zero_penalty(self):
        pts, _ = compute_trend_score(5.0)
        assert pts == 0.0

    def test_zero_slope_zero_penalty(self):
        pts, _ = compute_trend_score(0.0)
        assert pts == 0.0

    def test_moderate_decline(self):
        # slope=-5 → severity=0.5 → 20*0.5=10
        pts, factors = compute_trend_score(-5.0, w_trend=20.0)
        assert pts == pytest.approx(10.0, abs=0.01)
        assert len(factors) > 0

    def test_steep_decline_capped(self):
        # slope=-10 → severity=1.0 → 20 pts
        pts, _ = compute_trend_score(-10.0, w_trend=20.0)
        assert pts == pytest.approx(20.0, abs=0.01)

    def test_steeper_than_max_capped(self):
        pts, _ = compute_trend_score(-50.0, w_trend=20.0)
        assert pts == pytest.approx(20.0, abs=0.01)


class TestDeadlineScore:

    def test_no_deadlines(self):
        pts, _ = compute_deadline_score(0)
        assert pts == 0.0

    def test_one_deadline(self):
        pts, f = compute_deadline_score(1, w_deadline=20.0)
        assert pts == pytest.approx(5.0, abs=0.01)
        assert len(f) > 0

    def test_four_deadlines_full(self):
        pts, _ = compute_deadline_score(4, w_deadline=20.0)
        assert pts == pytest.approx(20.0, abs=0.01)

    def test_more_than_four_capped(self):
        pts, _ = compute_deadline_score(10, w_deadline=20.0)
        assert pts == pytest.approx(20.0, abs=0.01)


class TestMissedScore:

    def test_no_submissions_no_penalty(self):
        """PRD: student with no submissions has no missed penalty."""
        pts, _ = compute_missed_score(0, 0)
        assert pts == 0.0

    def test_no_missed(self):
        pts, _ = compute_missed_score(0, 5)
        assert pts == 0.0

    def test_one_of_five_missed(self):
        pts, f = compute_missed_score(1, 5, w_missed=10.0)
        assert pts == pytest.approx(2.0, abs=0.01)   # 1/5 * 10 = 2
        assert len(f) > 0

    def test_all_missed(self):
        pts, _ = compute_missed_score(5, 5, w_missed=10.0)
        assert pts == pytest.approx(10.0, abs=0.01)

    def test_more_missed_than_total_capped(self):
        pts, _ = compute_missed_score(10, 5, w_missed=10.0)
        assert pts == pytest.approx(10.0, abs=0.01)


# ──────────────────────────────────────────────────────────────────────────────
# Full risk score — PRD Appendix A scenarios
# ──────────────────────────────────────────────────────────────────────────────

class TestFullRiskScore:

    def test_riya_risk_score(self):
        """
        Riya: buffer=5, remaining=20 → margin=37.5
        No trend data, no deadlines, no missed → score=37.5 → Watch band
        """
        result = compute_risk_score(
            buffer=5,
            remaining=20,
            attendance_slope=None,
            upcoming_deadline_count=0,
            missed_count=0,
            total_submissions=3,
            insufficient_data=False,
        )
        assert result.margin_points == pytest.approx(37.5, abs=0.1)
        assert result.trend_points == 0.0
        assert result.deadline_points == 0.0
        assert result.missed_points == 0.0
        assert result.score == pytest.approx(37.5, abs=0.1)
        assert result.band == "Watch"
        assert result.insufficient_data is False

    def test_karan_full_margin(self):
        """
        Karan: buffer=-5 (negative) → margin=50 (full)
        No other factors → score=50 → Watch band
        """
        result = compute_risk_score(
            buffer=-5,
            remaining=10,
            attendance_slope=None,
            upcoming_deadline_count=0,
            missed_count=0,
            total_submissions=0,
            insufficient_data=False,
        )
        assert result.margin_points == pytest.approx(50.0, abs=0.01)
        assert result.band == "Watch"

    def test_dev_insufficient_data(self):
        """Dev: insufficient_data=True → score is None, band='Insufficient data'."""
        result = compute_risk_score(
            buffer=None,
            remaining=0,
            attendance_slope=None,
            upcoming_deadline_count=0,
            missed_count=0,
            total_submissions=0,
            insufficient_data=True,
        )
        assert result.insufficient_data is True
        assert result.band == "Insufficient data"
        assert result.score == 0.0   # internal; API layer maps to None

    def test_high_risk_combination(self):
        """
        buffer=-5 → margin=50
        steep decline → trend=20
        4 deadlines → deadline=20
        all submissions missed → missed=10
        Total = 100 → Critical
        """
        result = compute_risk_score(
            buffer=-5,
            remaining=10,
            attendance_slope=-10.0,
            upcoming_deadline_count=4,
            missed_count=5,
            total_submissions=5,
            insufficient_data=False,
        )
        assert result.score == pytest.approx(100.0, abs=0.1)
        assert result.band == "Critical"

    def test_safe_student(self):
        """
        buffer=15, remaining=20 → margin=12.5
        Improving trend, no deadlines, no missed → score=12.5 → Safe
        """
        result = compute_risk_score(
            buffer=15,
            remaining=20,
            attendance_slope=2.0,    # improving
            upcoming_deadline_count=0,
            missed_count=0,
            total_submissions=5,
            insufficient_data=False,
        )
        assert result.score == pytest.approx(12.5, abs=0.1)
        assert result.band == "Safe"

    def test_score_capped_at_100(self):
        """Score must never exceed 100."""
        result = compute_risk_score(
            buffer=-100,
            remaining=1,
            attendance_slope=-100.0,
            upcoming_deadline_count=100,
            missed_count=100,
            total_submissions=100,
            insufficient_data=False,
        )
        assert result.score <= 100.0

    def test_score_floor_at_zero(self):
        """Score must never go below 0."""
        result = compute_risk_score(
            buffer=50,
            remaining=50,
            attendance_slope=10.0,
            upcoming_deadline_count=0,
            missed_count=0,
            total_submissions=0,
            insufficient_data=False,
        )
        assert result.score >= 0.0

    def test_determinism(self):
        """Identical inputs always produce identical outputs."""
        kwargs = dict(
            buffer=5,
            remaining=20,
            attendance_slope=-3.0,
            upcoming_deadline_count=1,
            missed_count=1,
            total_submissions=5,
            insufficient_data=False,
        )
        r1 = compute_risk_score(**kwargs)
        r2 = compute_risk_score(**kwargs)
        assert r1.score == r2.score
        assert r1.band == r2.band

    def test_config_changes_affect_score(self):
        """Different RiskConfig produces different score."""
        kwargs = dict(
            buffer=5,
            remaining=20,
            attendance_slope=None,
            upcoming_deadline_count=0,
            missed_count=0,
            total_submissions=0,
            insufficient_data=False,
        )
        r_default = compute_risk_score(**kwargs)
        high_weight_config = RiskConfig(
            w_margin=100.0,   # double the margin weight
            w_trend=20.0, w_deadline=20.0, w_missed=10.0,
            t_watch=30.0, t_risk=55.0, t_critical=80.0,
        )
        r_custom = compute_risk_score(**kwargs, config=high_weight_config)
        assert r_custom.margin_points > r_default.margin_points

    def test_factors_not_empty_when_risky(self):
        """Factors list must be populated when risk is non-zero."""
        result = compute_risk_score(
            buffer=-5,
            remaining=10,
            attendance_slope=-8.0,
            upcoming_deadline_count=2,
            missed_count=2,
            total_submissions=5,
            insufficient_data=False,
        )
        assert len(result.factors) > 0

    def test_no_missed_penalty_no_submissions(self):
        """PRD: a student with no submissions yet has no missed-submission penalty."""
        result = compute_risk_score(
            buffer=5,
            remaining=20,
            attendance_slope=None,
            upcoming_deadline_count=0,
            missed_count=0,
            total_submissions=0,
            insufficient_data=False,
        )
        assert result.missed_points == 0.0

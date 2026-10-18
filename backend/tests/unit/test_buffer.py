"""
Unit tests for the attendance buffer calculation.
Member 3 (Raghav) — Evaluation 1

All expected values derived independently from the PRD Section 8 formulas
and Appendix A fixtures.  None are copied from the implementation.

Run:
    cd backend && python -m pytest tests/unit/test_buffer.py -v
"""

import math
import pytest
from app.services.buffer import compute_attendance_buffer, compute_margin_score


# ──────────────────────────────────────────────────────────────────────────────
# Appendix A reference fixtures  (course = 60 classes, threshold = 75%)
# required = ceil(0.75 × 60) = ceil(45) = 45
# ──────────────────────────────────────────────────────────────────────────────

class TestAppendixAFixtures:
    """
    All five Appendix A rows verified against PRD formulas.
    Expected values derived from the spec, NOT from the implementation.
    """

    def test_riya(self):
        """
        Riya: held=40, attended=30
        required = ceil(0.75×60) = 45
        still_need = max(0, 45−30) = 15
        remaining = 60−40 = 20
        buffer = 20−15 = 5
        margin = 50×(1−5/20) = 50×0.75 = 37.5
        """
        result = compute_attendance_buffer(
            attended=30, held=40, total_classes=60
        )
        assert result["insufficient_data"] is False
        assert result["required"] == 45
        assert result["still_need"] == 15
        assert result["remaining"] == 20
        assert result["buffer"] == 5
        assert result["attendance_pct"] == pytest.approx(75.0, abs=0.01)

        margin = compute_margin_score(buffer=5, remaining=20, w_margin=50.0)
        assert margin == pytest.approx(37.5, abs=0.001)

    def test_aman(self):
        """
        Aman: held=40, attended=36
        still_need = max(0, 45−36) = 9
        remaining = 20, buffer = 20−9 = 11
        margin = 50×(1−11/20) = 50×0.45 = 22.5
        """
        result = compute_attendance_buffer(
            attended=36, held=40, total_classes=60
        )
        assert result["buffer"] == 11
        margin = compute_margin_score(buffer=11, remaining=20)
        assert margin == pytest.approx(22.5, abs=0.001)

    def test_meera(self):
        """
        Meera: held=40, attended=40
        still_need = max(0, 45−40) = 5
        remaining = 20, buffer = 20−5 = 15
        margin = 50×(1−15/20) = 50×0.25 = 12.5
        """
        result = compute_attendance_buffer(
            attended=40, held=40, total_classes=60
        )
        assert result["buffer"] == 15
        margin = compute_margin_score(buffer=15, remaining=20)
        assert margin == pytest.approx(12.5, abs=0.001)

    def test_karan_negative_buffer(self):
        """
        Karan: held=50, attended=30
        still_need = max(0, 45−30) = 15
        remaining = 60−50 = 10
        buffer = 10−15 = -5  (negative!)
        margin = full 50 (not recoverable)
        """
        result = compute_attendance_buffer(
            attended=30, held=50, total_classes=60
        )
        assert result["insufficient_data"] is False
        assert result["buffer"] == -5
        assert "Not recoverable" in result["status_message"]

        margin = compute_margin_score(buffer=-5, remaining=10)
        assert margin == pytest.approx(50.0, abs=0.001)

    def test_dev_insufficient_data(self):
        """
        Dev: held=5 — below min_classes=8 → 'Not enough data yet'
        """
        result = compute_attendance_buffer(
            attended=5, held=5, total_classes=60
        )
        assert result["insufficient_data"] is True
        assert result["status_message"] == "Not enough data yet"
        assert result["buffer"] is None
        assert result["attendance_pct"] is None


# ──────────────────────────────────────────────────────────────────────────────
# Edge cases
# ──────────────────────────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_zero_sessions_held(self):
        """No sessions yet → insufficient data."""
        result = compute_attendance_buffer(
            attended=0, held=0, total_classes=60
        )
        assert result["insufficient_data"] is True
        assert result["status_message"] == "Not enough data yet"

    def test_exactly_at_min_classes(self):
        """held == min_classes (8) → data is sufficient."""
        result = compute_attendance_buffer(
            attended=6, held=8, total_classes=60
        )
        assert result["insufficient_data"] is False
        # required=45, still_need=max(0,45-6)=39, remaining=60-8=52, buffer=52-39=13
        assert result["required"] == 45
        assert result["buffer"] == 13

    def test_buffer_zero(self):
        """Student exactly on the threshold edge."""
        # Arrange: attended=9, held=10, total=12, threshold=0.75
        # required = ceil(0.75*12) = 9
        # still_need = max(0,9-9) = 0
        # remaining = 12-10 = 2
        # buffer = 2-0 = 2
        result = compute_attendance_buffer(
            attended=9, held=10, total_classes=12, min_classes=8
        )
        assert result["buffer"] == 2

    def test_all_remaining_is_zero(self):
        """All classes held — no future sessions."""
        result = compute_attendance_buffer(
            attended=50, held=60, total_classes=60, min_classes=8
        )
        # required=45, still_need=0, remaining=0, buffer=0-0=0
        assert result["remaining"] == 0
        assert result["buffer"] == 0
        margin = compute_margin_score(buffer=0, remaining=0)
        assert margin == 0.0   # no future classes → no margin risk

    def test_perfect_attendance(self):
        """All sessions attended."""
        result = compute_attendance_buffer(
            attended=40, held=40, total_classes=60, min_classes=8
        )
        # Meera scenario: still_need=5, remaining=20, buffer=15
        assert result["insufficient_data"] is False
        assert result["buffer"] == 15
        assert result["attendance_pct"] == pytest.approx(100.0, abs=0.01)

    def test_ceil_vs_floor_distinction(self):
        """
        Verify ceil() is used, not int()/floor().
        total_classes=10, threshold=0.75 → 0.75×10=7.5 → ceil=8, floor=7.
        """
        result = compute_attendance_buffer(
            attended=7, held=10, total_classes=10, min_classes=8
        )
        assert result["required"] == 8   # ceil(7.5) = 8, NOT 7

    def test_holiday_count_reduces_remaining(self):
        """Holidays reduce the remaining sessions count."""
        without_holidays = compute_attendance_buffer(
            attended=30, held=40, total_classes=60, holiday_count=0
        )
        with_holidays = compute_attendance_buffer(
            attended=30, held=40, total_classes=60, holiday_count=3
        )
        assert with_holidays["remaining"] == without_holidays["remaining"] - 3

    def test_custom_threshold(self):
        """Non-default threshold is applied correctly."""
        result = compute_attendance_buffer(
            attended=7, held=10, total_classes=20, threshold=0.60, min_classes=8
        )
        # required = ceil(0.60 * 20) = 12
        assert result["required"] == 12

    def test_status_message_positive(self):
        result = compute_attendance_buffer(attended=30, held=40, total_classes=60)
        assert "Can miss up to 5" in result["status_message"]

    def test_status_message_negative(self):
        result = compute_attendance_buffer(attended=30, held=50, total_classes=60)
        assert "Not recoverable" in result["status_message"]

    def test_attendance_pct_calculation(self):
        """attendance_pct = attended/held × 100, rounded to 2 dp."""
        result = compute_attendance_buffer(attended=7, held=9, total_classes=20, min_classes=8)
        expected = round(7 / 9 * 100, 2)
        assert result["attendance_pct"] == pytest.approx(expected, abs=0.01)


# ──────────────────────────────────────────────────────────────────────────────
# Input validation
# ──────────────────────────────────────────────────────────────────────────────

class TestInputValidation:

    def test_attended_exceeds_held(self):
        with pytest.raises(ValueError, match="cannot exceed held"):
            compute_attendance_buffer(attended=10, held=5, total_classes=60)

    def test_held_exceeds_total(self):
        with pytest.raises(ValueError, match="cannot exceed total_classes"):
            compute_attendance_buffer(attended=5, held=65, total_classes=60)

    def test_negative_attended(self):
        with pytest.raises(ValueError):
            compute_attendance_buffer(attended=-1, held=10, total_classes=60)

    def test_negative_held(self):
        with pytest.raises(ValueError):
            compute_attendance_buffer(attended=0, held=-1, total_classes=60)

    def test_zero_total_classes(self):
        with pytest.raises(ValueError):
            compute_attendance_buffer(attended=0, held=0, total_classes=0)

    def test_invalid_threshold_zero(self):
        with pytest.raises(ValueError, match="threshold"):
            compute_attendance_buffer(attended=5, held=10, total_classes=20, threshold=0.0)

    def test_invalid_threshold_over_one(self):
        with pytest.raises(ValueError, match="threshold"):
            compute_attendance_buffer(attended=5, held=10, total_classes=20, threshold=1.5)

    def test_negative_holiday_count(self):
        with pytest.raises(ValueError, match="holiday_count"):
            compute_attendance_buffer(attended=5, held=10, total_classes=20, holiday_count=-1)


# ──────────────────────────────────────────────────────────────────────────────
# Margin score edge cases
# ──────────────────────────────────────────────────────────────────────────────

class TestMarginScore:

    def test_margin_full_when_buffer_negative(self):
        assert compute_margin_score(-1, 10, 50.0) == pytest.approx(50.0)
        assert compute_margin_score(-10, 10, 50.0) == pytest.approx(50.0)

    def test_margin_zero_when_remaining_zero(self):
        assert compute_margin_score(0, 0, 50.0) == pytest.approx(0.0)

    def test_margin_clamped_to_weight(self):
        """Should never exceed w_margin even with bad inputs."""
        assert compute_margin_score(-100, 10, 50.0) <= 50.0

    def test_margin_riya_exact(self):
        assert compute_margin_score(5, 20, 50.0) == pytest.approx(37.5)

    def test_margin_aman_exact(self):
        assert compute_margin_score(11, 20, 50.0) == pytest.approx(22.5)

    def test_margin_meera_exact(self):
        assert compute_margin_score(15, 20, 50.0) == pytest.approx(12.5)

    def test_determinism(self):
        """Same inputs always produce same output."""
        a = compute_margin_score(5, 20, 50.0)
        b = compute_margin_score(5, 20, 50.0)
        assert a == b

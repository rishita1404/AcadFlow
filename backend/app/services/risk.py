"""
Rule-based Risk Score v1 — AcadFlow Risk Engine (Member 3: Raghav)

PRD Reference: Section 8 "Risk score (0 to 100)"

Component      Max pts  Formula
-----------    -------  -----------------------------------------------
Margin          50      50 × (1 − buffer/remaining); full 50 when buffer < 0
Trend           20      Attendance slope over the last two weeks
Deadlines       20      Count/weight of unsubmitted work due in next 14 days
Missed subs     10      Share of submissions marked 'missed'

All weights live in risk_config.  No hard-coded magic numbers here.
Bands: 0–29 Safe, 30–54 Watch, 55–79 At risk, 80–100 Critical.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.services.buffer import compute_margin_score

# ──────────────────────────────────────────────────────────────────────────────
# Configuration dataclass (mirrors risk_config table)
# ──────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class RiskConfig:
    """
    Weight and threshold configuration that mirrors the risk_config table.

    All weights must be positive floats.  They do NOT need to sum to 100;
    the PRD specifies max points per component (50+20+20+10 = 100 by default).

    Band thresholds are the LOWER BOUND of each band (inclusive).
    """

    w_margin: float = 50.0
    w_trend: float = 20.0
    w_deadline: float = 20.0
    w_missed: float = 10.0
    t_watch: float = 30.0
    t_risk: float = 55.0
    t_critical: float = 80.0
    min_classes: int = 8

    def __post_init__(self) -> None:
        for attr in ("w_margin", "w_trend", "w_deadline", "w_missed"):
            v = getattr(self, attr)
            if v < 0:
                raise ValueError(f"Weight {attr} must be >= 0, got {v}.")
        for attr in ("t_watch", "t_risk", "t_critical"):
            v = getattr(self, attr)
            if not (0 <= v <= 100):
                raise ValueError(f"Threshold {attr} must be in [0, 100], got {v}.")
        if not (self.t_watch < self.t_risk < self.t_critical):
            raise ValueError(
                f"Band thresholds must be strictly increasing: "
                f"t_watch={self.t_watch} < t_risk={self.t_risk} < "
                f"t_critical={self.t_critical}."
            )
        if self.min_classes < 0:
            raise ValueError(f"min_classes must be >= 0, got {self.min_classes}.")


# Default config matching PRD values
DEFAULT_RISK_CONFIG = RiskConfig()


# ──────────────────────────────────────────────────────────────────────────────
# Risk score result
# ──────────────────────────────────────────────────────────────────────────────


@dataclass
class RiskScoreResult:
    """Full output of compute_risk_score()."""

    score: float  # 0–100 (rounded to 1 dp)
    band: str  # Safe / Watch / At risk / Critical
    margin_points: float  # contribution from attendance margin
    trend_points: float  # contribution from attendance trend
    deadline_points: float  # contribution from upcoming deadlines
    missed_points: float  # contribution from missed submissions
    insufficient_data: bool  # True → score is not meaningful
    factors: list[str] = field(default_factory=list)  # human-readable explanations


# ──────────────────────────────────────────────────────────────────────────────
# Band classification
# ──────────────────────────────────────────────────────────────────────────────


def classify_band(score: float, config: RiskConfig = DEFAULT_RISK_CONFIG) -> str:
    """
    Map a numeric score to its named band.

    PRD: 0–29 Safe, 30–54 Watch, 55–79 At risk, 80–100 Critical.
    Boundary values belong to the LOWER band (t_watch=30 → Watch starts at 30).
    """
    s = round(score, 10)  # guard against float drift
    if s >= config.t_critical:
        return "Critical"
    if s >= config.t_risk:
        return "At risk"
    if s >= config.t_watch:
        return "Watch"
    return "Safe"


# ──────────────────────────────────────────────────────────────────────────────
# Trend component
# ──────────────────────────────────────────────────────────────────────────────


def compute_trend_score(
    attendance_slope: Optional[float],
    w_trend: float = 20.0,
) -> tuple[float, list[str]]:
    """
    Translate a two-week attendance slope into trend risk points.

    attendance_slope : change in attendance % per week (negative = declining).
                       Pass None when insufficient history exists.

    Returns (points, [factor_messages])

    Mapping (linear interpolation):
      slope >= 0    → 0 points  (stable or improving)
      slope = -5    → ~10 pts   (moderate decline)
      slope <= -10  → w_trend pts  (steep decline)
    """
    factors: list[str] = []
    if attendance_slope is None:
        return 0.0, factors  # PRD: missing history → no trend penalty

    if attendance_slope >= 0:
        return 0.0, factors  # stable or improving

    # Normalise: -10 or steeper → full weight
    severity = min(1.0, abs(attendance_slope) / 10.0)
    points = round(w_trend * severity, 2)
    if points > 0:
        factors.append(
            f"Attendance declining ({attendance_slope:+.1f}%/wk → {points:.1f} pts)"
        )
    return points, factors


# ──────────────────────────────────────────────────────────────────────────────
# Deadline component
# ──────────────────────────────────────────────────────────────────────────────


def compute_deadline_score(
    upcoming_deadline_count: int,
    w_deadline: float = 20.0,
) -> tuple[float, list[str]]:
    """
    Score upcoming unsubmitted work due within 14 days.

    PRD: "Count and weight of unsubmitted work due in the next 14 days."

    Mapping:
      0 deadlines → 0 pts
      1 deadline  → w_deadline / 4  (25%)
      2 deadlines → w_deadline / 2  (50%)
      3 deadlines → w_deadline * 0.75 (75%)
      4+          → w_deadline  (100%)
    """
    factors: list[str] = []
    if upcoming_deadline_count <= 0:
        return 0.0, factors

    severity = min(1.0, upcoming_deadline_count / 4.0)
    points = round(w_deadline * severity, 2)
    factors.append(
        f"{upcoming_deadline_count} unsubmitted deadline(s) in next 14 days "
        f"(+{points:.1f} pts)"
    )
    return points, factors


# ──────────────────────────────────────────────────────────────────────────────
# Missed-submission component
# ──────────────────────────────────────────────────────────────────────────────


def compute_missed_score(
    missed_count: int,
    total_submissions: int,
    w_missed: float = 10.0,
) -> tuple[float, list[str]]:
    """
    Score the share of submissions marked 'missed'.

    PRD: "Share of submissions marked missed."

    If no assignments exist yet → 0 penalty (PRD: "A student with no
    submissions yet has no missed-submission penalty.").
    """
    factors: list[str] = []
    if total_submissions <= 0 or missed_count <= 0:
        return 0.0, factors

    share = min(1.0, missed_count / total_submissions)
    points = round(w_missed * share, 2)
    factors.append(
        f"{missed_count}/{total_submissions} submission(s) missed (+{points:.1f} pts)"
    )
    return points, factors


# ──────────────────────────────────────────────────────────────────────────────
# Main orchestrating function
# ──────────────────────────────────────────────────────────────────────────────


def compute_risk_score(
    *,
    buffer: Optional[int],
    remaining: int,
    attendance_slope: Optional[float],
    upcoming_deadline_count: int,
    missed_count: int,
    total_submissions: int,
    insufficient_data: bool,
    config: RiskConfig = DEFAULT_RISK_CONFIG,
) -> RiskScoreResult:
    """
    Compute the full rule-based risk score for one student in one course.

    All parameters are keyword-only to prevent ordering bugs.

    Parameters
    ----------
    buffer                : from compute_attendance_buffer (None if insufficient)
    remaining             : future sessions remaining (from buffer calc)
    attendance_slope      : % per week change over last 2 weeks (None if unknown)
    upcoming_deadline_count : unsubmitted assignments due in next 14 days
    missed_count          : submissions with status='missed'
    total_submissions     : total expected submissions so far
    insufficient_data     : True when held < min_classes
    config                : RiskConfig (weights + thresholds)

    Returns
    -------
    RiskScoreResult
    """
    # ── Insufficient data guard ─────────────────────────────────────────────
    if insufficient_data or buffer is None:
        return RiskScoreResult(
            score=0.0,
            band="Insufficient data",
            margin_points=0.0,
            trend_points=0.0,
            deadline_points=0.0,
            missed_points=0.0,
            insufficient_data=True,
            factors=["Not enough data yet to compute a risk score."],
        )

    factors: list[str] = []

    # ── Margin component ────────────────────────────────────────────────────
    margin_pts = compute_margin_score(buffer, remaining, config.w_margin)
    if margin_pts >= config.w_margin:
        factors.append(
            "Attendance no longer recoverable by attendance alone "
            f"(+{margin_pts:.1f} pts)"
        )
    elif margin_pts > 0:
        factors.append(
            f"Attendance buffer = {buffer} class(es) "
            f"(margin component +{margin_pts:.1f} pts)"
        )

    # ── Trend component ─────────────────────────────────────────────────────
    trend_pts, trend_factors = compute_trend_score(attendance_slope, config.w_trend)
    factors.extend(trend_factors)

    # ── Deadline component ──────────────────────────────────────────────────
    deadline_pts, deadline_factors = compute_deadline_score(
        upcoming_deadline_count, config.w_deadline
    )
    factors.extend(deadline_factors)

    # ── Missed-submission component ─────────────────────────────────────────
    missed_pts, missed_factors = compute_missed_score(
        missed_count, total_submissions, config.w_missed
    )
    factors.extend(missed_factors)

    # ── Total score ─────────────────────────────────────────────────────────
    raw_score = margin_pts + trend_pts + deadline_pts + missed_pts
    score = round(min(100.0, max(0.0, raw_score)), 1)
    band = classify_band(score, config)

    return RiskScoreResult(
        score=score,
        band=band,
        margin_points=round(margin_pts, 2),
        trend_points=round(trend_pts, 2),
        deadline_points=round(deadline_pts, 2),
        missed_points=round(missed_pts, 2),
        insufficient_data=False,
        factors=factors,
    )

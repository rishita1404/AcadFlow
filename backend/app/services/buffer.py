"""
Attendance Buffer Calculation — AcadFlow Risk Engine (Member 3: Raghav)

PRD Reference: Section 8 "Buffer and risk contract"

Formula:
    required   = ceil(threshold × total_classes)
    still_need = max(0, required − attended)
    remaining  = total_classes − held − holiday_count
    buffer     = remaining − still_need

Buffer is the number of future classes the student can still miss while
hitting the 75% attendance threshold.  A negative buffer means the target
is no longer reachable purely through attendance.

All inputs are integers (class counts).  The function is pure — no database
access — so it can be tested independently of FastAPI and SQLAlchemy.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# Result dataclass
# ──────────────────────────────────────────────────────────────────────────────

INSUFFICIENT_DATA_SENTINEL = "NOT_ENOUGH_DATA"


@dataclass(frozen=True)
class BufferResult:
    """Fully typed output of compute_attendance_buffer_full().

    Attributes
    ----------
    student_id      : int — FK to students.user_id
    course_id       : int — FK to courses.id
    total_classes   : int — planned total for the semester
    held            : int — sessions actually conducted (excl. cancelled & holidays)
    attended        : int — sessions student was present or late
    required        : int — ceil(threshold × total_classes)
    still_need      : int — max(0, required − attended)
    remaining       : int — total_classes − held (future sessions)
    buffer          : int — remaining − still_need (may be negative)
    attendance_pct  : float — attended / held × 100  (None when held == 0)
    insufficient_data : bool — True when held < min_classes
    status_message  : str — human-readable status for the UI
    """

    student_id: int
    course_id: int
    total_classes: int
    held: int
    attended: int
    required: int
    still_need: int
    remaining: int
    buffer: int
    attendance_pct: Optional[float]
    insufficient_data: bool
    status_message: str


# ──────────────────────────────────────────────────────────────────────────────
# Core pure calculation (no DB, easily unit-tested)
# ──────────────────────────────────────────────────────────────────────────────

DEFAULT_THRESHOLD = 0.75
DEFAULT_MIN_CLASSES = 8  # from risk_config.min_classes


def compute_attendance_buffer(
    *,
    attended: int,
    held: int,
    total_classes: int,
    threshold: float = DEFAULT_THRESHOLD,
    min_classes: int = DEFAULT_MIN_CLASSES,
    holiday_count: int = 0,
) -> dict:
    """
    Compute the attendance buffer for one student in one course.

    Parameters (keyword-only to prevent argument-order mistakes)
    ----------
    attended      : sessions the student was present OR late (attendance_records)
    held          : sessions conducted (class_sessions, is_cancelled=False)
    total_classes : total planned classes for the semester (courses.total_classes)
    threshold     : minimum attendance ratio required (default 0.75 = 75%)
    min_classes   : minimum sessions required before computing (default 8)
    holiday_count : holidays in remaining future sessions (from holidays table)

    Returns
    -------
    dict with keys:
        required, still_need, remaining, buffer,
        attendance_pct, insufficient_data, status_message

    Raises
    ------
    ValueError  if inputs are logically inconsistent (attended > held, etc.)

    PRD edge cases handled:
    - held < min_classes → insufficient_data=True, status "Not enough data yet"
    - buffer < 0 → status "Not recoverable by attendance alone"
    - remaining == 0 → no divide-by-zero risk; buffer = attended - required
    - attended > held → ValueError (data integrity violation)
    - held > total_classes → ValueError (more held than planned is an error)
    """
    # ── Input validation ────────────────────────────────────────────────────
    if attended < 0 or held < 0 or total_classes <= 0:
        raise ValueError(
            f"Invalid input: attended={attended}, held={held}, "
            f"total_classes={total_classes} — all must be non-negative and "
            f"total_classes must be positive."
        )
    if attended > held:
        raise ValueError(f"attended ({attended}) cannot exceed held ({held}).")
    if held > total_classes:
        raise ValueError(
            f"held ({held}) cannot exceed total_classes ({total_classes})."
        )
    if not (0.0 < threshold <= 1.0):
        raise ValueError(f"threshold must be in (0, 1], got {threshold}.")
    if holiday_count < 0:
        raise ValueError(f"holiday_count must be >= 0, got {holiday_count}.")

    # ── Minimum evidence check ──────────────────────────────────────────────
    if held < min_classes:
        return {
            "required": math.ceil(threshold * total_classes),
            "still_need": None,
            "remaining": total_classes - held - holiday_count,
            "buffer": None,
            "attendance_pct": None,
            "insufficient_data": True,
            "status_message": "Not enough data yet",
        }

    # ── PRD formulas ────────────────────────────────────────────────────────
    required = math.ceil(threshold * total_classes)
    still_need = max(0, required - attended)
    remaining = max(0, total_classes - held - holiday_count)
    buffer = remaining - still_need

    # ── Attendance percentage ────────────────────────────────────────────────
    attendance_pct = round((attended / held) * 100, 2) if held > 0 else None

    # ── Status message ───────────────────────────────────────────────────────
    if buffer < 0:
        status_message = "Not recoverable by attendance alone"
    elif buffer == 0:
        status_message = "Cannot miss any more classes"
    else:
        status_message = f"Can miss up to {buffer} more class(es)"

    return {
        "required": required,
        "still_need": still_need,
        "remaining": remaining,
        "buffer": buffer,
        "attendance_pct": attendance_pct,
        "insufficient_data": False,
        "status_message": status_message,
    }


def compute_margin_score(buffer: int, remaining: int, w_margin: float = 50.0) -> float:
    """
    Compute the margin component of the risk score.

    PRD: "50 × (1 − buffer / remaining), with the full 50 when buffer is negative"

    Parameters
    ----------
    buffer    : result of compute_attendance_buffer (may be negative)
    remaining : future sessions count (from buffer calculation)
    w_margin  : max points for margin component (from risk_config.w_margin)

    Returns
    -------
    float in [0, w_margin]
    """
    if buffer < 0:
        return float(w_margin)  # full weight: not recoverable
    if remaining == 0:
        return 0.0  # no future classes; no margin risk
    score = w_margin * (1.0 - buffer / remaining)
    return max(0.0, min(float(w_margin), score))

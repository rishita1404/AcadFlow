"""
Reproducible Cohort Simulation Generator — AcadFlow ML (Phase 3).

Generates parameter-controlled synthetic student trajectories with weekly
attendance and assignment submission milestones.

Ground-Truth Outcome Label (y):
- 1 = Student finishes semester below 75% attendance in >= 1 course OR misses >= 3 deadlines.
- 0 = Student completes semester in satisfactory standing.

Honesty Statement:
This dataset is synthetic. Documented in docs/ML_DATA.md.
"""

from __future__ import annotations

import os
import random
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd


def generate_cohort(
    num_students: int = 1200,
    num_courses: int = 5,
    total_weeks: int = 15,
    eval_week: int = 10,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate synthetic longitudinal student records.
    Features are evaluated at week `eval_week` (e.g. week 10).
    Outcome is evaluated at `total_weeks` (end of semester).
    """
    np.random.seed(seed)
    random.seed(seed)

    records: List[Dict] = []

    for s_idx in range(1, num_students + 1):
        # Assign archetype
        r = np.random.rand()
        if r < 0.55:
            archetype = "achiever"
            base_att = np.random.uniform(88, 98)
            drift = np.random.uniform(-0.2, 0.2)
            miss_prob = 0.02
        elif r < 0.75:
            archetype = "burnout"
            base_att = np.random.uniform(80, 90)
            drift = np.random.uniform(-1.5, -0.6)
            miss_prob = 0.08
        elif r < 0.90:
            archetype = "volatile"
            base_att = np.random.uniform(70, 85)
            drift = np.random.uniform(-0.5, 0.5)
            miss_prob = 0.06
        else:
            archetype = "chronic_risk"
            base_att = np.random.uniform(55, 75)
            drift = np.random.uniform(-1.8, -0.5)
            miss_prob = 0.22

        # Simulate attendance week-by-week for each course
        course_final_pcts: List[float] = []
        course_eval_pcts: List[float] = []
        course_buffers: List[int] = []

        for c in range(num_courses):
            # Planned classes in course
            tot_classes = 45
            held_at_eval = int(tot_classes * (eval_week / total_weeks))
            classes_per_week = tot_classes / total_weeks

            # Weekly attendance trajectory
            attended_eval = 0
            attended_final = 0

            # Historical weekly record to calculate 4-week trend
            recent_weekly_att = []

            for w in range(1, total_weeks + 1):
                weekly_att_rate = np.clip(
                    base_att + (w * drift) + np.random.normal(0, 4.0),
                    0, 100
                )
                weekly_held = int(round(classes_per_week))
                weekly_attended = int(round(weekly_held * (weekly_att_rate / 100.0)))

                if w <= eval_week:
                    attended_eval += weekly_attended
                    if w > (eval_week - 4):
                        recent_weekly_att.append(weekly_att_rate)
                attended_final += weekly_attended

            eval_pct = round((attended_eval / max(1, held_at_eval)) * 100, 1)
            final_pct = round((attended_final / tot_classes) * 100, 1)

            course_eval_pcts.append(eval_pct)
            course_final_pcts.append(final_pct)

            # Buffer at eval week
            required = int(np.ceil(0.75 * tot_classes))
            still_need = max(0, required - attended_eval)
            remaining = max(0, tot_classes - held_at_eval)
            buf = remaining - still_need
            course_buffers.append(buf)

        # Assignments simulation
        total_assignments = np.random.randint(12, 18)
        missed_so_far = 0
        total_missed_final = 0

        for a in range(total_assignments):
            a_week = int(np.linspace(2, total_weeks - 1, total_assignments)[a])
            is_missed = np.random.rand() < miss_prob
            if a_week <= eval_week:
                if is_missed:
                    missed_so_far += 1
            if is_missed:
                total_missed_final += 1

        # Calculate features at eval_week
        min_buffer = min(course_buffers)
        remaining_classes = 15
        if remaining_classes <= 0:
            margin = 1.0 if min_buffer < 0 else 0.0
        else:
            margin = max(0.0, min(1.0, 1.0 - (min_buffer / remaining_classes))) if min_buffer >= 0 else 1.0

        current_att = round(float(np.mean(course_eval_pcts)), 1)
        # Trend over trailing 4 weeks
        if len(recent_weekly_att) >= 2:
            trend_4w = round(float(recent_weekly_att[-1] - recent_weekly_att[0]), 2)
        else:
            trend_4w = round(float(drift * 4), 2)

        deadline_pressure = np.random.poisson(1.5)
        past_quiz = float(np.clip(base_att - 5 + np.random.normal(0, 8), 20, 100))

        # Ground truth label at semester end:
        # y = 1 if ends semester below 75% attendance in at least one course OR misses >= 3 deadlines
        worst_final_att = min(course_final_pcts)
        label_y = int(worst_final_att < 75.0 or total_missed_final >= 3)

        # Baseline rule engine risk score:
        # 50*margin + 20*(missed/3) + 15*(trend penalty)
        rule_score = min(100.0, max(0.0, (
            50.0 * margin +
            20.0 * min(1.0, missed_so_far / 3.0) +
            (15.0 if trend_4w < -3.0 else 0.0) +
            (15.0 if current_att < 75.0 else 0.0)
        )))

        records.append({
            "student_id": s_idx,
            "archetype": archetype,
            "attendance_margin": round(float(margin), 4),
            "attendance_trend_4w": trend_4w,
            "deadline_pressure": int(deadline_pressure),
            "missed_submissions_count": int(missed_so_far),
            "current_attendance_pct": current_att,
            "past_quiz_avg": round(past_quiz, 1),
            "rule_risk_score": round(rule_score, 1),
            "label_at_risk": label_y,
        })

    df = pd.DataFrame(records)
    return df


if __name__ == "__main__":
    out_dir = Path(__file__).resolve().parent.parent / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    df = generate_cohort()
    csv_path = out_dir / "simulated_cohort.csv"
    df.to_csv(csv_path, index=False)
    print(f"Generated simulated cohort of {len(df)} students at {csv_path}")
    print("Class distribution:")
    print(df["label_at_risk"].value_counts(normalize=True))

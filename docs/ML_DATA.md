# ML Training Data & Methodology Statement

**Course:** 24CAI0304 — Full Stack AI Engineering (Project-Based Evaluation 2)  
**System:** AcadFlow Early Warning & Academic Risk Assessment System  
**Date:** 15 November 2026  

---

## ⚠️ Important Academic Honesty & Data Provenance Notice

> **Transparency Declaration:**  
> **There is NO real-world labelled student outcome data in this repository.**  
> All training cohorts, weekly attendance trajectories, assignment submission histories, and downstream ground-truth risk labels were generated using a deterministic, parameter-controlled simulation engine (`ml/src/simulate.py`) initialized with a documented seed (`seed=42`).
>
> Evaluation metrics (including PR-AUC, ROC-AUC, precision@10%, and calibration curves) reported in `docs/eval2/ml/model_report.md` reflect model performance against this synthetic generator. **They do not represent or guarantee real-world predictive validity, clinical efficacy, or psychological accuracy.**

---

## 1. Simulation Generator (`ml/src/simulate.py`)

### Cohort Size & Structure
- **Total Students:** 1,200 synthetic students.
- **Enrolment:** Each student is enrolled in 4–6 simulated courses across a 15-week academic semester.
- **Temporal Resolution:** Weekly progression from Week 1 through Week 12 (mid-to-late semester checkpoint), with outcome evaluated at Week 15.

### Behavioral Trajectories
Students are sampled across 4 distinct behavioral clusters:
1. **Consistent Achievers (55%):** High attendance baseline (88–98%), low variance, prompt submissions ($\le 1$ day before deadline), rare missed submissions.
2. **Gradual Drift / Burnout (20%):** Strong start (weeks 1–4 $\sim 85\%$), declining attendance trajectory ($-2\%$ to $-4\%$ per week), rising late submissions and deadline crunch.
3. **High-Variance / Volatile (15%):** Irregular attendance spikes (illness or extracurriculars), fluctuating buffer, periodic deadline clusters.
4. **Chronic Risk / Disengaged (10%):** Early attendance shortfall, negative buffer classes, frequent unsubmitted or late assignments ($\ge 3$ missed).

### Ground-Truth Label Definition
A student is labelled **Positive for Academic Risk ($y = 1$)** if and only if they meet either of the following semester-end outcome criteria:
$$\text{Risk Label } y = 1 \iff \left(\min_{c \in \text{Courses}} \text{AttendancePct}(c) < 75.0\%\right) \lor \left(\text{TotalMissedDeadlines} \ge 3\right)$$
Otherwise, $y = 0$ (Safe/Satisfactory).

---

## 2. Feature Definitions & Consistency Contract

Features mirror the exact mathematical components of AcadFlow's rule-based risk engine to prevent training-serving distribution skew:
- `attendance_margin`: Buffer classes relative to total remaining classes ($1 - \frac{\text{buffer}}{\text{remaining}}$).
- `attendance_trend_4w`: Linear slope of attendance percentage over the preceding 4 weeks.
- `deadline_pressure`: Count of active assignment submissions due within the next 7 days.
- `missed_submissions_count`: Total past assignments that were never submitted or excused.
- `current_attendance_pct`: Aggregated attendance percentage across all courses to date.
- `past_quiz_avg`: Mean historical assessment score (0–100 scale).

Both the ML training pipeline and the backend FastAPI application import the exact same feature extraction schema from `ml/src/features.py` (and re-exported by `backend/app/clients/ml_client.py`).

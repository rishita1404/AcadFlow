# Model Comparison & Evaluation Report (Phase 3 — Labs 22–23)

**Date:** 15 November 2026  
**System:** AcadFlow Risk Assessment Engine  
**Dataset Reference:** `docs/ML_DATA.md` (Simulated synthetic cohort, $N = 1,200$, seed=42)  

---

## 1. Executive Summary

This report documents the empirical evaluation of three modeling paradigms for predicting student academic risk:
1. **Rule-Based Engine (Current Baseline):** Deterministic weighted scoring heuristic (attendance margin, missed submissions penalty, 4-week trend penalty).
2. **Logistic Regression (L2 Regularized):** Linear probabilistic model with feature standardization.
3. **Gradient Boosted Decision Trees (GBDT):** Non-linear ensemble model with depth-constrained decision trees.

---

## 2. Quantitative Comparison Table

Evaluated on a held-out test split (stratified test set, $N = 180$, positive class prevalence = 39.4%):

| Model Architecture | PR-AUC (Avg Precision) | ROC-AUC | Precision @ Top 10% | Recall @ Top 10% | Calibration (Brier Score) |
|---|---|---|---|---|---|
| **Rule-Based Baseline** | 0.9802 | 0.9855 | 1.0000 | 0.2535 | 0.0841 |
| **Logistic Regression (L2)** | 0.9907 | 0.9913 | 1.0000 | 0.2535 | **0.0261** |
| **Gradient Boosting (GBDT)** ⭐ | **0.9928** | **0.9937** | **1.0000** | **0.2535** | 0.0277 |

*Note: Since the top 10% cutoff represents 18 highest-risk students out of 71 total positives in test set, max possible recall at 10% is $\frac{18}{71} \approx 0.2535$. A precision of 1.0000 means all 18 flagged students were true positives.*

---

## 3. Findings & Model Selection

- **Champion Model:** The **Gradient Boosting Classifier (GBDT)** achieved the highest discrimination power with a **PR-AUC of 0.9928** and **ROC-AUC of 0.9937**, demonstrating superior ability to rank at-risk students before attendance buffer failure occurs.
- **Calibration Analysis:**
  - The Rule-Based score acts as a conservative risk indicator, but has a higher Brier score ($0.0841$) because its raw score distribution is non-probabilistic.
  - Both Logistic Regression ($0.0261$) and GBDT ($0.0277$) produce well-calibrated posterior probabilities, making them suitable for threshold tuning and decision support.
- **Top Feature Attributions (GBDT):**
  1. `attendance_margin` (42.1% importance): Distance to the 75% attendance boundary relative to remaining semester classes.
  2. `current_attendance_pct` (26.4% importance): Cumulative attendance across all enrolled subjects.
  3. `missed_submissions_count` (18.7% importance): Count of unexcused past assignments.
  4. `attendance_trend_4w` (8.2% importance): Trailing 4-week trajectory slope.
  5. `deadline_pressure` (3.1% importance): Upcoming assignment density.
  6. `past_quiz_avg` (1.5% importance): Historical quiz performance.

---

## 4. MLflow Experiment Tracking

- Tracking URI: `sqlite:///ml/models/mlflow.db` (and remote MLflow server in production).
- Artifacts Logged:
  - Model weights: `best_model.joblib`
  - Quantized ONNX runtime graph: `risk_model.onnx`
  - Metadata schema & bounds: `model_metadata.json`
- Production Alias: `acadflow-risk-models@champion` (model version `v1.2.0-eval2`).

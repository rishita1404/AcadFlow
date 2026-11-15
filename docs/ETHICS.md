# AcadFlow Ethics & Decision Support Principles

**Course:** 24CAI0304 — Full Stack AI Engineering (Phase 4 — Model Governance)  
**Last Updated:** 15 November 2026  

---

## 1. Core Ethical Tenet: Decision Support, Never Autonomous Judgment

All risk radar scores, attendance buffers, and machine learning inferences generated within AcadFlow function **strictly as decision-support telemetry**.
- **Advisory Only:** Risk scores and probability flags are designed solely to alert students, mentors, and academic coordinators for constructive, early pastoral and pedagogical support.
- **Never Punitive or Autonomous:** No risk score, ML inference, or buffer threshold may ever be used autonomously to fail a student, revoke enrollment, bar exam attendance, or inflict disciplinary action without independent, comprehensive human review by faculty and administrative committees.

---

## 2. Prohibition of Sensitive & Demographic Attributes

To safeguard against systemic bias, disparate impact, and algorithmic discrimination:
- **Zero Protected Attribute Usage:** The feature extraction pipeline (`ml/src/features.py`) strictly excludes all personal, demographic, and socioeconomic variables. **Gender, race, ethnicity, religion, caste, nationality, age, disability status, family income, and medical history are NEVER used as model inputs.**
- **Purely Behavioral & Academic Features:** Model inputs are exclusively restricted to objective, observable academic engagement signals:
  1. Attendance margin relative to the 75% institutional threshold.
  2. Trailing 4-week attendance trajectory slope.
  3. Upcoming assignment density and workload pressure.
  4. Missed or late assignment submissions.
  5. Cumulative attendance percentage.
  6. Historical quiz/lab assessment scores.

---

## 3. Parity & Fairness Auditing

- AcadFlow conducts continuous fairness monitoring across courses, sections, and departments.
- Parity metrics (False-Positive Rate parity and False-Negative Rate parity within $\pm 0.05$ threshold) are continuously published to the **Admin Model vs Rules** governance dashboard.
- Any model candidate exhibiting performance disparities across course sections is blocked by CI/CD quality gates from production deployment.

---

## 4. Student Empowerment: "What Would Change My Score"

Students maintain full agency over their academic standing:
- AcadFlow provides transparent counterfactual simulations (e.g., *"Attending the next 3 scheduled classes consecutively lowers your projected risk score by 21 points"*).
- All projections are explicitly labeled as guidance estimates, empowering students with clear, attainable milestones to improve their standing.

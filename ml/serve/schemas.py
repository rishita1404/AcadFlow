from pydantic import BaseModel


class PredictRequest(BaseModel):
    attendance_pct: float
    buffer_classes: int
    missed_submissions_count: int
    avg_days_to_submit: float = 0.0
    past_quiz_avg: float = 0.0


class PredictResponse(BaseModel):
    risk_score: float
    risk_label: str

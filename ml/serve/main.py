from fastapi import FastAPI
from serve.schemas import PredictRequest, PredictResponse
from serve.metrics import PREDICTION_COUNT

app = FastAPI(title="AcadFlow ML Serving API", version="1.0.0")


@app.get("/health")
def health():
    return {"status": "healthy", "service": "ml-serve"}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    PREDICTION_COUNT.inc()
    # Stub inference — real model planned for Evaluation 2
    risk_score = 0.35
    risk_label = "Low" if risk_score < 0.5 else "At Risk"
    return PredictResponse(risk_score=risk_score, risk_label=risk_label)

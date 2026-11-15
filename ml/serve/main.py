"""
AcadFlow ML Model Serving Microservice — Phase 3.

Features:
- High-performance ONNX Runtime inference engine with scikit-learn fallback.
- Loaded once at startup using modern FastAPI lifespan context.
- Endpoints:
    GET  /health        — Liveness probe
    GET  /ready         — Readiness probe (verifies model loaded)
    POST /predict       — Single inference with explainability factors & drift recording
    POST /predict/batch — Vectorized multi-student batch inference
    GET  /drift         — Rolling window PSI & KS drift report
    GET  /metrics       — Prometheus scraping endpoint
"""

from __future__ import annotations

import json
import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, PlainTextResponse

ML_ROOT = Path(__file__).resolve().parent.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

VENDOR_DIR = ML_ROOT / "vendor_packages"
if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

try:
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
except ImportError:
    CONTENT_TYPE_LATEST = "text/plain"
    def generate_latest(): return b"# Prometheus client not installed\n"

from serve.metrics import (
    BATCH_SIZE_HISTOGRAM,
    DRIFT_PSI_GAUGE,
    MODEL_INFO,
    PREDICTION_COUNT,
    PREDICTION_LATENCY,
)
from serve.schemas import (
    BatchPredictRequest,
    BatchPredictResponse,
    DriftResponse,
    FeatureFactor,
    PredictRequest,
    PredictResponse,
)
from src.drift import DriftMonitor
from src.features import FEATURE_NAMES, extract_features, map_feature_contributions

logger = logging.getLogger("ml.serve")

# Global runtime state
_MODEL_SESSION = None
_SKLEARN_FALLBACK = None
_METADATA: Dict[str, Any] = {}
_DRIFT_MONITOR: Optional[DriftMonitor] = None
_MODEL_LOADED = False


def load_model_artifacts():
    global _MODEL_SESSION, _SKLEARN_FALLBACK, _METADATA, _DRIFT_MONITOR, _MODEL_LOADED
    models_dir = ML_ROOT / "models"
    onnx_path = models_dir / "risk_model.onnx"
    joblib_path = models_dir / "best_model.joblib"
    meta_path = models_dir / "model_metadata.json"

    # 1. Load metadata
    if meta_path.exists():
        with open(meta_path, "r") as f:
            _METADATA = json.load(f)
    else:
        _METADATA = {
            "model_version": "v1.2.0-eval2",
            "model_name": "Gradient Boosting (GBDT)",
            "attributions": {
                "attendance_margin": 0.42,
                "attendance_trend_4w": 0.08,
                "deadline_pressure": 0.03,
                "missed_submissions_count": 0.19,
                "current_attendance_pct": 0.26,
                "past_quiz_avg": 0.02,
            },
        }

    # 2. Try loading ONNX model first
    if onnx_path.exists():
        try:
            import onnxruntime as ort
            sess_opts = ort.SessionOptions()
            sess_opts.intra_op_num_threads = 2
            _MODEL_SESSION = ort.InferenceSession(str(onnx_path), sess_opts)
            _MODEL_LOADED = True
            logger.info("Loaded ONNX runtime model from %s", onnx_path)
        except Exception as e:
            logger.warning("Failed loading ONNX model (%s); attempting joblib fallback", e)

    # 3. Fallback to joblib if ONNX didn't load
    if not _MODEL_LOADED and joblib_path.exists():
        try:
            import joblib
            _SKLEARN_FALLBACK = joblib.load(joblib_path)
            _MODEL_LOADED = True
            logger.info("Loaded scikit-learn model from %s", joblib_path)
        except Exception as e:
            logger.error("Failed loading joblib model: %s", e)

    # 4. Initialize Drift Monitor
    _DRIFT_MONITOR = DriftMonitor(max_window_size=500)

    # 5. Record model info metric
    try:
        MODEL_INFO.info({
            "version": _METADATA.get("model_version", "unknown"),
            "model_type": _METADATA.get("model_name", "unknown"),
        })
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model_artifacts()
    yield


app = FastAPI(
    title="AcadFlow ML Serving API",
    version="1.2.0",
    description="Production-grade ONNX ML inference service for academic risk prediction.",
    lifespan=lifespan,
)


def _classify_risk(prob: float) -> str:
    if prob >= 0.80:
        return "Critical"
    elif prob >= 0.55:
        return "At Risk"
    elif prob >= 0.30:
        return "Watch"
    return "Safe"


def _run_inference_matrix(X: np.ndarray) -> np.ndarray:
    """Vectorized inference across batch matrix."""
    if _MODEL_SESSION is not None:
        in_name = _MODEL_SESSION.get_inputs()[0].name
        outs = _MODEL_SESSION.run(None, {in_name: X.astype(np.float32)})
        if len(outs) > 1 and outs[1].shape[-1] == 2:
            probs = outs[1][:, 1]
        elif len(outs) == 1 and outs[0].shape[-1] == 2:
            probs = outs[0][:, 1]
        else:
            probs = outs[1][:, 1] if len(outs) > 1 else outs[0]
        return np.asarray(probs, dtype=float)

    if _SKLEARN_FALLBACK is not None:
        if hasattr(_SKLEARN_FALLBACK, "predict_proba"):
            return _SKLEARN_FALLBACK.predict_proba(X)[:, 1]
        return _SKLEARN_FALLBACK.predict(X)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Model engine is not loaded or initialized.",
    )


@app.get("/health", summary="Liveness probe")
def health():
    return {"status": "healthy", "service": "ml-serve", "timestamp": time.time()}


@app.get("/ready", summary="Readiness probe")
def ready():
    if not _MODEL_LOADED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not ready or failed to load.",
        )
    return {
        "status": "ready",
        "service": "ml-serve",
        "model_version": _METADATA.get("model_version", "v1.2.0-eval2"),
        "engine": "onnxruntime" if _MODEL_SESSION is not None else "scikit-learn",
    }


@app.post("/predict", response_model=PredictResponse, summary="Predict academic risk for one student")
def predict(request: PredictRequest):
    if not _MODEL_LOADED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Model not loaded.")

    t0 = time.perf_counter()
    raw_dict = request.model_dump()
    feature_vec = extract_features(raw_dict)
    X = np.array([feature_vec], dtype=np.float32)

    try:
        probs = _run_inference_matrix(X)
        prob = float(probs[0])
        prob = max(0.0, min(1.0, prob))

        latency = time.perf_counter() - t0
        version = _METADATA.get("model_version", "v1.2.0-eval2")

        # Prometheus metrics
        PREDICTION_COUNT.labels(model_version=version, status="success").inc()
        PREDICTION_LATENCY.observe(latency)

        # Record into drift buffer
        if _DRIFT_MONITOR is not None:
            _DRIFT_MONITOR.record_inference(feature_vec)

        # Explainability factors
        attributions = _METADATA.get("attributions", {})
        factors_raw = map_feature_contributions(raw_dict, attributions)
        factors = [FeatureFactor(**f) for f in factors_raw]

        confidence = float(max(prob, 1.0 - prob))
        label = _classify_risk(prob)

        return PredictResponse(
            risk_score=round(prob, 4),
            risk_label=label,
            confidence=round(confidence, 4),
            model_version=version,
            factors=factors,
        )
    except Exception as e:
        PREDICTION_COUNT.labels(model_version=_METADATA.get("model_version", "unknown"), status="error").inc()
        logger.error("Inference failure: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Inference error: {e}")


@app.post("/predict/batch", response_model=BatchPredictResponse, summary="Batch predict risk for multiple students")
def predict_batch(request: BatchPredictRequest):
    if not _MODEL_LOADED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Model not loaded.")

    items = request.items
    batch_size = len(items)
    if batch_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch items cannot be empty.")

    t0 = time.perf_counter()
    feature_matrix = [extract_features(item.model_dump()) for item in items]
    X = np.array(feature_matrix, dtype=np.float32)

    try:
        probs = _run_inference_matrix(X)
        latency = time.perf_counter() - t0
        version = _METADATA.get("model_version", "v1.2.0-eval2")

        PREDICTION_COUNT.labels(model_version=version, status="success").inc(batch_size)
        PREDICTION_LATENCY.observe(latency)
        BATCH_SIZE_HISTOGRAM.observe(batch_size)

        if _DRIFT_MONITOR is not None:
            _DRIFT_MONITOR.record_batch(feature_matrix)

        attributions = _METADATA.get("attributions", {})
        predictions = []

        for idx, item in enumerate(items):
            p = float(np.clip(probs[idx], 0.0, 1.0))
            raw_dict = item.model_dump()
            factors_raw = map_feature_contributions(raw_dict, attributions)
            predictions.append(
                PredictResponse(
                    risk_score=round(p, 4),
                    risk_label=_classify_risk(p),
                    confidence=round(float(max(p, 1.0 - p)), 4),
                    model_version=version,
                    factors=[FeatureFactor(**f) for f in factors_raw],
                )
            )

        return BatchPredictResponse(
            predictions=predictions,
            batch_size=batch_size,
            model_version=version,
        )
    except Exception as e:
        PREDICTION_COUNT.labels(model_version=_METADATA.get("model_version", "unknown"), status="error").inc(batch_size)
        logger.error("Batch inference error: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Batch error: {e}")


@app.get("/drift", response_model=DriftResponse, summary="Current feature distribution drift report")
def get_drift_report():
    if _DRIFT_MONITOR is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Drift monitor not active.")

    report = _DRIFT_MONITOR.compute_drift_status()

    # Update Prometheus gauges
    for feat, stats_dict in report.get("features", {}).items():
        if "psi" in stats_dict:
            try:
                DRIFT_PSI_GAUGE.labels(feature=feat).set(stats_dict["psi"])
            except Exception:
                pass

    return DriftResponse(**report)


@app.get("/metrics", summary="Prometheus telemetry")
def metrics():
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)

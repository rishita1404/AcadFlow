"""
Prometheus Metrics Instrumentation for ML Serving — AcadFlow (Phase 3).
"""

from __future__ import annotations

import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
VENDOR_DIR = ML_ROOT / "vendor_packages"
if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

try:
    from prometheus_client import Counter, Gauge, Histogram, Info

    PREDICTION_COUNT = Counter(
        "acadflow_predictions_total",
        "Total ML risk predictions processed",
        ["model_version", "status"],
    )

    PREDICTION_LATENCY = Histogram(
        "acadflow_prediction_latency_seconds",
        "Inference latency in seconds",
        buckets=[0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    )

    BATCH_SIZE_HISTOGRAM = Histogram(
        "acadflow_batch_size",
        "Batch size distribution for batch prediction requests",
        buckets=[1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
    )

    MODEL_INFO = Info(
        "acadflow_model",
        "Metadata about currently active risk model in production",
    )

    DRIFT_PSI_GAUGE = Gauge(
        "acadflow_drift_psi",
        "Population Stability Index (PSI) per monitored input feature",
        ["feature"],
    )

except ImportError:
    # Graceful dummy fallback if prometheus_client is somehow missing
    class _DummyMetric:
        def inc(self, *a, **k): pass
        def observe(self, *a, **k): pass
        def set(self, *a, **k): pass
        def labels(self, *a, **k): return self
        def info(self, *a, **k): pass

    PREDICTION_COUNT = _DummyMetric()
    PREDICTION_LATENCY = _DummyMetric()
    BATCH_SIZE_HISTOGRAM = _DummyMetric()
    MODEL_INFO = _DummyMetric()
    DRIFT_PSI_GAUGE = _DummyMetric()

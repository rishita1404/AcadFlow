from prometheus_client import Counter, Histogram

PREDICTION_COUNT = Counter("acadflow_predictions_total", "Total predictions served")
PREDICTION_LATENCY = Histogram("acadflow_prediction_latency_seconds", "Inference latency")

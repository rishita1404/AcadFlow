"""
Metrics Collector for AcadFlow.
Maintains in-memory histogram metrics for Real User Monitoring (Web Vitals)
and exports Prometheus OpenMetrics compliant text format.
"""
from collections import defaultdict
import threading
import time
from typing import Dict, List, Optional

# Histogram standard bucket thresholds
BUCKETS = {
    "LCP": [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 6.0],  # seconds
    "INP": [0.05, 0.1, 0.2, 0.3, 0.5, 1.0],           # seconds
    "CLS": [0.05, 0.1, 0.15, 0.25, 0.5],             # unitless
    "TTFB": [0.1, 0.2, 0.5, 0.8, 1.5, 3.0],          # seconds
}


class WebVitalsRegistry:
    def __init__(self):
        self._lock = threading.Lock()
        self.counts: Dict[str, int] = defaultdict(int)
        self.sums: Dict[str, float] = defaultdict(float)
        self.bucket_counts: Dict[str, Dict[float, int]] = {
            metric: defaultdict(int) for metric in BUCKETS
        }
        # Rate-limiting tracking: IP -> list of timestamps
        self._rate_limits: Dict[str, List[float]] = defaultdict(list)

    def is_rate_limited(self, ip: str, max_requests: int = 60, window_seconds: int = 60) -> bool:
        now = time.time()
        with self._lock:
            # Purge expired timestamps
            timestamps = [t for t in self._rate_limits[ip] if now - t < window_seconds]
            if len(timestamps) >= max_requests:
                self._rate_limits[ip] = timestamps
                return True
            timestamps.append(now)
            self._rate_limits[ip] = timestamps
            return False

    def record(self, metric_name: str, value: float):
        name = metric_name.upper()
        if name not in BUCKETS:
            return

        # Convert millisecond-based metrics (LCP, INP, TTFB) to seconds for Prometheus convention
        if name in ("LCP", "INP", "TTFB") and value > 10.0:
            converted_value = value / 1000.0
        else:
            converted_value = value

        with self._lock:
            self.counts[name] += 1
            self.sums[name] += converted_value
            for threshold in BUCKETS[name]:
                if converted_value <= threshold:
                    self.bucket_counts[name][threshold] += 1

    def generate_prometheus_text(self) -> str:
        lines = []
        with self._lock:
            for metric, thresholds in BUCKETS.items():
                metric_key = f"web_vitals_{metric.lower()}"
                unit = "seconds" if metric in ("LCP", "INP", "TTFB") else "ratio"
                prom_name = f"{metric_key}_{unit}"

                lines.append(f"# HELP {prom_name} Real-user Web Vital {metric} measured in {unit}")
                lines.append(f"# TYPE {prom_name} histogram")

                total_count = self.counts[metric]
                for threshold in thresholds:
                    count = self.bucket_counts[metric][threshold]
                    lines.append(f'{prom_name}_bucket{{le="{threshold}"}} {count}')
                lines.append(f'{prom_name}_bucket{{le="+Inf"}} {total_count}')
                lines.append(f"{prom_name}_sum {self.sums[metric]:.4f}")
                lines.append(f"{prom_name}_count {total_count}")
                lines.append("")

        return "\n".join(lines)


registry = WebVitalsRegistry()

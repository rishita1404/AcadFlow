"""
Asynchronous ML Client with Circuit Breaker, Retries & Fallbacks — AcadFlow (Phase 4).

Modes:
- off    : ML service disabled; returns rule fallback immediately.
- shadow : Rule engine authoritative; ML service invoked in background,
           scores & features logged to `risk_shadow_logs`.
- assist : ML advisory score and factors returned alongside rule engine score.
           If ML service is slow/down, transparently falls back to rule engine.

Circuit Breaker States:
- CLOSED    : Normal calls forwarded to ML service.
- OPEN      : Too many failures; fails fast without network round-trips.
- HALF_OPEN : Allows limited probe requests to test service recovery.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger("acadflow.ml_client")


class CircuitBreakerOpenError(Exception):
    pass


class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 10.0,
        half_open_max_probes: int = 2,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_probes = half_open_max_probes

        self.state: str = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.failure_count: int = 0
        self.last_failure_time: float = 0.0
        self.half_open_probes: int = 0

    def can_execute(self) -> bool:
        now = time.time()
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if now - self.last_failure_time >= self.recovery_timeout:
                self.state = "HALF_OPEN"
                self.half_open_probes = 0
                logger.info("Circuit breaker transitioned to HALF_OPEN probe state.")
                return True
            return False
        if self.state == "HALF_OPEN":
            return self.half_open_probes < self.half_open_max_probes
        return True

    def record_success(self):
        self.failure_count = 0
        self.half_open_probes = 0
        if self.state != "CLOSED":
            logger.info("Circuit breaker recovered; transitioned to CLOSED.")
        self.state = "CLOSED"

    def record_failure(self, error: Exception):
        self.last_failure_time = time.time()
        self.failure_count += 1
        if self.state == "HALF_OPEN" or self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(
                "Circuit breaker tripped to OPEN! Failures: %d. Error: %s",
                self.failure_count,
                error,
            )


# Global singleton circuit breaker instance
_GLOBAL_CIRCUIT_BREAKER = CircuitBreaker()


class MLClient:
    def __init__(
        self,
        base_url: str = settings.ML_SERVICE_URL,
        mode: str = settings.ML_MODE,
        timeout: float = 2.0,
        max_retries: int = 2,
    ):
        self.base_url = base_url.rstrip("/")
        self.mode = mode.lower()
        self.timeout = timeout
        self.max_retries = max_retries
        self.breaker = _GLOBAL_CIRCUIT_BREAKER

    async def predict_risk(
        self,
        features: Dict[str, Any],
        rule_fallback_score: float = 50.0,
        rule_fallback_band: str = "Watch",
    ) -> Dict[str, Any]:
        """
        Request prediction from ML service with circuit breaker, timeout, and retry.
        If service is offline, slow, or circuit is open, silently falls back to rule score.
        """
        if self.mode == "off":
            return {
                "risk_score": round(rule_fallback_score / 100.0, 4),
                "risk_label": rule_fallback_band,
                "confidence": 0.5,
                "model_version": "rule-fallback",
                "factors": [],
                "is_fallback": True,
                "fallback_reason": "ml_mode_off",
                "latency_ms": 0.0,
            }

        if not self.breaker.can_execute():
            return {
                "risk_score": round(rule_fallback_score / 100.0, 4),
                "risk_label": rule_fallback_band,
                "confidence": 0.5,
                "model_version": "rule-fallback",
                "factors": [],
                "is_fallback": True,
                "fallback_reason": "circuit_breaker_open",
                "latency_ms": 0.0,
            }

        t0 = time.perf_counter()
        last_error = None

        # Sanitize payload against feature schema
        payload = {
            "attendance_margin": max(0.0, min(1.0, float(features.get("attendance_margin", 0.5)))),
            "attendance_trend_4w": max(-50.0, min(50.0, float(features.get("attendance_trend_4w", 0.0)))),
            "deadline_pressure": max(0.0, min(50.0, float(features.get("deadline_pressure", 0.0)))),
            "missed_submissions_count": max(0.0, min(100.0, float(features.get("missed_submissions_count", 0.0)))),
            "current_attendance_pct": max(0.0, min(100.0, float(features.get("current_attendance_pct", 75.0)))),
            "past_quiz_avg": max(0.0, min(100.0, float(features.get("past_quiz_avg", 70.0)))),
        }

        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(f"{self.base_url}/predict", json=payload)
                    if resp.status_code == 200:
                        self.breaker.record_success()
                        latency_ms = (time.perf_counter() - t0) * 1000.0
                        data = resp.json()
                        data["is_fallback"] = False
                        data["fallback_reason"] = None
                        data["latency_ms"] = round(latency_ms, 2)
                        return data
                    else:
                        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
            except Exception as e:
                last_error = e
                if attempt < self.max_retries:
                    await asyncio.sleep(0.05 * (2**attempt))

        # Failed after retries: trip breaker & record fallback
        self.breaker.record_failure(last_error or Exception("Timeout"))
        latency_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "risk_score": round(rule_fallback_score / 100.0, 4),
            "risk_label": rule_fallback_band,
            "confidence": 0.5,
            "model_version": "rule-fallback",
            "factors": [],
            "is_fallback": True,
            "fallback_reason": str(last_error)[:90],
            "latency_ms": round(latency_ms, 2),
        }

    async def predict_batch(
        self,
        items: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Batch prediction with circuit breaker fallback."""
        if not items:
            return []

        if self.mode == "off" or not self.breaker.can_execute():
            return [
                {
                    "risk_score": 0.5,
                    "risk_label": "Watch",
                    "confidence": 0.5,
                    "model_version": "rule-fallback",
                    "factors": [],
                    "is_fallback": True,
                }
                for _ in items
            ]

        try:
            async with httpx.AsyncClient(timeout=self.timeout * 2) as client:
                resp = await client.post(f"{self.base_url}/predict/batch", json={"items": items})
                if resp.status_code == 200:
                    self.breaker.record_success()
                    return resp.json().get("predictions", [])
                else:
                    self.breaker.record_failure(RuntimeError(f"HTTP {resp.status_code}"))
        except Exception as e:
            self.breaker.record_failure(e)

        return [
            {
                "risk_score": 0.5,
                "risk_label": "Watch",
                "confidence": 0.5,
                "model_version": "rule-fallback",
                "factors": [],
                "is_fallback": True,
            }
            for _ in items
        ]

    async def what_would_change_my_score(
        self,
        current_features: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Student 'What would change my score' simulation:
        Generates actionable counterfactual scenarios and predicts their risk reductions.
        """
        # Baseline prediction
        base = await self.predict_risk(current_features)
        base_score = int(round(base["risk_score"] * 100.0))

        scenarios = []

        # Scenario 1: Attend next 3 classes
        curr_att = float(current_features.get("current_attendance_pct", 75.0))
        improved_att = min(100.0, curr_att + 4.5)
        curr_margin = float(current_features.get("attendance_margin", 0.5))
        improved_margin = max(0.0, curr_margin - 0.20)
        s1_features = dict(current_features)
        s1_features["current_attendance_pct"] = improved_att
        s1_features["attendance_margin"] = improved_margin
        s1_features["attendance_trend_4w"] = float(current_features.get("attendance_trend_4w", 0.0)) + 3.0

        # Scenario 2: Submit pending deadlines on time
        s2_features = dict(current_features)
        s2_features["deadline_pressure"] = max(0.0, float(current_features.get("deadline_pressure", 2.0)) - 2.0)

        # Scenario 3: Resolve missed assignment
        s3_features = dict(current_features)
        curr_missed = float(current_features.get("missed_submissions_count", 0.0))
        s3_features["missed_submissions_count"] = max(0.0, curr_missed - 1.0)

        hypothetical_items = [s1_features, s2_features, s3_features]
        batch_preds = await self.predict_batch(hypothetical_items)

        if len(batch_preds) >= 1:
            p1 = int(round(batch_preds[0]["risk_score"] * 100.0))
            scenarios.append({
                "action": "Attend the next 3 scheduled classes consecutively",
                "estimated_new_score": p1,
                "risk_delta": p1 - base_score,
                "impact": f"Lowers risk from {base_score} to {p1} (-{base_score - p1} pts)",
                "category": "attendance",
            })

        if len(batch_preds) >= 2:
            p2 = int(round(batch_preds[1]["risk_score"] * 100.0))
            scenarios.append({
                "action": "Complete and submit upcoming assignments before due dates",
                "estimated_new_score": p2,
                "risk_delta": p2 - base_score,
                "impact": f"Lowers risk from {base_score} to {p2} (-{base_score - p2} pts)",
                "category": "assignments",
            })

        if len(batch_preds) >= 3 and curr_missed > 0:
            p3 = int(round(batch_preds[2]["risk_score"] * 100.0))
            scenarios.append({
                "action": "Submit retrospective late work or makeup assignment",
                "estimated_new_score": p3,
                "risk_delta": p3 - base_score,
                "impact": f"Lowers risk from {base_score} to {p3} (-{base_score - p3} pts)",
                "category": "remediation",
            })

        return scenarios

"""
Pydantic Schemas for ML Serving API — AcadFlow (Phase 3).

Strict validation with physical and domain boundaries:
- attendance_margin: [0.0, 1.0]
- attendance_trend_4w: [-50.0, 50.0]
- deadline_pressure: [0, 50]
- missed_submissions_count: [0, 100]
- current_attendance_pct: [0.0, 100.0]
- past_quiz_avg: [0.0, 100.0]
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class FeatureFactor(BaseModel):
    feature: str = Field(..., description="Feature identifier")
    weight: float = Field(..., description="Attribution contribution score")
    label: str = Field(..., description="Human-readable title")
    detail: str = Field(..., description="Plain-language diagnostic explanation")
    severity: str = Field("medium", description="critical | high | medium | positive")

    model_config = ConfigDict(extra="ignore")


class PredictRequest(BaseModel):
    attendance_margin: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Buffer distance pressure [0.0 = comfortable, 1.0 = buffer exhausted]",
    )
    attendance_trend_4w: float = Field(
        ...,
        ge=-50.0,
        le=50.0,
        description="Trailing 4-week percentage change slope in attendance",
    )
    deadline_pressure: float = Field(
        0.0,
        ge=0.0,
        le=50.0,
        description="Count of upcoming assignment deadlines in next 7 days",
    )
    missed_submissions_count: float = Field(
        0.0,
        ge=0.0,
        le=100.0,
        description="Total unexcused past assignments never submitted",
    )
    current_attendance_pct: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Cumulative attendance percentage across all courses to date",
    )
    past_quiz_avg: float = Field(
        70.0,
        ge=0.0,
        le=100.0,
        description="Historical quiz and assessment average",
    )

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "attendance_margin": 0.85,
                "attendance_trend_4w": -6.2,
                "deadline_pressure": 3.0,
                "missed_submissions_count": 2.0,
                "current_attendance_pct": 68.5,
                "past_quiz_avg": 62.0,
            }
        },
    )


class PredictResponse(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Calibrated posterior probability of academic risk")
    risk_label: str = Field(..., description="Categorical band: Safe | Watch | At Risk | Critical")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model prediction confidence")
    model_version: str = Field(..., description="Deployed model semantic version")
    factors: List[FeatureFactor] = Field(default_factory=list, description="Top plain-language contributing factors")

    model_config = ConfigDict(extra="ignore")


class BatchPredictRequest(BaseModel):
    items: List[PredictRequest] = Field(..., min_length=1, max_length=1000, description="List of student feature vectors")

    model_config = ConfigDict(extra="forbid")


class BatchPredictResponse(BaseModel):
    predictions: List[PredictResponse]
    batch_size: int
    model_version: str


class DriftResponse(BaseModel):
    status: str
    window_size: int
    overall_drift: bool
    features: dict

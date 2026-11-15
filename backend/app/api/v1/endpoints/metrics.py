"""
Metrics and Web Vitals telemetry endpoints.
Unauthenticated, rate-limited beacon receiver with Prometheus exposition.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from app.services.metrics_collector import registry

router = APIRouter()


class WebVitalIn(BaseModel):
    name: str = Field(..., pattern="^(LCP|INP|CLS|TTFB|FCP)$", description="Core Web Vital name")
    value: float = Field(..., ge=0.0, le=180000.0, description="Measurement value (ms or ratio)")
    delta: Optional[float] = None
    id: Optional[str] = Field(None, max_length=100)
    rating: Optional[str] = Field(None, max_length=20)
    navigationType: Optional[str] = Field(None, max_length=50)
    page: Optional[str] = Field(None, max_length=200)


@router.post("/metrics/web-vitals", status_code=status.HTTP_204_NO_CONTENT)
async def ingest_web_vitals(vital: WebVitalIn, request: Request):
    """
    Ingest anonymized Core Web Vitals telemetry sent from client browser via navigator.sendBeacon.
    Rate limited per IP. Discards any personal identifying attributes.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    if registry.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Telemetry rate limit exceeded. Try again later.",
        )

    registry.record(vital.name, vital.value)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/metrics", response_class=Response)
async def get_metrics():
    """
    Prometheus metrics exposition endpoint.
    Returns metrics formatted according to the Prometheus OpenMetrics specification.
    """
    content = registry.generate_prometheus_text()
    return Response(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")

import pytest
from fastapi import HTTPException
from app.core.rate_limit import RateLimiter, get_client_ip


@pytest.mark.asyncio
async def test_rate_limiter_burst_and_window():
    # 3 requests per 10-second window
    limiter = RateLimiter(requests_per_minute=3, window_seconds=10, client=None)
    client_id = "test_user_42"

    # Requests 1, 2, 3 should succeed
    for _ in range(3):
        allowed, retry_after = await limiter.is_allowed(client_id)
        assert allowed is True
        assert retry_after == 0

    # 4th request must be rejected (429)
    allowed, retry_after = await limiter.is_allowed(client_id)
    assert allowed is False
    assert retry_after > 0

    with pytest.raises(HTTPException) as exc_info:
        await limiter.check(client_id)
    assert exc_info.value.status_code == 429
    assert exc_info.value.detail["error"]["code"] == "RATE_429"
    assert "Retry-After" in exc_info.value.headers


def test_ip_spoofing_defense():
    class DummyClient:
        def __init__(self, host):
            self.host = host

    class DummyRequest:
        def __init__(self, direct_host, headers=None):
            self.client = DummyClient(direct_host)
            self.headers = headers or {}

    # Case 1: Untrusted public client spoofing X-Forwarded-For
    untrusted_request = DummyRequest(
        direct_host="203.0.113.195",
        headers={"x-forwarded-for": "10.0.0.1, 1.1.1.1"}
    )
    # Must use direct peer IP, ignoring spoofed header
    resolved_ip = get_client_ip(untrusted_request, trusted_proxies=["127.0.0.1"])
    assert resolved_ip == "203.0.113.195"

    # Case 2: Trusted reverse proxy (NGINX on localhost) forwarding real client IP
    trusted_request = DummyRequest(
        direct_host="127.0.0.1",
        headers={"x-real-ip": "198.51.100.22"}
    )
    resolved_ip = get_client_ip(trusted_request, trusted_proxies=["127.0.0.1"])
    assert resolved_ip == "198.51.100.22"

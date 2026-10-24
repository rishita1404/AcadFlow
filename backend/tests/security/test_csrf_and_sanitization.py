from app.core.csrf import CSRFProtector
from app.core.sanitization import escape_html, sanitize_payload


def test_html_escaping_and_sanitization():
    xss_payload = '<script>alert("XSS")</script>&'
    escaped = escape_html(xss_payload)

    assert "<script>" not in escaped
    assert "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&amp;" == escaped

    nested_dict = {
        "title": "Assignment 1",
        "description": "<img src=x onerror=alert(1)>",
        "tags": ["<b>urgent</b>", "safe"],
    }
    sanitized = sanitize_payload(nested_dict)

    assert "<img" not in sanitized["description"]
    assert "<b>" not in sanitized["tags"][0]
    assert sanitized["title"] == "Assignment 1"


def test_csrf_token_generation_and_verification():
    protector = CSRFProtector()
    session_id = "user_session_abc123"

    token = protector.generate_csrf_token(session_id)
    assert token is not None
    assert "." in token

    # Valid token verification
    assert protector.verify_csrf_token(token, session_id) is True

    # Tampered token or mismatched session
    assert protector.verify_csrf_token(token, "different_session_xyz") is False
    assert protector.verify_csrf_token("invalid.token", session_id) is False
    assert protector.verify_csrf_token("", session_id) is False


def test_csrf_origin_validation():
    protector = CSRFProtector(allowed_origins=["http://localhost:3000"])

    class MockRequest:
        def __init__(self, headers):
            self.headers = headers

    # Allowed origin
    req_valid = MockRequest({"origin": "http://localhost:3000"})
    assert protector.validate_origin(req_valid) is True

    # Malicious external origin
    req_invalid = MockRequest({"origin": "http://evil-attacker.com"})
    assert protector.validate_origin(req_invalid) is False

    # Allowed referer
    req_referer = MockRequest({"referer": "http://localhost:3000/dashboard"})
    assert protector.validate_origin(req_referer) is True

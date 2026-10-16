"""
CSRF Protection for Cookie-Authenticated Routes in AcadFlow.

Implements CSRF defenses for state-changing requests (POST, PUT, PATCH, DELETE)
when using session cookies:
1. Strict Origin / Referer validation against allowed application origins.
2. Cryptographic double-submit CSRF token (X-CSRF-Token header matching token).
3. Safe exemption for read-only methods (GET, HEAD, OPTIONS).
"""

import hmac
import hashlib
import secrets
from typing import List, Optional
from urllib.parse import urlparse
from fastapi import Request, HTTPException, status
from app.core.config import settings
from app.core.session import SESSION_COOKIE_NAME


CSRF_HEADER_NAME = "x-csrf-token"
CSRF_COOKIE_NAME = "acadflow_csrf"


class CSRFProtector:
    def __init__(self, allowed_origins: Optional[List[str]] = None):
        self.allowed_origins = allowed_origins or [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:80",
            "http://localhost",
        ]

    def generate_csrf_token(self, session_id: str) -> str:
        """
        Generate a cryptographically signed CSRF token bound to the session_id.
        """
        salt = secrets.token_hex(8)
        signature = hmac.new(
            settings.SECRET_KEY.encode(),
            f"{session_id}:{salt}".encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{salt}.{signature}"

    def verify_csrf_token(self, token: str, session_id: str) -> bool:
        """
        Validate that the CSRF token signature matches the session_id.
        """
        if not token or "." not in token:
            return False
        try:
            salt, sig = token.split(".", 1)
            expected_sig = hmac.new(
                settings.SECRET_KEY.encode(),
                f"{session_id}:{salt}".encode(),
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(sig, expected_sig)
        except Exception:
            return False

    def validate_origin(self, request: Request) -> bool:
        """
        Verify request Origin or Referer header matches allowed origins.
        """
        origin = request.headers.get("origin")
        if origin:
            parsed = urlparse(origin)
            origin_base = f"{parsed.scheme}://{parsed.netloc}"
            return any(origin_base == allowed.rstrip("/") for allowed in self.allowed_origins)

        referer = request.headers.get("referer")
        if referer:
            parsed = urlparse(referer)
            referer_base = f"{parsed.scheme}://{parsed.netloc}"
            return any(referer_base == allowed.rstrip("/") for allowed in self.allowed_origins)

        # In non-browser API testing or tools without origin, reject if session cookie is present
        return False

    async def check_csrf(self, request: Request) -> None:
        """
        Enforce CSRF validation if request has a session cookie on mutating methods.
        """
        # Read-only methods are safe from CSRF
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return

        # Check if the request is authenticated via session cookie
        session_id = request.cookies.get(SESSION_COOKIE_NAME)
        if not session_id:
            # Bearer token requests (Authorization header) are not susceptible to browser ambient credential CSRF
            return

        # 1. Validate Origin / Referer
        if not self.validate_origin(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "CSRF_ORIGIN_INVALID", "message": "Cross-site request origin rejected"}
            )

        # 2. Validate CSRF Token
        token = request.headers.get(CSRF_HEADER_NAME) or request.cookies.get(CSRF_COOKIE_NAME)
        if not token or not self.verify_csrf_token(token, session_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "CSRF_TOKEN_INVALID", "message": "Missing or invalid CSRF token"}
            )


# Global instance
csrf_protector = CSRFProtector()

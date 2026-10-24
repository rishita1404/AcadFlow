"""
Security Headers Middleware for AcadFlow.

Adds essential HTTP defense-in-depth headers:
- Content-Security-Policy (CSP)
- X-Frame-Options: DENY (anti-clickjacking)
- X-Content-Type-Options: nosniff (anti-MIME sniffing)
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy
- Strict-Transport-Security (HSTS) in production
"""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, is_production: bool = False):
        super().__init__(app)
        self.is_production = is_production

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Content Security Policy (Prevents execution of untrusted scripts)
        # If accessing API docs, allow Swagger UI CDN assets to render
        if request.url.path in ("/docs", "/redoc"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https: https://fastapi.tiangolo.com; "
                "font-src 'self' https://cdn.jsdelivr.net; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            )

        # Anti-Clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Anti-MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Referrer privacy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Restrict browser hardware APIs
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )

        # HSTS only when in production HTTPS
        if self.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response

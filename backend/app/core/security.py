"""Password hashing and JWT token utilities.

Uses argon2id (via passlib) as the primary hashing scheme — more secure than
bcrypt and free of the 72-byte password truncation limitation in bcrypt >= 4.

bcrypt is listed as a deprecated fallback so that any pre-existing bcrypt
hashes stored in the DB can still be verified and upgraded transparently.
"""

import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone

try:
    from jose import JWTError, jwt
except ImportError:

    class JWTError(Exception):
        pass

    class _FallbackJWT:
        @staticmethod
        def encode(claims: dict, key: str, algorithm: str = "HS256") -> str:
            header = {"alg": algorithm, "typ": "JWT"}

            def b64enc(obj):
                s = json.dumps(obj, separators=(",", ":")).encode()
                return base64.urlsafe_b64encode(s).decode().rstrip("=")

            hdr_b64 = b64enc(header)
            payload_b64 = b64enc(claims)
            msg = f"{hdr_b64}.{payload_b64}"
            sig = (
                base64.urlsafe_b64encode(
                    hmac.new(key.encode(), msg.encode(), hashlib.sha256).digest()
                )
                .decode()
                .rstrip("=")
            )
            return f"{msg}.{sig}"

        @staticmethod
        def decode(
            token: str, key: str, algorithms: list[str] = None, **kwargs
        ) -> dict:
            try:
                parts = token.split(".")
                if len(parts) != 3:
                    raise JWTError("Invalid token segments")
                hdr_b64, payload_b64, sig_b64 = parts
                msg = f"{hdr_b64}.{payload_b64}"
                expected_sig = (
                    base64.urlsafe_b64encode(
                        hmac.new(key.encode(), msg.encode(), hashlib.sha256).digest()
                    )
                    .decode()
                    .rstrip("=")
                )
                if not hmac.compare_digest(sig_b64, expected_sig):
                    raise JWTError("Signature verification failed")
                rem = len(payload_b64) % 4
                pad = "=" * (4 - rem) if rem else ""
                payload = json.loads(
                    base64.urlsafe_b64decode(payload_b64 + pad).decode()
                )
                if not kwargs.get("options", {}).get("verify_exp", True):
                    return payload
                if "exp" in payload and payload["exp"] < time.time():
                    raise JWTError("Token expired")
                return payload
            except JWTError:
                raise
            except Exception as e:
                raise JWTError(str(e)) from e

        @staticmethod
        def get_unverified_claims(token: str) -> dict:
            parts = token.split(".")
            if len(parts) < 2:
                raise JWTError("Invalid token")
            payload_b64 = parts[1]
            rem = len(payload_b64) % 4
            pad = "=" * (4 - rem) if rem else ""
            return json.loads(base64.urlsafe_b64decode(payload_b64 + pad).decode())

    jwt = _FallbackJWT()

try:
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated=["bcrypt"])

    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    def needs_rehash(hashed_password: str) -> bool:
        return pwd_context.needs_update(hashed_password)

except ImportError:
    try:
        from argon2 import PasswordHasher

        ph = PasswordHasher()

        def verify_password(plain_password: str, hashed_password: str) -> bool:
            try:
                return ph.verify(hashed_password, plain_password)
            except Exception:
                return False

        def get_password_hash(password: str) -> str:
            return ph.hash(password)

        def needs_rehash(hashed_password: str) -> bool:
            return ph.check_needs_rehash(hashed_password)

    except ImportError:

        def verify_password(plain_password: str, hashed_password: str) -> bool:
            salt = hashed_password[:16]
            expected = hashlib.sha256((salt + plain_password).encode()).hexdigest()
            return hmac.compare_digest(hashed_password[16:], expected)

        def get_password_hash(password: str) -> str:
            import os

            salt = os.urandom(8).hex()
            return salt + hashlib.sha256((salt + password).encode()).hexdigest()

        def needs_rehash(hashed_password: str) -> bool:
            return False


from app.core.config import settings


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Legacy helper retained for compatibility with Liza's existing call sites."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": int(expire.timestamp())})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict | None:
    """Legacy helper retained for compatibility with Liza's existing call sites."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

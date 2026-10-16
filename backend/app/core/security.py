"""Password hashing and JWT token utilities.

Uses argon2id (via passlib) as the primary hashing scheme — more secure than
bcrypt and free of the 72-byte password truncation limitation in bcrypt ≥ 4.

bcrypt is listed as a deprecated fallback so that any pre-existing bcrypt
hashes stored in the DB can still be verified and upgraded transparently.
"""
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# argon2id primary; bcrypt deprecated for legacy verification + auto-upgrade
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated=["bcrypt"])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored hash.

    If the hash is a legacy bcrypt hash, passlib will verify it successfully
    and transparently re-hash with argon2id on next save (not done here —
    callers should update the stored hash when this returns True for bcrypt).
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password with argon2id."""
    return pwd_context.hash(password)


def needs_rehash(hashed_password: str) -> bool:
    """Return True if the hash should be upgraded (e.g. legacy bcrypt hash)."""
    return pwd_context.needs_update(hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Legacy helper retained for compatibility with Liza's existing call sites."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict | None:
    """Legacy helper retained for compatibility with Liza's existing call sites."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

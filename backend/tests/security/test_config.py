import pytest

from app.core.config import Settings


def test_production_fails_on_insecure_secret():
    with pytest.raises(ValueError, match="CRITICAL: Production deployment detected"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="acadflow-insecure-secret-key-change-me",
        )

    with pytest.raises(ValueError, match="CRITICAL: Production deployment detected"):
        Settings(ENVIRONMENT="production", SECRET_KEY="short-key")


def test_production_succeeds_with_strong_secret():
    strong_key = "a" * 32
    prod_settings = Settings(ENVIRONMENT="production", SECRET_KEY=strong_key)
    assert prod_settings.SECRET_KEY == strong_key

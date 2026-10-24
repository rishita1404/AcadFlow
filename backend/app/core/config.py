import os

from pydantic import model_validator

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    from pydantic import BaseModel as BaseSettings

    def SettingsConfigDict(**kwargs):
        return kwargs


class Settings(BaseSettings):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "AcadFlow")
    VERSION: str = os.getenv("VERSION", "1.0.0")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "acadflow-insecure-secret-key-change-me")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://acadflow_user:acadflow_password@localhost:5432/acadflow_db",
    )
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ML_SERVICE_URL: str = os.getenv("ML_SERVICE_URL", "http://localhost:8001")

    # Security settings (Member 2)
    LOCKOUT_THRESHOLD: int = int(os.getenv("LOCKOUT_THRESHOLD", "5"))
    LOCKOUT_DURATION_SECONDS: int = int(os.getenv("LOCKOUT_DURATION_SECONDS", "900"))
    RATE_LIMIT_LOGIN_PER_MINUTE: int = int(
        os.getenv("RATE_LIMIT_LOGIN_PER_MINUTE", "10")
    )
    RATE_LIMIT_UPLOAD_PER_MINUTE: int = int(
        os.getenv("RATE_LIMIT_UPLOAD_PER_MINUTE", "5")
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        insecure_keys = {
            "acadflow-insecure-secret-key-change-me",
            "change-this-in-production-to-a-secure-random-key",
            "",
            "secret",
        }
        if self.ENVIRONMENT.lower() == "production":
            if (
                not self.SECRET_KEY
                or self.SECRET_KEY in insecure_keys
                or len(self.SECRET_KEY) < 32
            ):
                raise ValueError(
                    "CRITICAL: Production deployment detected but SECRET_KEY is insecure or shorter than 32 characters."
                )
        return self


settings = Settings()

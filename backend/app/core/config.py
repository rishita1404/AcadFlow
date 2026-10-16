from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AcadFlow"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    SECRET_KEY: str = "acadflow-insecure-secret-key-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    DATABASE_URL: str = (
        "postgresql+psycopg://acadflow_user:acadflow_password@localhost:5432/acadflow_db"
    )
    MONGO_URI: str = "mongodb://localhost:27017"
    REDIS_URL: str = "redis://localhost:6379/0"
    ML_SERVICE_URL: str = "http://localhost:8001"

    # Security settings (Member 2)
    LOCKOUT_THRESHOLD: int = 5
    LOCKOUT_DURATION_SECONDS: int = 900
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 10
    RATE_LIMIT_UPLOAD_PER_MINUTE: int = 5

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
            if not self.SECRET_KEY or self.SECRET_KEY in insecure_keys or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "CRITICAL: Production deployment detected but SECRET_KEY is insecure or shorter than 32 characters."
                )
        return self


settings = Settings()

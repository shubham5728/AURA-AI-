from functools import lru_cache
from typing import List, Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["development", "production"] = "development"

    # SQLite by default so the backend runs with zero setup. Postgres is the
    # real target -- point DATABASE_URL at the docker-compose instance to use it.
    database_url: str = "sqlite:///./aura_dev.db"

    # Path to the Firebase service account JSON. When unset, token verification
    # is unavailable and only dev auth works.
    firebase_credentials_path: str = ""

    # Accepts a real Firebase ID token OR, in development only, the
    # "dev <email>" scheme. See auth.py for why this is gated.
    allow_dev_auth: bool = True

    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Get a key from https://aistudio.google.com/apikey -- a Gemini app
    # subscription does not grant API access. When empty, report parsing falls
    # back to MockReportParser so the flow still works end to end.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Used when the primary model returns a quota error. Free-tier limits are
    # per-model, so a lighter model usually still has budget when the main one
    # is exhausted -- the difference between a degraded answer and no answer at
    # all, which matters most during a live demo.
    #
    # An alias rather than a pinned version on purpose: "gemini-2.5-flash-lite"
    # was set here first and returned 404 "no longer available to new users",
    # so the fallback failed exactly when it was needed. The alias follows
    # whichever lite model is current.
    gemini_fallback_model: str = "gemini-flash-lite-latest"

    # Local disk in development; Firebase Storage is the production target.
    upload_dir: str = "./uploads"
    max_upload_mb: int = 10

    @property
    def dev_auth_enabled(self) -> bool:
        """Dev auth requires BOTH the flag and a non-production environment.

        Two independent conditions on purpose: a single misconfigured env var
        should never be enough to accept forged identities in production.
        """
        return self.allow_dev_auth and self.env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()

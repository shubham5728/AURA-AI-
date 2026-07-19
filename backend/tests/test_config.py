"""Tests for settings parsing.

Both cases here caused a real failure: one crashed a deploy, the other would
have crashed the next one.
"""

import pytest
from sqlalchemy import create_engine

from app.config import Settings


def settings_with(**env) -> Settings:
    """Build Settings from explicit values, ignoring any local .env file."""
    return Settings(_env_file=None, **env)


@pytest.mark.parametrize(
    "given,expected",
    [
        ("postgres://u:p@host:5432/db", "postgresql://u:p@host:5432/db"),
        ("postgresql://u:p@host:5432/db", "postgresql://u:p@host:5432/db"),
        ("sqlite:///./aura_dev.db", "sqlite:///./aura_dev.db"),
    ],
)
def test_legacy_postgres_scheme_is_rewritten(given, expected):
    """Render, Heroku and Railway all hand out `postgres://`, which SQLAlchemy
    dropped in 1.4. It failed the first deploy of this backend."""
    assert settings_with(database_url=given).database_url == expected


def test_the_rewritten_url_actually_builds_an_engine():
    """The rewrite is only worth anything if SQLAlchemy accepts the result."""
    url = settings_with(database_url="postgres://u:p@host:5432/db").database_url
    create_engine(url)  # raises NoSuchModuleError on the unrewritten scheme


def test_password_containing_the_scheme_is_not_mangled():
    """Only the leading scheme is replaced, never text inside credentials."""
    given = "postgres://user:postgres://weird@host/db"
    assert settings_with(database_url=given).database_url == (
        "postgresql://user:postgres://weird@host/db"
    )


def test_cors_origins_parse_from_a_json_array():
    """The format the deploy config has to use. A bare URL fails to parse,
    which is why it is documented as an array everywhere it appears."""
    parsed = settings_with(
        cors_origins=["https://aura-ai-lovat-ten.vercel.app", "http://localhost:5173"]
    ).cors_origins
    assert parsed[0] == "https://aura-ai-lovat-ten.vercel.app"
    assert not any(origin.endswith("/") for origin in parsed)

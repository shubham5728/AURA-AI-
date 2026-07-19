"""Shared fixtures.

Until now every test ran against pure functions, which is why a missing router
import once passed the whole suite while the server could not start. These
fixtures allow tests that exercise real database work without touching the
development database.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import User


@pytest.fixture
def db_session():
    """A throwaway SQLite database, created and dropped per test.

    In memory, so tests never touch aura_dev.db and cannot leave state behind.
    StaticPool keeps every connection pointed at the same in-memory database --
    without it each connection gets its own, and the tables vanish between
    statements.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def test_user(db_session) -> User:
    user = User(firebase_uid="test:user", email="test@aura.health")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

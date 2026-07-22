import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import init_firebase
from app.config import get_settings
from app.database import Base, engine
from app.routers import (
    appointments,
    chat,
    family,
    logs,
    overview,
    profile,
    reports,
    score,
    simulate,
    wearable,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is owned by Alembic -- run `alembic upgrade head`.
    #
    # create_all used to run here and was removed rather than kept as a
    # convenience. It only ever creates missing tables; it never adds a column
    # to a table that already exists. Adding `medications.last_taken_on` under
    # create_all left the app querying a column the database did not have, and
    # every request touching medications returned a 500. Worse, because
    # create_all had already produced the full schema, Alembic's autogenerate
    # saw nothing to do and wrote an empty migration.
    init_firebase()
    if settings.dev_auth_enabled:
        logger.warning(
            "DEV AUTH ENABLED -- any caller can claim any identity. "
            "Never run this configuration in production."
        )
    yield


app = FastAPI(
    title="AURA API",
    description="Digital Twin backend for personalized healthcare.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(reports.router)
app.include_router(score.router)
app.include_router(logs.router)
app.include_router(chat.router)
app.include_router(simulate.router)
app.include_router(family.router)
app.include_router(overview.router)
app.include_router(appointments.router)
app.include_router(wearable.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    """Liveness probe. Unauthenticated by design."""
    return {"status": "ok", "env": settings.env}

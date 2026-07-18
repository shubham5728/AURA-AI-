import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import init_firebase
from app.config import get_settings
from app.database import Base, engine
from app.routers import profile, reports

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create_all is fine while the schema is still moving. Switch to Alembic
    # before any data exists that cannot be thrown away.
    Base.metadata.create_all(bind=engine)
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


@app.get("/health", tags=["meta"])
def health() -> dict:
    """Liveness probe. Unauthenticated by design."""
    return {"status": "ok", "env": settings.env}

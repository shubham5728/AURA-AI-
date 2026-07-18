"""Authentication: Firebase ID token verification, plus a dev-only escape hatch.

Firebase owns identity. Our database owns health data. The only thing crossing
between them is `firebase_uid` -- no medical information is ever stored in
Firebase, so a compromise there exposes accounts but not health records.
"""

import logging
import os

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)
settings = get_settings()

_firebase_ready = False


def init_firebase() -> None:
    """Initialise the Admin SDK if a service account is configured.

    Absence of credentials is not fatal in development -- the backend still runs
    and dev auth covers local work. In production it is fatal, because the
    alternative is silently accepting unverified identities.
    """
    global _firebase_ready

    path = settings.firebase_credentials_path
    if not path or not os.path.exists(path):
        if settings.env == "production":
            raise RuntimeError(
                "FIREBASE_CREDENTIALS_PATH is required in production but is "
                f"missing or unreadable: {path!r}"
            )
        logger.warning(
            "Firebase credentials not found -- real ID tokens cannot be verified. "
            "Dev auth is %s.",
            "enabled" if settings.dev_auth_enabled else "disabled",
        )
        return

    import firebase_admin
    from firebase_admin import credentials

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(path))
    _firebase_ready = True
    logger.info("Firebase Admin SDK initialised.")


def _verify_firebase_token(token: str) -> dict:
    if not _firebase_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication backend is not configured.",
        )

    from firebase_admin import auth as fb_auth

    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception as exc:
        logger.info("Token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    if not decoded.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no email claim.",
        )
    return {"uid": decoded["uid"], "email": decoded["email"]}


def _resolve_dev_token(token: str) -> dict:
    """Accept `Authorization: Bearer dev <email>` in development only.

    This exists so the backend is usable before a Firebase project is created.
    It trusts the caller completely, which is why `dev_auth_enabled` requires
    both an explicit flag and a non-production environment.
    """
    email = token[4:].strip()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Dev auth expects 'dev <email>'.",
        )
    logger.warning("Dev auth used for %s -- identity is NOT verified.", email)
    return {"uid": f"dev:{email}", "email": email}


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the caller to a User row, creating it on first sight.

    Firebase has already verified the identity by this point, so a first-time
    token is a legitimate new user rather than an error.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:].strip()

    if token.startswith("dev "):
        if not settings.dev_auth_enabled:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Dev auth is disabled.",
            )
        identity = _resolve_dev_token(token)
    else:
        identity = _verify_firebase_token(token)

    user = db.query(User).filter(User.firebase_uid == identity["uid"]).first()
    if user is None:
        user = User(firebase_uid=identity["uid"], email=identity["email"])
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Registered new user id=%s", user.id)

    return user

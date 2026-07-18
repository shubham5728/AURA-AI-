"""File storage for uploaded reports.

Local disk in development. Firebase Storage is the production target; keeping
this behind one function means that swap touches nothing else.
"""

import logging
import os
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, status

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

ALLOWED_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}


def validate_upload(content: bytes, mime_type: str) -> None:
    """Reject anything we cannot parse, before it costs an API call.

    An allowlist rather than a blocklist: unknown types are refused by default,
    which is the safe direction for user-supplied files.
    """
    if mime_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type {mime_type!r}. Allowed: JPEG, PNG, WebP, PDF.",
        )

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    limit = settings.max_upload_mb * 1024 * 1024
    if len(content) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.max_upload_mb} MB limit.",
        )


def save_upload(content: bytes, mime_type: str, user_id: int) -> Tuple[str, str]:
    """Persist the file and return (storage_url, absolute_path).

    Filenames are random UUIDs, not the user's original name: uploaded names are
    untrusted input and a path-traversal risk, and medical filenames often leak
    personal details.
    """
    extension = ALLOWED_MIME[mime_type]
    user_dir = Path(settings.upload_dir) / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{extension}"
    path = user_dir / filename
    path.write_bytes(content)

    logger.info("Stored upload for user=%s at %s (%s bytes)", user_id, path, len(content))
    return f"local://{user_id}/{filename}", str(path.resolve())


def delete_upload(storage_url: str) -> None:
    """Best-effort cleanup. Never raises -- a stale file must not fail a delete."""
    if not storage_url.startswith("local://"):
        return
    relative = storage_url[len("local://") :]
    try:
        os.remove(Path(settings.upload_dir) / relative)
    except OSError as exc:
        logger.info("Could not remove %s: %s", storage_url, exc)

# Backend image for Render, Railway, Fly, or any host that runs containers.
#
# Not Vercel. Vercel's Python runtime is serverless: the filesystem resets
# between requests, so SQLite and uploaded report files would not survive, and
# report parsing takes ten to twenty seconds, which sits close to the function
# timeout. A long-lived container avoids all three problems.

FROM python:3.11-slim

# Bytecode files and pip's cache are dead weight in an image; unbuffered output
# means logs appear in the host's console as they happen rather than in bursts.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Requirements first, so a code change does not invalidate the dependency layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Migrations run at boot rather than in the build. The database is not reachable
# while an image is being built, and the schema must match the code that is
# about to serve traffic.
#
# `exec` on the last command matters: without it the shell stays as PID 1 and
# uvicorn never receives SIGTERM, so the host's graceful shutdown becomes a hard
# kill after its timeout -- dropping in-flight requests on every deploy.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

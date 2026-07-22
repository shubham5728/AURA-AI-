"""Fitbit Web API integration -- the one honest "connect a device" path.

Apple Health has no web API and Google Fit's is being retired, so Fitbit's
OAuth2 Web API is the only smartwatch source a browser app can sync from for
real. This module owns that flow: the authorize URL, the token exchange and
refresh, and pulling steps, resting heart rate and sleep back as the same
per-day readings a file import produces.

When no credentials are configured the caller is told so (`is_configured`) and
the connect flow reports itself unconfigured rather than showing a fake link.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

import httpx

from app.config import get_settings
from app.services.wearable_import import DayReading

_AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize"
_TOKEN_URL = "https://api.fitbit.com/oauth2/token"
_API_BASE = "https://api.fitbit.com"
_SCOPES = "activity heartrate sleep profile"

# The signed `state` is only valid briefly -- long enough to authorise, not long
# enough to be replayed later.
_STATE_TTL_SECONDS = 600


class FitbitError(Exception):
    """A Fitbit call failed in a way the caller should surface."""


def is_configured() -> bool:
    return get_settings().fitbit_configured


# --- CSRF-safe state that also carries the user id --------------------------

def _secret() -> bytes:
    # The client secret already has to be kept secret; reuse it as the signing
    # key so there is no second secret to manage.
    return get_settings().fitbit_client_secret.encode() or b"unconfigured"


def sign_state(user_id: int) -> str:
    payload = f"{user_id}:{int(time.time())}"
    sig = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()[:32]
    raw = f"{payload}:{sig}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def verify_state(state: str) -> Optional[int]:
    """Return the user id if the state is authentic and fresh, else None."""
    try:
        raw = base64.urlsafe_b64decode(state.encode()).decode()
        user_id_str, ts_str, sig = raw.split(":")
    except (ValueError, Exception):
        return None
    payload = f"{user_id_str}:{ts_str}"
    expected = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(expected, sig):
        return None
    if int(time.time()) - int(ts_str) > _STATE_TTL_SECONDS:
        return None
    return int(user_id_str)


# --- OAuth ------------------------------------------------------------------

def build_authorize_url(state: str) -> str:
    s = get_settings()
    from urllib.parse import urlencode

    params = {
        "response_type": "code",
        "client_id": s.fitbit_client_id,
        "scope": _SCOPES,
        "redirect_uri": s.fitbit_redirect_uri,
        "state": state,
    }
    return f"{_AUTHORIZE_URL}?{urlencode(params)}"


def _basic_auth_header() -> str:
    s = get_settings()
    token = base64.b64encode(f"{s.fitbit_client_id}:{s.fitbit_client_secret}".encode()).decode()
    return f"Basic {token}"


def exchange_code(code: str) -> dict:
    s = get_settings()
    try:
        resp = httpx.post(
            _TOKEN_URL,
            headers={
                "Authorization": _basic_auth_header(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": s.fitbit_redirect_uri,
            },
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise FitbitError(f"Could not reach Fitbit: {exc}") from exc
    if resp.status_code != 200:
        raise FitbitError(f"Fitbit rejected the authorisation: {resp.text[:200]}")
    return resp.json()


def refresh_tokens(refresh_token: str) -> dict:
    try:
        resp = httpx.post(
            _TOKEN_URL,
            headers={
                "Authorization": _basic_auth_header(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise FitbitError(f"Could not reach Fitbit: {exc}") from exc
    if resp.status_code != 200:
        raise FitbitError("Fitbit refused to refresh the token; reconnect the account.")
    return resp.json()


def expiry_from(token_response: dict) -> datetime:
    """A conservative absolute expiry from the token response's `expires_in`."""
    seconds = int(token_response.get("expires_in", 3600))
    # Renew a minute early so a call never lands right on the boundary.
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=max(seconds - 60, 60))


# --- Data -------------------------------------------------------------------

def fetch_readings(access_token: str, days: int = 30) -> List[DayReading]:
    """Pull steps, resting heart rate and sleep for the last `days` days.

    A metric a day has no data for is left None -- the same honesty rule the
    file parser follows.
    """
    end = date.today()
    start = end - timedelta(days=days)
    headers = {"Authorization": f"Bearer {access_token}"}

    steps: dict = {}
    hr: dict = {}
    sleep: dict = {}

    def _get(client: httpx.Client, path: str) -> Optional[dict]:
        try:
            r = client.get(f"{_API_BASE}{path}", headers=headers, timeout=30)
        except httpx.HTTPError as exc:
            raise FitbitError(f"Could not reach Fitbit: {exc}") from exc
        if r.status_code == 401:
            raise FitbitError("Fitbit access expired; reconnect the account.")
        return r.json() if r.status_code == 200 else None

    with httpx.Client() as client:
        data = _get(client, f"/1/user/-/activities/steps/date/{start}/{end}.json")
        for pt in (data or {}).get("activities-steps", []):
            try:
                d = date.fromisoformat(pt["dateTime"]); v = float(pt["value"])
            except (KeyError, ValueError):
                continue
            if v > 0:
                steps[d] = v

        data = _get(client, f"/1/user/-/activities/heart/date/{start}/{end}.json")
        for pt in (data or {}).get("activities-heart", []):
            rhr = (pt.get("value") or {}).get("restingHeartRate")
            try:
                d = date.fromisoformat(pt["dateTime"])
            except (KeyError, ValueError):
                continue
            if rhr:
                hr[d] = float(rhr)

        data = _get(client, f"/1.2/user/-/sleep/date/{start}/{end}.json")
        for s in (data or {}).get("sleep", []):
            try:
                d = date.fromisoformat(s["dateOfSleep"])
            except (KeyError, ValueError):
                continue
            minutes = s.get("minutesAsleep") or 0
            if minutes:
                sleep[d] = sleep.get(d, 0) + minutes / 60

    all_days = sorted(set(steps) | set(hr) | set(sleep))
    return [
        DayReading(
            measured_on=d,
            steps=int(round(steps[d])) if d in steps else None,
            resting_hr=int(round(hr[d])) if d in hr else None,
            sleep_hours=round(sleep[d], 2) if d in sleep else None,
        )
        for d in all_days
    ]

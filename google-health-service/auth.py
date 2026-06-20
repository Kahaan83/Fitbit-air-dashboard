"""
auth.py — Google OAuth 2.0 flow with refresh-token persistence.

First run:  Opens browser → user consents → saves token.json
Subsequent: Loads token.json → silently refreshes if expired → returns Credentials

Edge cases handled:
  - token.json missing/corrupt   → fall back to full browser consent
  - Refresh token revoked        → catch RefreshError → browser consent
  - Scope mismatch               → detect on load → browser consent
  - Non-allowlisted account      → OAuth returns 403 → logged with fix instructions
"""

import asyncio
import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("auth")

# ─── Load environment ─────────────────────────────────────────────────────────
load_dotenv()

CREDENTIALS_PATH = os.getenv("CREDENTIALS_PATH", "credentials.json")
TOKEN_PATH = os.getenv("TOKEN_PATH", "token.json")

# Check permissions if token.json exists when auth.py loads
if os.path.exists(TOKEN_PATH):
    try:
        import stat
        file_stat = os.stat(TOKEN_PATH)
        # Check if group or others have read/write/execute permissions (stat.S_IRWXG | stat.S_IRWXO)
        if file_stat.st_mode & (stat.S_IRWXG | stat.S_IRWXO):
            logger.warning(
                f"File permissions on {TOKEN_PATH} are too permissive: {oct(file_stat.st_mode & 0o777)}. "
                "The file should only be readable and writable by the owner."
            )
    except Exception as e:
        logger.warning(f"Failed to check permissions on {TOKEN_PATH}: {e}")

# ─── OAuth Scopes ─────────────────────────────────────────────────────────────
# IMPORTANT: These are the ONLY valid consolidated scopes for the Google Health
# API v4. Do NOT use granular per-metric scopes — they do not exist.
SCOPES = [
    "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
    "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
    "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
]


def _has_required_scopes(creds: Credentials) -> bool:
    """
    Verify that a loaded Credentials object covers all required scopes.

    Google does not always populate creds.scopes after loading from file,
    so we check the raw token file's 'scopes' field as a fallback.
    """
    if creds.scopes:
        return all(s in creds.scopes for s in SCOPES)

    # Fallback: read directly from the token file
    token_file = Path(TOKEN_PATH)
    if token_file.exists():
        try:
            with open(token_file, "r") as f:
                token_data = json.load(f)
            stored_scopes = token_data.get("scopes", [])
            return all(s in stored_scopes for s in SCOPES)
        except (json.JSONDecodeError, KeyError):
            pass

    # Cannot determine — trigger re-consent to be safe
    return False


def _create_installed_app_flow() -> InstalledAppFlow:
    creds_path = Path(CREDENTIALS_PATH)
    if not creds_path.exists():
        raise FileNotFoundError(
            f"credentials.json not found at '{CREDENTIALS_PATH}'. "
            "Download it from GCP Console → APIs & Services → Credentials."
        )

    # Validate that client_id and client_secret are not empty
    try:
        with open(creds_path, "r") as f:
            creds_data = json.load(f)
        if "installed" not in creds_data:
            creds_data["installed"] = {}
        installed_data = creds_data.get("installed", {})
        client_id = installed_data.get("client_id", "").strip()
        
        # Check env first for client secret and project ID
        env_client_secret = (os.getenv("GCP_CLIENT_SECRET") or "").strip()
        client_secret = installed_data.get("client_secret", "").strip()
        if not client_secret and env_client_secret:
            client_secret = env_client_secret
            creds_data["installed"]["client_secret"] = client_secret

        env_project_id = (os.getenv("GCP_PROJECT_ID") or "").strip()
        project_id = installed_data.get("project_id", "").strip()
        if not project_id and env_project_id:
            project_id = env_project_id
            creds_data["installed"]["project_id"] = project_id

        if not client_id or not client_secret:
            raise ValueError(
                "Client ID or Client Secret is empty. "
                "Please configure them in GCP/Environment/Settings first."
            )
    except (json.JSONDecodeError, KeyError) as e:
        raise ValueError(f"credentials.json is invalid: {e}")

    return InstalledAppFlow.from_client_config(creds_data, SCOPES)


def _run_browser_consent_sync(flow: InstalledAppFlow) -> Credentials:
    """
    Synchronous blocking browser consent flow execution.
    """
    logger.info("Starting browser OAuth consent flow (sync)...")
    creds = flow.run_local_server(
        port=0,
        success_message=(
            "Authentication complete — you can close this tab and return to the terminal."
        ),
        open_browser=True,
    )
    _save_token(creds)
    logger.info("OAuth consent complete. token.json saved.")
    return creds


async def _run_browser_consent(flow: InstalledAppFlow) -> Credentials:
    """
    Asynchronous browser consent flow executing in thread pool with 120s timeout.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_run_browser_consent_sync, flow),
            timeout=120.0
        )
    except (asyncio.TimeoutError, TimeoutError):
        logger.error("OAuth timeout — user did not complete consent within 120 seconds")
        raise HTTPException(
            status_code=503,
            detail="OAuth timeout — user did not complete consent in time"
        )


def _handle_oauth_exception(e: Exception) -> None:
    error_msg = str(e)
    if "access_denied" in error_msg or "403" in error_msg:
        raise RuntimeError(
            "OAuth was denied. Your Google account may not be on the "
            "GCP allowlist. Go to GCP Console → APIs & Services → "
            "OAuth consent screen → Test users, and add your email."
        ) from e
    raise


def _save_token(creds: Credentials) -> None:
    """Serialize credentials to token.json, including the refresh token."""
    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes) if creds.scopes else SCOPES,
        "expiry": creds.expiry.isoformat() if creds.expiry else None,
    }
    with open(TOKEN_PATH, "w") as f:
        json.dump(token_data, f, indent=2)
    import os, stat
    try:
        os.chmod(TOKEN_PATH, stat.S_IRUSR | stat.S_IWUSR)
    except Exception as e:
        logger.warning(f"Could not set permissions on token.json: {e}")
    logger.debug("token.json updated.")


def _load_and_refresh_cached_credentials() -> Credentials | None:
    """Loads token.json if it exists and silently refreshes it if expired."""
    token_path = Path(TOKEN_PATH)
    creds: Credentials | None = None

    # ── Attempt to load existing token ────────────────────────────────────────
    if token_path.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
            logger.info("Loaded existing credentials from token.json.")
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning(f"token.json is corrupt or unreadable ({e}). Re-authenticating.")
            creds = None

    # ── Validate and refresh if loaded ────────────────────────────────────────
    if creds is not None:
        # Check for scope coverage
        if not _has_required_scopes(creds):
            logger.warning(
                "token.json is missing required scopes. "
                "Re-authenticating to request all three Health API scopes."
            )
            creds = None

        # Check refresh token presence
        elif not creds.refresh_token:
            logger.warning("Refresh token is missing from token.json. Re-authenticating.")
            creds = None

    if creds is not None and creds.expired:
        # ── Silent refresh ─────────────────────────────────────────────────────
        try:
            logger.info("Access token expired — silently refreshing...")
            creds.refresh(Request())
            _save_token(creds)
            logger.info("Token refreshed successfully.")
        except RefreshError as e:
            logger.warning(
                f"Refresh token is invalid or revoked ({e}). "
                "Re-authenticating via browser."
            )
            creds = None
        except Exception as e:
            logger.error(f"Unexpected error during token refresh: {e}. Re-authenticating.")
            creds = None

    if creds is not None and creds.valid:
        return creds
    return None


def get_credentials_sync() -> Credentials:
    """
    Synchronous version of get_credentials() for synchronous callers (like client.py).
    Does NOT yield to the asyncio event loop.
    """
    creds = _load_and_refresh_cached_credentials()
    if creds is not None:
        return creds

    # ── Fall back to full browser consent (synchronous) ─────────────────────
    try:
        flow = _create_installed_app_flow()
        creds = _run_browser_consent_sync(flow)
    except Exception as e:
        _handle_oauth_exception(e)

    return creds


async def get_credentials() -> Credentials:
    """
    Returns a valid, refreshed google.oauth2.credentials.Credentials object.
    Uses asyncio.to_thread to run the browser consent server in a thread pool.
    """
    creds = _load_and_refresh_cached_credentials()
    if creds is not None:
        return creds

    # ── Fall back to full browser consent (asynchronous thread pool) ─────────
    try:
        flow = _create_installed_app_flow()
        creds = await _run_browser_consent(flow)
    except Exception as e:
        _handle_oauth_exception(e)

    return creds


def get_token_info() -> dict:
    """
    Returns a dict with token status information for the /api/status endpoint.

    Returns:
        dict: {
            "token_valid": bool,
            "scopes": list[str],
            "last_refreshed": str | None  (ISO 8601)
        }
    """
    token_path = Path(TOKEN_PATH)
    if not token_path.exists():
        return {"token_valid": False, "scopes": [], "last_refreshed": None}

    try:
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        valid = creds.valid or bool(creds.refresh_token)
        expiry_str = creds.expiry.isoformat() if creds.expiry else None
        return {
            "token_valid": valid,
            "scopes": list(creds.scopes) if creds.scopes else SCOPES,
            "last_refreshed": expiry_str,
        }
    except Exception as e:
        logger.warning(f"Could not read token info: {e}")
        return {"token_valid": False, "scopes": [], "last_refreshed": None}

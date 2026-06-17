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

import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
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


def _run_browser_consent() -> Credentials:
    """
    Runs the full InstalledAppFlow browser consent.

    Opens a local redirect server, launches the browser, waits for the user
    to complete OAuth, then saves the resulting credentials to token.json.

    Raises:
        FileNotFoundError: If credentials.json is not found.
        Exception: If the OAuth flow is cancelled or fails.
    """
    creds_path = Path(CREDENTIALS_PATH)
    if not creds_path.exists():
        raise FileNotFoundError(
            f"credentials.json not found at '{CREDENTIALS_PATH}'. "
            "Download it from GCP Console → APIs & Services → Credentials."
        )

    logger.info("Starting browser OAuth consent flow...")
    flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)

    # run_local_server: starts a local HTTP server on a random available port
    # and opens the browser automatically.
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
    logger.debug("token.json updated.")


def get_credentials() -> Credentials:
    """
    Returns a valid, refreshed google.oauth2.credentials.Credentials object.

    Decision tree:
      1. token.json exists AND covers all required scopes AND has a refresh token
         → try silent refresh if expired
         → return valid credentials
      2. token.json missing, corrupt, scope-mismatch, or refresh failed
         → run full browser consent flow
         → save token.json
         → return fresh credentials

    Returns:
        google.oauth2.credentials.Credentials: A valid credentials object with
        all three required Health API scopes.

    Raises:
        FileNotFoundError: If credentials.json is not found when consent is needed.
        RuntimeError: If a non-allowlisted account attempts to authenticate.
    """
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

    # ── Fall back to full browser consent ─────────────────────────────────────
    if creds is None or not creds.valid:
        try:
            creds = _run_browser_consent()
        except Exception as e:
            error_msg = str(e)
            if "access_denied" in error_msg or "403" in error_msg:
                raise RuntimeError(
                    "OAuth was denied. Your Google account may not be on the "
                    "GCP allowlist. Go to GCP Console → APIs & Services → "
                    "OAuth consent screen → Test users, and add your email."
                ) from e
            raise

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

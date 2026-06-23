import pytest
import json
import time
from unittest.mock import AsyncMock, patch
from google.oauth2.credentials import Credentials

# Mock credentials object to be returned by get_credentials
mock_creds = Credentials(token="mock-token", refresh_token="mock-refresh-token")

@pytest.fixture(autouse=True)
def reset_cache():
    # Import main and reset cache before each test
    import main
    import cache
    import sqlite3

    # Point cache module at a fresh in-memory DB so no on-disk data leaks in
    mem_db = sqlite3.connect(":memory:", check_same_thread=False)
    mem_db.execute("PRAGMA journal_mode=WAL")
    mem_db.execute("""
        CREATE TABLE IF NOT EXISTS day_cache (
            date TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    """)
    mem_db.commit()
    cache._db = mem_db

    main._cache = {
        "payload": None,
        "synced_at": None,
        "auto_synced_at": None,
        "user_synced_at": None,
        "days": {},
        "derived": None,
        "derived_hash": None,
    }
    yield

    mem_db.close()
    cache._db = None


@pytest.fixture(autouse=True)
def mock_auth():
    # Patch get_credentials and get_token_info to avoid touching real OAuth files
    with patch("main.get_credentials", AsyncMock(return_value=mock_creds)), \
         patch("main.get_token_info", return_value={"token_valid": True, "scopes": [], "last_refreshed": None}):
        yield

def test_health(test_client):
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_get_status(test_client):
    response = test_client.get("/api/status")
    assert response.status_code == 200
    assert response.json() == {"token_valid": True, "scopes": [], "last_refreshed": None}

def test_trigger_sync_cooldown(test_client, mock_client):
    # Setup mock methods for extractor calls
    mock_client.get_heart_rate.return_value = []
    mock_client.get_intraday_hrv.return_value = []
    mock_client.get_spo2.return_value = []
    mock_client.get_sleep.return_value = []
    mock_client.get_steps.return_value = []

    # First call: Should succeed and return 200
    payload = {"start_date": "2026-06-01", "end_date": "2026-06-07"}
    response = test_client.post("/api/trigger-sync", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Second call within 60s: Should fail with 429
    response2 = test_client.post("/api/trigger-sync", json=payload)
    assert response2.status_code == 429
    assert "Sync cooldown active" in response2.json()["error"]

def test_get_health_data_payload(test_client, mock_client):
    # Populate the cache by calling trigger-sync first
    payload = {"start_date": "2026-06-01", "end_date": "2026-06-07"}
    test_client.post("/api/trigger-sync", json=payload)

    # Now get health data for the same date range that was synced
    response = test_client.get("/api/health-data?start_date=2026-06-01&end_date=2026-06-07")
    assert response.status_code == 200
    data = response.json()
    assert "heart_rate" in data
    assert "hrv" in data
    assert "spo2" in data
    assert "sleep" in data
    assert "steps" in data
    assert "derived" in data
    assert data.get("stale") is False or data.get("stale") is None

def test_get_health_data_cold_cache(test_client, mock_client):
    # With a cold cache, GET /api/health-data should trigger auto-sync
    response = test_client.get("/api/health-data")
    assert response.status_code == 200
    data = response.json()
    assert "derived" in data
    # Cache should be populated now
    import main
    assert main._cache["payload"] is not None

def test_get_alerts(test_client):
    # 1. No thresholds breached
    import main
    main._cache["payload"] = {
        "heart_rate": [],
        "hrv": [],
        "spo2": [{"timestamp": "2026-06-20T10:00:00Z", "value": 98.0}],
        "sleep": [],
        "derived": {
            "acute_stress": [],
            "sleep_debt": [{"date": "2026-06-20", "debt_hours": 0.0}]
        }
    }
    
    response = test_client.get("/api/alerts")
    assert response.status_code == 200
    assert response.json() == []

    # 2. Thresholds breached (SpO2 drop, sleep debt, high stress)
    main._cache["payload"] = {
        "heart_rate": [],
        "hrv": [],
        "spo2": [{"timestamp": "2026-06-20T10:00:00Z", "value": 88.5}],
        "sleep": [],
        "derived": {
            "acute_stress": [{"start": "2026-06-20T11:00:00Z", "hr_peak": 170.0, "severity": "high"}],
            "sleep_debt": [{"date": "2026-06-20", "debt_hours": 4.5}]
        }
    }

    response = test_client.get("/api/alerts")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) == 3
    
    types = [a["type"] for a in alerts]
    assert "spo2_drop" in types
    assert "high_stress" in types
    assert "sleep_deprivation" in types


def test_update_settings_client_id_unchanged(test_client):
    credentials_json_content = json.dumps({
        "installed": {
            "client_id": "test-client-id-123",
            "client_secret": "secret",
            "project_id": "mock-project"
        }
    })
    token_json_content = json.dumps({
        "client_id": "test-client-id-123",
        "token": "mock-token"
    })

    exists_mock = lambda path: True if path in ["credentials.json", "token.json"] else False
    
    from unittest.mock import mock_open
    import json as json_module
    
    mock_files = {
        "credentials.json": credentials_json_content,
        "token.json": token_json_content
    }
    
    def custom_open(path, mode="r", *args, **kwargs):
        if "w" in mode:
            return mock_open().return_value
        content = mock_files.get(str(path), "")
        return mock_open(read_data=content).return_value

    with patch("os.path.exists", side_effect=exists_mock), \
         patch("builtins.open", side_effect=custom_open), \
         patch("os.remove") as mock_remove:
        
        payload = {
            "client_id": "",
            "client_secret": "",
            "age": 28,
            "max_hr": 185.0,
            "resting_hr": 58.0,
            "target_sleep_hours": 8.0
        }
        response = test_client.post("/api/settings", json=payload)
        assert response.status_code == 200
        mock_remove.assert_not_called()


def test_update_settings_client_id_changed(test_client):
    credentials_json_content = json.dumps({
        "installed": {
            "client_id": "test-client-id-123",
            "client_secret": "secret",
            "project_id": "mock-project"
        }
    })
    token_json_content = json.dumps({
        "client_id": "test-client-id-123",
        "token": "mock-token"
    })

    exists_mock = lambda path: True if path in ["credentials.json", "token.json"] else False
    
    from unittest.mock import mock_open
    import json as json_module
    
    mock_files = {
        "credentials.json": credentials_json_content,
        "token.json": token_json_content
    }
    
    def custom_open(path, mode="r", *args, **kwargs):
        if "w" in mode:
            return mock_open().return_value
        content = mock_files.get(str(path), "")
        return mock_open(read_data=content).return_value

    with patch("os.path.exists", side_effect=exists_mock), \
         patch("builtins.open", side_effect=custom_open), \
         patch("os.remove") as mock_remove:
        
        payload = {
            "client_id": "new-different-client-id",
            "client_secret": "",
            "age": 28,
            "max_hr": 185.0,
            "resting_hr": 58.0,
            "target_sleep_hours": 8.0
        }
        response = test_client.post("/api/settings", json=payload)
        assert response.status_code == 200
        mock_remove.assert_called_once_with("token.json")


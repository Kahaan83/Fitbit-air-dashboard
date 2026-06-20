# Manual Smoke Test Scripts

These scripts require live Google Health API credentials and an active `token.json`. Run manually only — never in CI.

## Scripts

1. `smoke_api.py`: Queries the live Google Health API `steps` data points to verify that OAuth credentials and token scope are working correctly.
2. `smoke_backend.py`: Hits the local FastAPI dashboard server `/api/health-data` endpoint to verify end-to-end integration and telemetry payload structure.

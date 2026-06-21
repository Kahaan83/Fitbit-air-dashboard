import requests
import json

try:
    print("Testing /api/status...")
    res = requests.get("http://127.0.0.1:8000/api/status")
    print("Status code:", res.status_code)
    print("Response:", json.dumps(res.json(), indent=2))
except Exception as e:
    print("Error calling /api/status:", e)

try:
    print("\nTesting /api/health-data...")
    res = requests.get("http://127.0.0.1:8000/api/health-data")
    print("Status code:", res.status_code)
    data = res.json()
    print("Derived keys:", list(data.get("derived", {}).keys()) if "derived" in data else "no derived")
    print("Heart rate count:", len(data.get("heart_rate", [])) if "heart_rate" in data else "no hr")
    print("HRV count:", len(data.get("hrv", [])) if "hrv" in data else "no hrv")
    print("SpO2 count:", len(data.get("spo2", [])) if "spo2" in data else "no spo2")
except Exception as e:
    print("Error calling /api/health-data:", e)

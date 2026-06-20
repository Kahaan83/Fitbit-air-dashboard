import requests
import json

try:
    print("Sending GET to http://127.0.0.1:8000/api/health-data...")
    res = requests.get("http://127.0.0.1:8000/api/health-data")
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Keys returned in payload:", list(data.keys()))
    if "derived" in data:
        print("Derived metrics:", list(data["derived"].keys()))
        for k, v in data["derived"].items():
            print(f"  {k}: {len(v)} points")
    print("\nPhysiological raw data stream lengths:")
    for k in ["heart_rate", "hrv", "spo2", "sleep_temp", "sleep", "steps"]:
        print(f"  {k}: {len(data.get(k, []))} points")
except Exception as e:
    print("Error calling local backend:", e)

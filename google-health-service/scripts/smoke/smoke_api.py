import requests
from google.oauth2.credentials import Credentials
import json

try:
    with open("token.json", "r") as f:
        token_data = json.load(f)
    creds = Credentials.from_authorized_user_file("token.json")
except Exception as e:
    print(f"Error loading token.json: {e}")
    exit(1)

headers = {
    "Authorization": f"Bearer {creds.token}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

url = "https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints"
res = requests.get(url, headers=headers)
data = res.json()
points = data.get("dataPoints", [])
if points:
    print(json.dumps(points[0], indent=2))
else:
    print("No steps found")

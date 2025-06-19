import requests

ANKI_CONNECT_URL = "http://127.0.0.1:8765"

def invoke(action, **params):
    return requests.post(ANKI_CONNECT_URL, json={
        "action": action,
        "version": 6,
        "params": params
    }).json()

# Sync with AnkiWeb
print("Syncing with AnkiWeb...")
sync_result = invoke("sync")
if 'error' in sync_result and sync_result['error'] is not None:
    print(f"Error syncing: {sync_result['error']}")
else:
    print("Successfully synced with AnkiWeb") 
import json
import requests

ANKI_CONNECT_URL = "http://127.0.0.1:8765"

def invoke(action, **params):
    return requests.post(ANKI_CONNECT_URL, json={
        "action": action,
        "version": 6,
        "params": params
    }).json()

# Get available note types
print("Getting available note types...")
result = invoke("modelNames")
if 'error' in result and result['error'] is not None:
    print(f"Error getting note types: {result['error']}")
else:
    print("Available note types:", result['result'])

# Create the test deck
result = invoke("createDeck", deck="test2")
if 'error' in result and result['error'] is not None:
    print(f"Error creating deck: {result['error']}")
else:
    print("Successfully created 'test' deck")

# Load JSON notes
with open('notes.json', 'r', encoding='utf-8') as f:
    notes = json.load(f)

for note in notes:
    # You can specify different note types here
    # Common note types include:
    # - "Basic" (default)
    # - "Basic (and reversed card)"
    # - "Cloze"
    # - "Basic (type in the answer)"
    # - "Basic (optional reversed card)"
    # - "Basic (with typing)"
    # - "Basic (with reversed card)"
    # - "Basic (with reversed card and typing)"
    
    # Example of changing note type:
    # note["modelName"] = "Basic (and reversed card)"
    
    result = invoke("addNote", note=note)
    if 'error' in result and result['error'] is not None:
        print(f"Error adding note: {result['error']}")
    else:
        print(f"Added note with ID: {result['result']}")

# Sync with AnkiWeb
print("Syncing with AnkiWeb...")
sync_result = invoke("sync")
if 'error' in sync_result and sync_result['error'] is not None:
    print(f"Error syncing: {sync_result['error']}")
else:
    print("Successfully synced with AnkiWeb")

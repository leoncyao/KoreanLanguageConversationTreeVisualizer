import json
import requests
import uuid
import argparse

ANKI_CONNECT_URL = "http://127.0.0.1:8765"

def invoke(action, **params):
    return requests.post(ANKI_CONNECT_URL, json={
        "action": action,
        "version": 6,
        "params": params
    }).json()

def add_notes_to_deck(deck_name):
    # Create the deck if it doesn't exist
    result = invoke("createDeck", deck=deck_name)
    if 'error' in result and result['error'] is not None:
        print(f"Error creating deck: {result['error']}")
        return
    else:
        print(f"Successfully created/verified deck: '{deck_name}'")

    # Load JSON notes
    with open(f'{deck_name}.json', 'r', encoding='utf-8') as f:
        notes = json.load(f)

    # Add each note to the deck
    success_count = 0
    error_count = 0
    for note in notes:
        # Set the deck name for this note
        # note['deckName'] = deck_name
        
        # Add options to force add duplicates
        note['options'] = {
            "duplicateScope": "deck",
            "duplicateCheck": False
        }
        
        print("deck_name: ", deck_name)
        result = invoke("addNote", note=note)
        if 'error' in result and result['error'] is not None:
            print(f"Error adding note: {result['error']}")
            error_count += 1
        else:
            print(f"Added note with ID: {result['result']}")
            success_count += 1

    print(f"\nSummary:")
    print(f"Successfully added: {success_count} notes")
    print(f"Failed to add: {error_count} notes")

    # Sync with AnkiWeb
    print("\nSyncing with AnkiWeb...")
    sync_result = invoke("sync")
    if 'error' in sync_result and sync_result['error'] is not None:
        print(f"Error syncing: {sync_result['error']}")
    else:
        print("Successfully synced with AnkiWeb")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Add notes to an Anki deck')
    parser.add_argument('deck_name', type=str, help='Name of the deck to add notes to')
    args = parser.parse_args()
    
    add_notes_to_deck(args.deck_name) 
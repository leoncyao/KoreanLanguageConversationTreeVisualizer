import requests

ANKI_CONNECT_URL = "http://127.0.0.1:8765"

def invoke(action, **params):
    return requests.post(ANKI_CONNECT_URL, json={
        "action": action,
        "version": 6,
        "params": params
    }).json()

def create_deck(deck_name):
    # Create the deck
    result = invoke("createDeck", deck=deck_name)
    if 'error' in result and result['error'] is not None:
        print(f"Error creating deck: {result['error']}")
    else:
        print(f"Successfully created deck: '{deck_name}'")
    
    # Get deck info to verify
    deck_info = invoke("getDeckConfig", deck=deck_name)
    if 'error' in deck_info and deck_info['error'] is not None:
        print(f"Error getting deck info: {deck_info['error']}")
    else:
        print(f"Deck '{deck_name}' is ready to use")

if __name__ == "__main__":
    # You can change this to any deck name you want
    DECK_NAME = "test2"
    create_deck(DECK_NAME) 
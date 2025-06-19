import json

def change_deck_names(notes_file, new_deck_name):
    # Load JSON notes
    with open(notes_file, 'r', encoding='utf-8') as f:
        notes = json.load(f)
    
    # Change deck name for each note
    for note in notes:
        note['deckName'] = new_deck_name
    
    # Save the modified notes back to the file
    with open(notes_file, 'w', encoding='utf-8') as f:
        json.dump(notes, f, indent=2, ensure_ascii=False)
    
    print(f"Changed all deck names to: '{new_deck_name}'")
    print(f"Total notes modified: {len(notes)}")

if __name__ == "__main__":
    # You can change this to any deck name you want
    NEW_DECK_NAME = "test2"
    change_deck_names('notes.json', NEW_DECK_NAME) 
# KoreanLanguageConversationTreeVisualizer

An interactive React application for learning Korean through conversation trees. The app dynamically builds conversation paths as you progress and provides real-time feedback on your Korean language skills.

## Features

- **Dynamic Conversation Tree**: The tree starts blank and builds up as you progress through conversations
- **Interactive Learning**: Type Korean responses and get immediate feedback
- **Visual Progress**: See your conversation path and possible future branches
- **Score Tracking**: Earn points for correct answers
- **Multiple Conversation Paths**: Explore different dialogue scenarios

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## How to Play

1. The conversation tree starts with just a greeting
2. Type your Korean response in the input field
3. Press Enter or click Submit to check your answer
4. Watch the tree grow with your conversation path
5. See possible future branches with dotted lines
6. Use "Next Question" to start a new conversation path

## Project Structure

```
src/
├── components/
│   ├── ConversationTree.js    # Tree visualization component
│   ├── ConversationTree.css   # Tree styling
│   ├── GamePanel.js          # Game logic and chat interface
│   └── GamePanel.css         # Game panel styling
├── App.js                    # Main application component
├── App.css                   # Main app styling
├── index.js                  # React entry point
├── index.css                 # Global styles
└── conversation_tree.json    # Conversation data
```

## Customizing Conversations

To add new conversations or modify existing ones, edit the `src/conversation_tree.json` file. Each node should have:

- `id`: Unique identifier
- `text`: Korean text with English translation (use `<br>` for line breaks)
- `type`: Node type (greeting, statement, question, response)
- `responses`: Array of possible next nodes

## Available Scripts

- `npm start`: Runs the app in development mode
- `npm build`: Builds the app for production
- `npm test`: Launches the test runner
- `npm eject`: Ejects from Create React App (one-way operation)

## Technologies Used

- React 18
- Mermaid.js for tree visualization
- CSS Grid for responsive layout
- JSON for conversation data storage

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import './ConversationTree.css';

const ConversationTree = ({ conversationTree, currentPath, setCurrentPath }) => {
  const mermaidRef = useRef(null);
  const [mermaidInitialized, setMermaidInitialized] = useState(false);

  useEffect(() => {
    const initMermaid = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
          }
        });
        setMermaidInitialized(true);
      } catch (error) {
        console.error('Error initializing Mermaid:', error);
      }
    };

    initMermaid();
  }, []);

  useEffect(() => {
    if (conversationTree && mermaidRef.current && mermaidInitialized) {
      updateTreeVisualization();
    }
  }, [conversationTree, currentPath, mermaidInitialized]);

  const updateTreeVisualization = async () => {
    if (!conversationTree || !mermaidRef.current) return;

    try {
      let mermaidCode = 'graph TD\n';
      
      // Add all nodes in the current path
      currentPath.forEach((nodeId, index) => {
        const node = findNodeById(conversationTree, nodeId);
        if (node) {
          mermaidCode += `    ${nodeId}[${node.text}]\n`;
          
          // Add connections
          if (index < currentPath.length - 1) {
            mermaidCode += `    ${nodeId} --> ${currentPath[index + 1]}\n`;
          }
        }
      });
      
      // Add possible next nodes
      const lastNode = currentPath[currentPath.length - 1];
      const lastNodeData = findNodeById(conversationTree, lastNode);
      
      if (lastNodeData && lastNodeData.responses) {
        lastNodeData.responses.forEach(response => {
          if (!currentPath.includes(response.id)) {
            mermaidCode += `    ${response.id}[${response.text}]\n`;
            mermaidCode += `    ${lastNode} -.-> ${response.id}\n`;
          }
        });
      }
      
      // Add styling
      mermaidCode += '\n    %% Styling\n';
      mermaidCode += '    classDef korean fill:#f9f,stroke:#333,stroke-width:2px;\n';
      mermaidCode += '    classDef question fill:#bbf,stroke:#333,stroke-width:2px;\n';
      mermaidCode += '    classDef response fill:#bfb,stroke:#333,stroke-width:2px;\n';
      mermaidCode += '    classDef fill_blank fill:#ffd700,stroke:#333,stroke-width:2px;\n';
      mermaidCode += '    classDef active fill:#ff6b6b,stroke:#333,stroke-width:3px;\n';
      mermaidCode += '    classDef possible fill:#fff3cd,stroke:#333,stroke-width:1px;\n\n';
      
      // Apply styles
      currentPath.forEach(nodeId => {
        const node = findNodeById(conversationTree, nodeId);
        if (node) {
          if (node.type === 'question') {
            mermaidCode += `    class ${nodeId} question;\n`;
          } else if (node.type === 'response') {
            mermaidCode += `    class ${nodeId} response;\n`;
          } else if (node.type === 'fill_blank') {
            mermaidCode += `    class ${nodeId} fill_blank;\n`;
          } else {
            mermaidCode += `    class ${nodeId} korean;\n`;
          }
        }
      });
      
      // Highlight current node
      const activeNode = currentPath[currentPath.length - 1];
      mermaidCode += `    class ${activeNode} active;\n`;
      
      mermaidRef.current.innerHTML = mermaidCode;
      
      // Clear any existing diagrams
      mermaidRef.current.innerHTML = '';
      
      // Render the new diagram
      const { svg } = await mermaid.render('conversation-tree', mermaidCode);
      mermaidRef.current.innerHTML = svg;
      
    } catch (error) {
      console.error('Error updating tree visualization:', error);
      mermaidRef.current.innerHTML = '<div class="error">Error loading conversation tree</div>';
    }
  };

  const findNodeById = (node, id) => {
    if (!node) return null;
    if (node.id === id) return node;
    if (node.responses) {
      for (const response of node.responses) {
        const found = findNodeById(response, id);
        if (found) return found;
      }
    }
    return null;
  };

  const showPossibleBranches = () => {
    if (!conversationTree) return null;
    
    const lastNode = currentPath[currentPath.length - 1];
    const lastNodeData = findNodeById(conversationTree, lastNode);
    
    if (lastNodeData && lastNodeData.responses && lastNodeData.responses.length > 1) {
      return (
        <div className="possible-branches">
          <h4>Possible Next Steps:</h4>
          <div className="branch-options">
            {lastNodeData.responses.map(response => (
              <div key={response.id} className="branch-option">
                • {response.text.split('<br>')[0]}
                {response.type === 'fill_blank' && (
                  <span className="hint-indicator"> (Fill in the blank)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (!conversationTree) {
    return (
      <div className="visualization-panel">
        <h3>Conversation Tree:</h3>
        <div className="tree-container">
          <div className="loading">Loading conversation tree...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="visualization-panel">
      <h3>Conversation Tree:</h3>
      <div className="tree-container">
        <div ref={mermaidRef} className="mermaid"></div>
      </div>
      {showPossibleBranches()}
    </div>
  );
};

export default ConversationTree; 
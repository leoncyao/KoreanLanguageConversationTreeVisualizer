import React from 'react';

const ConsoleErrors = ({
  consoleErrors,
  showErrorPanel,
  setShowErrorPanel,
  consoleErrorRef,
  setConsoleErrors,
}) => {
  return (
    <div className="audio-card" style={{ marginTop: 12 }}>
      <h2 className="audio-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Console Errors & Warnings</span>
        {consoleErrors.length > 0 && (
          <span style={{ 
            fontSize: 12, 
            background: '#f44336', 
            color: 'white', 
            padding: '2px 8px', 
            borderRadius: 12,
            fontWeight: 600
          }}>
            {consoleErrors.length}
          </span>
        )}
      </h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button className="audio-btn" onClick={() => setShowErrorPanel(!showErrorPanel)}>
          {showErrorPanel ? 'Hide Errors' : 'Show Errors'}
        </button>
        {consoleErrors.length > 0 && (
          <button className="audio-btn" onClick={() => {
            consoleErrorRef.current = [];
            setConsoleErrors([]);
          }}>
            Clear All
          </button>
        )}
      </div>
      {showErrorPanel && (
        <div style={{ 
          maxHeight: '400px', 
          overflow: 'auto', 
          border: '1px solid #ddd', 
          borderRadius: 6, 
          background: '#fafafa',
          fontSize: 12
        }}>
          {consoleErrors.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>
              No errors or warnings
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 0 }}>
              {consoleErrors.map((err) => (
                <div 
                  key={err.id} 
                  style={{ 
                    padding: '10px 12px', 
                    borderBottom: '1px solid #eee',
                    background: err.type === 'error' ? '#ffebee' : '#fff3e0',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace'
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ 
                      fontSize: 10, 
                      fontWeight: 600,
                      color: err.type === 'error' ? '#c62828' : '#e65100',
                      minWidth: 50
                    }}>
                      {err.type.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 10, color: '#666', flex: 1 }}>
                      {err.timestamp}
                    </span>
                  </div>
                  <div style={{ 
                    color: err.type === 'error' ? '#b71c1c' : '#bf360c',
                    whiteSpace: 'pre-wrap',
                    fontSize: 11,
                    lineHeight: 1.4
                  }}>
                    {err.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConsoleErrors;


import React from 'react';
import SessionSetDialog from './SessionSetDialog';

const ProgressPanel = ({
  practiceMode,
  allPhrases,
  sessionPhrases,
  verbPracticeSession,
  conversationSession,
  mixState,
  activeTotal,
  activeUsed,
  activePhrases,
  sessionPage,
  setSessionPage,
  showSetDialog,
  setShowSetDialog,
  progressPercentage,
  numBlanks,
  setNumBlanks,
  setPracticeMode,
  textSize,
  setTextSize,
  SESSION_SIZE
}) => {
  const shouldShow = 
    (practiceMode === 1 && (allPhrases.length > 0 || (sessionPhrases && sessionPhrases.length > 0))) ||
    (practiceMode === 2 && verbPracticeSession.length > 0) ||
    (practiceMode === 3 && conversationSession.length > 0) ||
    (practiceMode === 4 && mixState && mixState.mix_items && mixState.mix_items.length > 0);

  if (!shouldShow) return null;

  return (
    <div style={{ marginTop: 16, padding: '10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        {practiceMode === 1 && (
          <h2 style={{ margin: 0 }}>
            Set {Math.min(sessionPage + 1, Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE)))} / {Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE))}
          </h2>
        )}
        {(practiceMode === 2 || practiceMode === 3 || practiceMode === 4) && (
          <h2 style={{ margin: 0 }}>
            {practiceMode === 2 ? 'Verb Practice' : practiceMode === 3 ? 'Conversation' : 'Mix'} Session
          </h2>
        )}
        <h3 style={{ margin: '4px 0 0 0', color: '#6b7280', fontWeight: 600 }}>
          {practiceMode === 4 ? (
            activeTotal > 0 ? (
              <>Item {Math.min(Math.max(0, activeUsed) + 1, activeTotal)} of {activeTotal}</>
            ) : (
              <>Loading mix...</>
            )
          ) : (
            <>{activeUsed} / {activeTotal} phrases (session)</>
          )}
        </h3>
      </div>
      {practiceMode === 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, margin: '6px 0 10px' }}>
          <button
            type="button"
            className="regenerate-button"
            onClick={() => setSessionPage((p) => Math.max(0, p - 1))}
            disabled={sessionPage <= 0}
            title="Previous 5-phrase set"
            style={{ padding: '6px 14px' }}
          >
            Prev 5
          </button>
          <button
            type="button"
            className="regenerate-button"
            onClick={() => setSessionPage((p) => {
              const totalSets = Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE));
              return Math.min(totalSets - 1, p + 1);
            })}
            disabled={sessionPage >= Math.max(1, Math.ceil((allPhrases.length || 0) / SESSION_SIZE)) - 1}
            title="Next 5-phrase set"
            style={{ padding: '6px 14px' }}
          >
            Next 5
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <button
          type="button"
          className="regenerate-button"
          onClick={() => setShowSetDialog(v => !v)}
          title={showSetDialog ? 'Hide sentences in this set' : 'Show sentences in this set'}
          style={{ padding: '6px 14px' }}
        >
          {showSetDialog ? 'Hide Set' : 'Show Set'}
        </button>
      </div>
      <SessionSetDialog showSetDialog={showSetDialog} activePhrases={activePhrases} />
      <div style={{ width: '100%', height: 12, background: '#e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
        <div 
          style={{ 
            width: `${progressPercentage}%`, 
            height: '100%', 
            background: progressPercentage === 100 ? '#4caf50' : '#2196f3',
            transition: 'width 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }} 
        >
          {progressPercentage > 15 && (
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>
              {Math.round(progressPercentage)}%
            </span>
          )}
        </div>
      </div>
      {progressPercentage === 100 && practiceMode === 1 && (
        <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
          ✓ All curriculum phrases completed! Now practicing with AI variations.
        </p>
      )}
      {progressPercentage === 100 && practiceMode === 2 && (
        <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
          ✓ All verb practice phrases completed! Session will regenerate.
        </p>
      )}
      {progressPercentage === 100 && practiceMode === 3 && (
        <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
          ✓ All conversation phrases completed! Session will regenerate.
        </p>
      )}
      {practiceMode === 4 && mixState && mixState.current_index >= (mixState.mix_items?.length || 0) && (
        <p style={{ fontSize: 11, color: '#4caf50', marginTop: 6, marginBottom: 0, textAlign: 'center' }}>
          ✓ Mix completed! Generate a new mix to continue.
        </p>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Blanks:</label>
          <select value={numBlanks} onChange={(e) => {
            const val = parseInt(e.target.value || '1', 10);
            setNumBlanks(val);
            try { localStorage.setItem('practice_numBlanks', String(val)); } catch (_) {}
          }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Mode:</label>
          <select value={practiceMode} onChange={(e) => {
            const val = parseInt(e.target.value || '4', 10);
            setPracticeMode(val);
            try { localStorage.setItem('practice_mode', String(val)); } catch (_) {}
          }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
            <option value={1}>Curriculum</option>
            <option value={2}>Verb Practice</option>
            <option value={3}>Conversations</option>
            <option value={4}>Mix</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Text Size:</label>
          <select value={textSize} onChange={(e) => {
            const val = parseFloat(e.target.value || '1.0');
            setTextSize(val);
            try { localStorage.setItem('practice_textSize', String(val)); } catch (_) {}
          }} style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4 }}>
            <option value={0.5}>50%</option>
            <option value={0.6}>60%</option>
            <option value={0.7}>70%</option>
            <option value={0.8}>80%</option>
            <option value={0.9}>90%</option>
            <option value={1.0}>100%</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default ProgressPanel;


import React from 'react';

const NewConversationForm = ({
  quizMode,
  quizDifficulty,
  conversationContextKorean,
  setConversationContextKorean,
  conversationContextEnglish,
  setConversationContextEnglish,
  handleGenerateNewConversation,
}) => {
  if (!(quizMode === 'hands-free' && (Number(quizDifficulty) || 1) === 3)) {
    return null;
  }

  return (
    <div className="audio-card" style={{ marginTop: 12 }}>
      <h2 className="audio-section-title">New Conversation</h2>
      <div style={{ display: 'grid', gap: 8, padding: '12px', background: '#f8f9fa', borderRadius: 6, border: '1px solid #ddd' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Conversation Context (Optional)</div>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
          Enter example sentences to guide the conversation topic and style
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>Korean Example</span>
            <input
              type="text"
              value={conversationContextKorean}
              onChange={(e) => setConversationContextKorean(e.target.value)}
              placeholder="예: 오늘 날씨가 정말 좋네요"
              style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>English Example</span>
            <input
              type="text"
              value={conversationContextEnglish}
              onChange={(e) => setConversationContextEnglish(e.target.value)}
              placeholder="e.g., I'm planning to visit a cafe this weekend"
              style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
            />
          </label>
        </div>
        <button
          className="audio-btn"
          onClick={handleGenerateNewConversation}
          title="Generate a new 5‑turn conversation"
          aria-label="Generate new conversation"
        >
          Generate New Conversation
        </button>
      </div>
    </div>
  );
};

export default NewConversationForm;


import { useState, useRef, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const QUICK_PROMPTS = [
  'How do I find a plumber?',
  'How does booking work?',
  'What is Emergency Mode?',
  'How are helpers recommended?',
  'How do I register as a helper?',
];

const WELCOME_MESSAGE = {
  role: 'assistant',
  text: "👋 Hi! I'm the **At Your Service** AI assistant.\n\nI can help you find the right home service, explain how bookings work, or answer any questions about the platform.\n\nWhat can I help you with today?",
};

function formatText(text) {
  // Convert **bold** and newlines to JSX
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

export default function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/api/chatbot`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load chat history');
        if (data.length) {
          setMessages(data.map((item) => ({ role: item.role === 'model' ? 'assistant' : 'user', text: item.content })));
          setShowQuick(false);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  async function sendMessage(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput('');
    setError('');
    setShowQuick(false);
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Active-Role': localStorage.getItem('activeRole') || '',
        },
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to get a response.');
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleReset() {
    setMessages([WELCOME_MESSAGE]);
    setShowQuick(true);
    setError('');
    setInput('');
  }

  return (
    <>
      {/* ── Floating toggle button ── */}
      {!open && (
        <button
          className="chatbot-fab"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          id="chatbot-fab-btn"
          type="button"
        >
          <i className="fas fa-robot" />
          <span className="chatbot-fab-label">AI Assistant</span>
          <span className="chatbot-fab-pulse" />
        </button>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div className="chatbot-panel" role="dialog" aria-label="AI Assistant">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-avatar">
                <i className="fas fa-robot" />
                <span className="chatbot-online-dot" />
              </div>
              <div>
                <p className="chatbot-title">AI Assistant</p>
                <p className="chatbot-subtitle">At Your Service · Always online</p>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                className="chatbot-icon-btn"
                onClick={handleReset}
                title="New conversation"
                type="button"
                aria-label="Reset conversation"
              >
                <i className="fas fa-redo-alt" />
              </button>
              <button
                className="chatbot-icon-btn"
                onClick={() => setOpen(false)}
                type="button"
                aria-label="Close"
              >
                <i className="fas fa-times" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages" id="chatbot-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`chatbot-msg chatbot-msg--${msg.role}`}
              >
                {msg.role === 'assistant' && (
                  <div className="chatbot-msg-avatar">
                    <i className="fas fa-robot" />
                  </div>
                )}
                <div className="chatbot-msg-bubble">
                  {formatText(msg.text)}
                </div>
              </div>
            ))}

            {/* Quick prompts (shown only at start) */}
            {showQuick && messages.length === 1 && (
              <div className="chatbot-quick-prompts">
                <p className="chatbot-quick-label">Quick questions:</p>
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    className="chatbot-quick-btn"
                    onClick={() => sendMessage(q)}
                    type="button"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {loading && (
              <div className="chatbot-msg chatbot-msg--assistant">
                <div className="chatbot-msg-avatar">
                  <i className="fas fa-robot" />
                </div>
                <div className="chatbot-msg-bubble chatbot-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="chatbot-error">
                <i className="fas fa-exclamation-circle" /> {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input-row">
            <input
              ref={inputRef}
              className="chatbot-input"
              type="text"
              placeholder="Ask me anything about the platform…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              maxLength={500}
              id="chatbot-input"
              aria-label="Message the AI assistant"
            />
            <button
              className="chatbot-send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              type="button"
              aria-label="Send message"
              id="chatbot-send-btn"
            >
              <i className="fas fa-paper-plane" />
            </button>
          </div>
          <p className="chatbot-footer-note">
            Powered by Google Gemini · Replies may not be 100% accurate
          </p>
        </div>
      )}
    </>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messagesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import LoadingSpinner from '../components/LoadingSpinner';
import ProfileLink from '../components/ProfileLink';

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '';
const SOCKET_URL = rawSocketUrl
  ? rawSocketUrl.replace(/\/api\/?$/, '').replace(/\/$/, '')
  : undefined;

export default function Chat() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('userId');

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const activeConvRef = useRef(null);
  activeConvRef.current = activeConv;

  // Initialize socket
  useEffect(() => {
    const token = localStorage.getItem('token');
    const s = io(SOCKET_URL, { auth: { token }, withCredentials: true });
    setSocket(s);

    s.on('new_message', (msg) => {
      // Only add messages from OTHER users; our own messages are already added via the API response.
      if (msg.sender_id !== user.id && msg.conversation_id === activeConvRef.current?.id) {
        setMessages(prev => prev.some(item=>item.id===msg.id) ? prev : [...prev, msg]);
      }
      messagesAPI.getConversations().then(setConversations).catch(console.error);
    });

    return () => s.disconnect();
  }, []);

  // Load conversations
  useEffect(() => {
    messagesAPI.getConversations()
      .then(setConversations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Auto-open conversation when navigated with userId
  useEffect(() => {
    if (targetUserId && !loading) {
      messagesAPI.getOrCreateConversation(targetUserId).then((conv) => {
        setActiveConv(conv);
        loadMessages(conv.id);
        if (socket) socket.emit('join_conversation', conv.id);
        // Refresh conversations
        messagesAPI.getConversations().then(setConversations);
      }).catch(console.error);
    }
  }, [targetUserId, loading]);

  const loadMessages = async (convId) => {
    try {
      const msgs = await messagesAPI.getMessages(convId);
      setMessages(msgs);
    } catch (err) { console.error(err); }
  };

  const selectConversation = (conv) => {
    setActiveConv(conv);
    loadMessages(conv.id);
    if (socket) socket.emit('join_conversation', conv.id);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv || activeConv.is_other_active === false) return;

    try {
      const recipientId = activeConv.other_id || activeConv.other_user?.id;
      const result = await messagesAPI.send({
        recipient_id: recipientId,
        content: newMessage,
      });

      setMessages(prev => [...prev, result.message]);

      setNewMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page chat-page">
      <div className="container">
        <div className="chat-layout animate-fade-in">
          {/* Sidebar */}
          <div className="chat-sidebar glass-card-static">
            <h2 className="chat-sidebar-title"><i className="fas fa-comments"></i> Messages</h2>
            <div className="conversation-list">
              {conversations.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  <p>No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`conversation-item ${activeConv?.id === conv.id ? 'active' : ''}`}
                    onClick={() => selectConversation(conv)}
                    id={`conv-${conv.id}`}
                  >
                    <div className="avatar avatar-placeholder" style={{ width: 44, height: 44, fontSize: '1rem' }}>
                      {conv.other_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="conv-info">
                      <div className="conv-header-row">
                        <ProfileLink
                          userId={conv.other_id}
                          helperId={conv.other_helper_profile_id}
                          role={conv.other_role}
                          name={conv.other_name}
                          className="conv-name profile-link"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {conv.is_other_active === false && <span className="badge badge-danger">Unavailable</span>}
                        {conv.unread_count > 0 && (
                          <span className="unread-badge">{conv.unread_count}</span>
                        )}
                      </div>
                      <p className="conv-last-message">{conv.last_message?.substring(0, 40) || 'No messages yet'}...</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="chat-main glass-card-static">
            {activeConv ? (
              <>
                <div className="chat-header">
                  <div className="avatar avatar-placeholder" style={{ width: 40, height: 40 }}>
                    {(activeConv.other_name || activeConv.other_user?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <h3>
                    <ProfileLink
                      userId={activeConv.other_id || activeConv.other_user?.id}
                      helperId={activeConv.other_helper_profile_id || activeConv.other_user?.helper_profile_id}
                      role={activeConv.other_role || activeConv.other_user?.role}
                      name={activeConv.other_name || activeConv.other_user?.name}
                    />
                  </h3>
                  {activeConv.is_other_active === false && <span className="badge badge-danger">Unavailable</span>}
                </div>

                <div className="messages-area">
                  {messages.map((msg, i) => (
                    <div
                      key={msg.id || i}
                      className={`message-bubble ${msg.sender_id === user.id ? 'sent' : 'received'}`}
                    >
                      <p className="message-content">{msg.content}</p>
                      <span className="message-time">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {activeConv.is_other_active === false ? (
                  <div className="chat-unavailable">
                    This conversation is unavailable because the other account is banned or inactive.
                  </div>
                ) : (
                  <form className="chat-input-area" onSubmit={sendMessage} id="chat-form">
                    <input
                      type="text"
                      className="form-input chat-input"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      id="chat-message-input"
                    />
                    <button type="submit" className="btn btn-primary" id="chat-send-btn" disabled={!newMessage.trim()}>
                      Send <i className="fas fa-paper-plane"></i>
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="chat-empty">
                <i className="fas fa-comments" style={{ fontSize: '4rem' }}></i>
                <h3>Select a conversation</h3>
                <p>Choose a conversation from the sidebar or start a new one by visiting a helper's profile</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messagesAPI, SOCKET_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import LoadingSpinner from '../components/LoadingSpinner';
import ProfileLink from '../components/ProfileLink';

import { useSync } from '../context/SyncContext';

export default function Chat() {
  const revision = useSync('messages');
  const { user,activeRole } = useAuth();
  const [searchParams,setSearchParams] = useSearchParams();
  const targetUserId = searchParams.get('userId');

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState(''), [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const activeConvRef = useRef(null);
  const scope=useRef(''),intent=useRef(0);
  const currentScope=`${user?.id}:${activeRole}`;
  if(scope.current!==currentScope){scope.current=currentScope;intent.current++;}
  activeConvRef.current = activeConv;

  // Initialize socket
  useEffect(() => {
    let disposed=false;
    const token = localStorage.getItem('token');
    const s = io(SOCKET_URL, { auth: { token,activeRole }, withCredentials: true });
    setSocket(s);
    s.on('connect', () => { if (activeConvRef.current?.id) s.emit('join_conversation', activeConvRef.current.id); });

    s.on('new_message', (msg) => {
      // Only add messages from OTHER users; our own messages are already added via the API response.
      if (msg.sender_id !== user.id && msg.conversation_id === activeConvRef.current?.id) {
        setMessages(prev => prev.some(item=>item.id===msg.id) ? prev : [...prev, msg]);
      }
      messagesAPI.getConversations().then(rows=>{if(!disposed)setConversations(rows);}).catch(err => {if(!disposed)setError(err.message);});
    });

    return () => {disposed=true;s.disconnect();};
  }, [user?.id,activeRole]);

  useEffect(()=>{setActiveConv(null);setConversations([]);setMessages([]);setNewMessage('');setSending(false);setError('');setLoading(true);},[user?.id,activeRole]);
  // Load conversations
  useEffect(() => {
    let disposed=false;
    messagesAPI.getConversations()
      .then(rows=>{if(!disposed)setConversations(rows);})
      .catch(err => {if(!disposed)setError(err.message);})
      .finally(() => {if(!disposed)setLoading(false);});
    return()=>{disposed=true;};
  }, [revision,activeRole]);

  useEffect(() => {
    if (activeConv?.id) loadMessages(activeConv.id);
  }, [revision, activeConv?.id]);

  // Auto-open conversation when navigated with userId
  useEffect(() => {
    if (targetUserId && !loading) {
      const request=++intent.current,requestedScope=scope.current;
      setSearchParams({}, {replace:true});
      messagesAPI.getOrCreateConversation(targetUserId).then((conv) => {
        if(request!==intent.current || requestedScope!==scope.current)return;
        setActiveConv(conv);
        loadMessages(conv.id);
        if (socket) socket.emit('join_conversation', conv.id);
        // Refresh conversations
        messagesAPI.getConversations().then(rows=>{if(requestedScope===scope.current)setConversations(rows);}).catch(err => {if(requestedScope===scope.current)setError(err.message);});
      }).catch(err => {if(requestedScope===scope.current)setError(err.message);});
    }
  }, [targetUserId, loading]);

  const loadMessages = async (convId) => {
    const requestedScope=scope.current;
    try {
      const msgs = await messagesAPI.getMessages(convId);
      if(requestedScope!==scope.current)return;
      if (Number(activeConvRef.current?.id) === Number(convId)) setMessages(msgs);
      setError('');
    } catch (err) { if(requestedScope===scope.current)setError(err.message); }
  };

  const selectConversation = (conv) => {
    setActiveConv(conv);
    loadMessages(conv.id);
    if (socket) socket.emit('join_conversation', conv.id);
  };

  const sendMessage = async (e) => {
    const requestedScope=scope.current;
    e.preventDefault();
    if (sending || !newMessage.trim() || !activeConv || activeConv.is_other_active === false) return;
    setSending(true);
    const conversationId = activeConv.id, content = newMessage;
    try {
      const recipientId = activeConv.other_id || activeConv.other_user?.id;
      const result = await messagesAPI.send({
        recipient_id: recipientId,
        content,
      });
      if(requestedScope!==scope.current)return;

      if (Number(activeConvRef.current?.id) === Number(conversationId)) {
        setMessages(prev => prev.some(item => item.id === result.message.id) ? prev : [...prev, result.message]);
        setNewMessage(previous => previous === content ? '' : previous);
      }
      setError('');
    } catch (err) {
      if(requestedScope===scope.current)setError(err.message);
    }
    finally { if(requestedScope===scope.current)setSending(false); }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page chat-page">
      <div className="container">
        {error && <p role="alert" className="alert alert-error">{error}</p>}
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
                    <button type="submit" className="btn btn-primary" id="chat-send-btn" disabled={sending || !newMessage.trim()}>
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

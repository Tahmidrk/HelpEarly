import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../utils/api';
import { notificationDestination } from '../utils/openNotification';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Notifications() {
  const { user, activeRole, switchMode } = useAuth();
  const revision = useSync('notifications');
  const navigate = useNavigate();
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    notificationsAPI.list().then(rows => { if (!disposed) { setItems(rows); setError(''); } })
      .catch(err => { if (!disposed) setError(err.message); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [user.id, revision, retry]);
  const open = async item => {
    setBusy(item.id);
    try {
      const destination = await notificationDestination(item, user, activeRole);
      await notificationsAPI.read(item.id);
      switchMode(destination.role);
      navigate(destination.path);
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };
  return <div className="page"><div className="container" style={{ maxWidth: 900 }}>
    <div className="page-header"><h1>Notifications</h1><p>Your account updates, shared with Android.</p></div>
    {error && <div className="alert alert-error" role="alert">{error} <button className="btn btn-secondary btn-sm" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
    {loading ? <LoadingSpinner /> : items.length ? <div className="stagger-children">{items.map(item => <article className="glass-card-static parity-card" key={item.id}>
      <div className="parity-row"><h3>{item.title}</h3><span className={`badge ${item.read_at ? 'badge-info' : 'badge-primary'}`}>{item.read_at ? 'Read' : 'Unread'}</span></div>
      <p className="text-secondary">{new Date(item.created_at).toLocaleString()}</p>
      <button className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => open(item)}>{busy === item.id ? 'Opening…' : 'Open update'}</button>
    </article>)}</div> : !error && <div className="empty-state"><h3>No notifications yet</h3><p>Booking, message and other updates will appear here.</p></div>}
  </div></div>;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { emergencyAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import EmergencyModal from '../components/EmergencyModal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Emergency() {
  const { activeRole } = useAuth();
  const revision = useSync('emergency', 'bookings', 'helpers');
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(null), [retry, setRetry] = useState(0), [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    let disposed = false;
    const load = () => emergencyAPI.list().then(rows => { if (!disposed) { setItems(rows); setError(''); } })
      .catch(err => { if (!disposed) setError(err.message); }).finally(() => { if (!disposed) setLoading(false); });
    load(); const timer = setInterval(load, 5000);
    return () => { disposed = true; clearInterval(timer); };
  }, [activeRole, revision, retry]);
  const act = async (item, action) => {
    setBusy(item.id); setActionError('');
    try { await emergencyAPI[action](item.id); }
    catch (err) { setActionError(err.message); }
    finally { setBusy(null); setRetry(value => value + 1); }
  };
  return <div className="page"><div className="container" style={{ maxWidth: 900 }}>
    <div className="page-header"><h1>Emergency requests</h1><p>{activeRole === 'helper' ? 'Incoming requests match your availability and services.' : 'Track your requests and accepted bookings.'}</p>
      {activeRole === 'household' && <button className="btn btn-danger" onClick={() => setCreating(true)}>Request urgent help</button>}
    </div>
    {error && <div className="alert alert-error" role="alert">{error} <button className="btn btn-secondary btn-sm" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
    {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
    {loading ? <LoadingSpinner /> : items.length ? items.map(item => <article key={item.id} className="glass-card-static parity-card">
      <div className="parity-row"><h3>{item.category_name || 'Emergency service'}</h3><span className="badge badge-info">{item.effective_status}</span></div>
      <p>{item.description}</p><p>Requested by: {item.household_name}</p><p>Location: {item.location}</p><p>Contact: {item.contact_phone}</p><p>{activeRole === 'helper' ? item.household_name : item.helper_name || 'Waiting for a worker'}</p>
      {item.booking_id ? <Link className="btn btn-secondary btn-sm" to={activeRole === 'helper' ? '/helper/dashboard' : '/dashboard'}>Booking #{item.booking_id} · {item.booking_status}</Link> : null}
      {activeRole==='helper' && item.effective_status==='pending' && <p>If you want to accept this emergency work, contact the client at the number above. <a className="btn btn-secondary btn-sm" href={'tel:'+item.contact_phone.replace(/[^+\d]/g,'')}>Call client</a></p>}
      {item.effective_status === 'pending' && <div className="parity-row parity-actions">{activeRole === 'helper' ? <>
        <button className="btn btn-success btn-sm" disabled={busy !== null} onClick={() => act(item, 'accept')}>Accept</button>
        <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => act(item, 'decline')}>Decline</button>
      </> : <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => act(item, 'cancel')}>Cancel request</button>}</div>}
    </article>) : !error && <div className="empty-state"><h3>No emergency requests</h3><p>Requests remain stored even after you close the app.</p></div>}
    <EmergencyModal isOpen={creating} onClose={() => { setCreating(false); setRetry(value => value + 1); }} />
  </div></div>;
}

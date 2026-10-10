import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { emergencyAPI, SOCKET_URL } from '../utils/api';

export default function EmergencyNotificationListener() {
  const { user, activeRole } = useAuth();
  const [activeAlert, setActiveAlert] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const acceptAlert = async () => {
    try {
      setAccepting(true);
      setError('');
      await emergencyAPI.accept(activeAlert.id);
      setActiveAlert(null);
      window.alert('Emergency accepted. A confirmed booking is now in your dashboard.');
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => {
    setActiveAlert(null);
    if (!user || activeRole !== 'helper') return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token }, withCredentials: true });

    socket.on('emergency_alert', (data) => {
      setActiveAlert(data);
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    });
    socket.on('notification',item=>{
      if(item.type.startsWith('emergency_') && item.type!=='emergency_new') setActiveAlert(previous=>Number(previous?.id)===Number(item.data.request_id)?null:previous);
    });

    return () => socket.disconnect();
  }, [user,activeRole]);

  if (!activeAlert) return null;

  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 10000 }}>
      <div
        className="modal-content glass-card-static animate-scale-in"
        style={{
          maxWidth: 420,
          width: '90%',
          borderTop: '6px solid var(--danger)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: '2rem', color: 'var(--danger)' }}>
            <i className="fas fa-exclamation-triangle animate-pulse" />
          </span>
          <div>
            <h3 style={{ color: 'var(--danger)', margin: 0 }}>URGENT EMERGENCY ALERT</h3>
            <p className="text-secondary" style={{ margin: 0, fontSize: '0.8rem' }}>
              Household needs immediate worker
            </p>
          </div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 14, borderRadius: 'var(--radius-md)', margin: '14px 0', fontSize: '0.95rem' }}>
          <p style={{ margin: '4px 0' }}><strong>Service:</strong> {activeAlert.category_name}</p>
          <p style={{ margin: '4px 0' }}><strong>Household Name:</strong> {activeAlert.household_name}</p>
          <p style={{ margin: '4px 0' }}><strong>Location:</strong> {activeAlert.location}</p>
          <p style={{ margin: '8px 0 0', color: 'var(--danger)', fontWeight: 'bold', fontSize: '1.05rem' }}>
            <i className="fas fa-phone-alt" /> SIM Phone: {activeAlert.household_phone}
          </p>
        </div>

        <p className="text-secondary" style={{ fontSize: '0.8rem', textAlign: 'center', marginBottom: 16 }}>
          If you are free, call the customer's phone number on your SIM card.
        </p>

        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-danger" style={{ width: '100%', marginBottom: 8 }} onClick={acceptAlert} disabled={accepting}>
          {accepting ? 'Accepting...' : 'Accept Emergency'}
        </button>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setActiveAlert(null)} disabled={accepting}>
          Dismiss Alert
        </button>
      </div>
    </div>
  );
}

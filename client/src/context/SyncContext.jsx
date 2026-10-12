import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { syncAPI, SOCKET_URL } from '../utils/api';
import { createSynchronizer } from '../utils/sync';
const SyncContext = createContext({});
export function SyncProvider({ children }) {
  const { user, activeRole, refreshUser } = useAuth();
  const [revisions, setRevisions] = useState({});
  useEffect(() => {
    setRevisions({});
    if (!user) return;
    const sync = createSynchronizer(syncAPI.revisions, changed => {
      if (changed.includes('profile') || changed.includes('helpers')) refreshUser();
      setRevisions(previous => {
        const next = { ...previous }; for (const key of changed) next[key] = (next[key] || 0) + 1; return next;
      });
    });
    const socket = io(SOCKET_URL, { auth: { token: localStorage.getItem('token'),activeRole }, withCredentials: true, reconnectionAttempts:5, reconnectionDelayMax:10000, timeout:10000 });
    const refresh = () => { if(!socket.connected && !socket.active) socket.connect(); sync.check(); };
    const foreground = () => { if(!socket.connected && !socket.active) socket.connect(); sync.check(true); };
    socket.on('connect', refresh); socket.on('sync_hint', () => sync.check());
    socket.on('notification', () => sync.check()); socket.on('new_message', () => sync.check());
    const visible = () => { if (document.visibilityState === 'visible') foreground(); };
    window.addEventListener('online', foreground); window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') sync.check(); }, 30000);
    refresh();
    return () => { sync.stop(); socket.disconnect(); clearInterval(timer); window.removeEventListener('online', foreground); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', visible); };
  }, [user?.id, activeRole]);
  return <SyncContext.Provider value={revisions}>{children}</SyncContext.Provider>;
}
export function useSync(...resources) {
  const revisions = useContext(SyncContext);
  return resources.map(key => revisions[key] || 0).join(':');
}

import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeRole, setActiveRole] = useState(() => localStorage.getItem('activeRole') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timer,disposed=false;
    const token = localStorage.getItem('token');
    if (token) {
      const restore=()=>authAPI.getMe()
        .then((data) => {
          if(disposed || localStorage.getItem('token')!==token) return;
          setUser(data);
          const savedRole = localStorage.getItem('activeRole');
          if (data.role!=='both' || !['household','helper'].includes(savedRole)) {
            const defaultRole = data.role === 'admin' ? 'admin' : (data.role === 'helper' ? 'helper' : 'household');
            setActiveRole(defaultRole);
            localStorage.setItem('activeRole', defaultRole);
          }
        })
        .catch(error => {
          if(disposed || localStorage.getItem('token')!==token) return;
          if (error.status===401 || error.status===403) {
            localStorage.removeItem('token');
            localStorage.removeItem('activeRole');
          } else if(!disposed && localStorage.getItem('token')===token) timer=setTimeout(restore,5000);
        })
        .finally(() => setLoading(false));
      restore();
    } else {
      setLoading(false);
    }
    return ()=>{disposed=true;clearTimeout(timer);};
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login({ email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const initialRole = data.user.role === 'admin' ? 'admin' : (data.user.role === 'helper' ? 'helper' : 'household');
    setActiveRole(initialRole);
    localStorage.setItem('activeRole', initialRole);
    return data.user;
  };

  const register = async (formData) => {
    const data = await authAPI.register(formData);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const initialRole = data.user.role === 'admin' ? 'admin' : (data.user.role === 'helper' ? 'helper' : 'household');
    setActiveRole(initialRole);
    localStorage.setItem('activeRole', initialRole);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeRole');
    setUser(null);
    setActiveRole(null);
  };

  const switchMode = (newMode) => {
    if(user?.role!=='both' || !['household','helper'].includes(newMode)) return;
    setActiveRole(newMode);
    localStorage.setItem('activeRole', newMode);
  };

  const updateUser = (updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const data = await authAPI.getMe();
      if (localStorage.getItem('token') === token) setUser(previous => previous && Number(previous.id) === Number(data.id) && JSON.stringify(previous) !== JSON.stringify(data) ? data : previous);
    } catch (error) {
      if ([401, 403].includes(error.status) && localStorage.getItem('token') === token) logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, activeRole, loading, login, register, logout, switchMode, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

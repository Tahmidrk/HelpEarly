import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeRole, setActiveRole] = useState(() => localStorage.getItem('activeRole') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe()
        .then((data) => {
          setUser(data);
          const savedRole = localStorage.getItem('activeRole');
          if (data.role!=='both' || !['household','helper'].includes(savedRole)) {
            const defaultRole = data.role === 'admin' ? 'admin' : (data.role === 'helper' ? 'helper' : 'household');
            setActiveRole(defaultRole);
            localStorage.setItem('activeRole', defaultRole);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('activeRole');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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

  return (
    <AuthContext.Provider value={{ user, activeRole, loading, login, register, logout, switchMode, updateUser }}>
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

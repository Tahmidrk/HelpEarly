import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, bookingsAPI, helpersAPI, bookingDate, notificationsAPI } from '../api/client';
import { Alert } from 'react-native';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeRole, setActiveRole] = useState('household');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const me = await authAPI.getMe();
        const savedRole = await AsyncStorage.getItem('activeRole');
        const role = me.role === 'both' && ['household','helper'].includes(savedRole) ? savedRole : (me.role === 'admin' ? 'admin' : me.role === 'helper' ? 'helper' : 'household');
        await AsyncStorage.setItem('activeRole',role);
        setActiveRole(role);
        setUser(me);
      }
    } catch (e) {
      if (e.status === 401 || e.status === 403) await AsyncStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await authAPI.login({ email, password });
    await AsyncStorage.setItem('token', data.token);
    const initialRole = data.user.role === 'admin' ? 'admin' : (data.user.role === 'helper' ? 'helper' : 'household');
    setActiveRole(initialRole);
    await AsyncStorage.setItem('activeRole', initialRole);
    setUser(data.user);
    return data.user;
  };

  const register = async (formData) => {
    const data = await authAPI.register(formData);
    await AsyncStorage.setItem('token', data.token);
    const initialRole = data.user.role === 'admin' ? 'admin' : (data.user.role === 'helper' ? 'helper' : 'household');
    setActiveRole(initialRole);
    await AsyncStorage.setItem('activeRole', initialRole);
    setUser(data.user);
    return data.user;
  };

  const updateUserProfile = async (updatedData) => {
    await authAPI.updateProfile(updatedData);
    const me = await authAPI.getMe();
    setUser(me);
    return me;
  };
  const saveWorkerSettings = async (data) => {
    const me = await helpersAPI.saveSettings(data);
    setUser(me);
    return me;
  };

  const refreshUser = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const me = await authAPI.getMe();
      if (await AsyncStorage.getItem('token') === token) setUser(previous => previous && Number(previous.id) === Number(me.id) && JSON.stringify(previous) !== JSON.stringify(me) ? me : previous);
    } catch (error) {
      if ([401, 403].includes(error.status) && await AsyncStorage.getItem('token') === token) {
        await AsyncStorage.removeItem('token'); setUser(null); setUserBookings([]);
      }
    }
  };

  const logout = async () => {
    try {
      if (await AsyncStorage.getItem('pushEnabled') === 'true') {
        const deviceId = await AsyncStorage.getItem('pushDeviceId');
        if (deviceId) await notificationsAPI.removeDevice(deviceId);
        await AsyncStorage.removeItem('pushEnabled');
      }
    } catch (error) { Alert.alert('Logout needs a connection','Reconnect so this device can stop receiving your account notifications, then retry.'); return; }
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('activeRole');
    setUser(null);
    setUserBookings([]);
  };

  const switchMode = async (mode) => {
    if (user?.role !== 'both' || !['household','helper'].includes(mode)) return;
    setActiveRole(mode);
    await AsyncStorage.setItem('activeRole', mode);
  };

  const [userBookings, setUserBookings] = useState([]);
  const [bookingsError, setBookingsError] = useState('');
  const fetchUserBookings = async () => {
    try {
      const rows = await bookingsAPI.getMyBookings();
      setUserBookings(rows.map(b => ({
        ...b, rawId:b.id, id:`B-${b.id}`, service:b.service_description || b.service_name || 'Custom service',
        category:b.category_name || '', status:b.status.charAt(0).toUpperCase()+b.status.slice(1),
        date:b.booking_date ? new Date(b.booking_date).toLocaleDateString('en-CA') : '',
        time:b.booking_date ? new Date(b.booking_date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '',
        amount:b.total_price, location:b.address,
        photoUri:b.photo_urls?.[0] || null,
      })));
      setBookingsError('');
    } catch (error) { setBookingsError(error.message); }
  };
  useEffect(() => {
    setUserBookings([]);
    if (user) fetchUserBookings();
  }, [user?.id, activeRole]);
  const addBooking = async () => fetchUserBookings();
  const cancelBooking = async (bookingId) => {
    const target = userBookings.find(b => b.id === bookingId);
    await bookingsAPI.updateStatus(target.rawId, 'cancelled');
    await fetchUserBookings();
  };
  const updateBookingSchedule = async (bookingId, date, time) => {
    const target = userBookings.find(b => b.id === bookingId);
    await bookingsAPI.update(target.rawId, {booking_date:bookingDate(date,time)});
    await fetchUserBookings();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        loading,
        userBookings,
        bookingsError,
        saveWorkerSettings,
        refreshUser,
        fetchUserBookings,
        addBooking,
        cancelBooking,
        updateBookingSchedule,
        login,
        register,
        updateUserProfile,
        logout,
        switchMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

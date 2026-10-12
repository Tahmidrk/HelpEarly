import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, bookingsAPI, helpersAPI, bookingDate, notificationsAPI, setApiSession } from '../api/client';
import { Alert } from '../components/Feedback';
import { formatBookings } from '../utils/bookings';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeRole, setActiveRole] = useState('household');
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const scope = useRef('');
  scope.current = `${user?.id || ''}:${activeRole}`;
  const bookingRequest = useRef(0);
  const bookingSnapshot = useRef(null);
  const epoch = useRef(0), credentials = useRef(null);
  const installSession = async (data) => {
    const requested=epoch.current;
    if (data.user.role === 'admin') throw new Error('Administration is available on the website only');
    const role = data.user.role === 'helper' ? 'helper' : 'household';
    credentials.current = data.token;
    setApiSession(data.token, role);
    try {
      await AsyncStorage.multiSet([['token',data.token],['activeRole',role]]);
    } catch(error) {
      if(requested===epoch.current){credentials.current=null;setApiSession(null,'household');}
      await AsyncStorage.removeItem('token');
      throw error;
    }
    if(requested!==epoch.current) {
      if(await AsyncStorage.getItem('token')===data.token)await AsyncStorage.multiRemove(['token','activeRole']);
      throw new Error('Sign-in cancelled');
    }
    setActiveRole(role); setUser(data.user);
    return data.user;
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const requested = epoch.current;
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        credentials.current = token;
        const me = await authAPI.getMe({timeoutMs:60000});
        if (me.role === 'admin') throw Object.assign(new Error('Administration is available on the website only'),{status:403});
        const savedRole = await AsyncStorage.getItem('activeRole');
        const role = me.role === 'both' && ['household','helper'].includes(savedRole) ? savedRole : (me.role === 'admin' ? 'admin' : me.role === 'helper' ? 'helper' : 'household');
        await AsyncStorage.setItem('activeRole',role);
        if (requested !== epoch.current) return;
        setApiSession(token,role);
        setActiveRole(role);
        setUser(me);
      }
    } catch (e) {
      if (requested === epoch.current && ![401,403].includes(e.status) && e.name !== 'AbortError') setRestoreError('Session could not be loaded. Check your connection and sign in to retry.');
      if (requested===epoch.current && (e.status === 401 || e.status === 403)) {
        credentials.current=null;setApiSession(null,'household');await AsyncStorage.removeItem('token');
      }
      if (requested === epoch.current) {credentials.current=null;setApiSession(null,'household');setUser(null);}
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setRestoreError('');
    const requested = ++epoch.current;
    const data = await authAPI.login({ email, password });
    if (requested !== epoch.current) throw new Error('Sign-in cancelled');
    return installSession(data);
  };

  const register = async (formData) => {
    const requested = ++epoch.current;
    const data = await authAPI.register(formData);
    if (requested !== epoch.current) throw new Error('Registration cancelled');
    return installSession(data);
  };

  const updateUserProfile = async (updatedData) => {
    const requested=epoch.current;
    await authAPI.updateProfile(updatedData);
    const me = await authAPI.getMe();
    if(requested===epoch.current)setUser(me);
    return me;
  };
  const saveWorkerSettings = async (data) => {
    const requested=epoch.current;
    const me = await helpersAPI.saveSettings(data);
    if(requested===epoch.current)setUser(me);
    return me;
  };

  const refreshUser = useCallback(async () => {
    const requested=epoch.current;
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const me = await authAPI.getMe();
      if (me.role === 'admin') throw Object.assign(new Error('Administration is available on the website only'),{status:403});
      if (requested===epoch.current && await AsyncStorage.getItem('token') === token) setUser(previous => previous && Number(previous.id) === Number(me.id) && JSON.stringify(previous) !== JSON.stringify(me) ? me : previous);
    } catch (error) {
      if ([401, 403].includes(error.status) && await AsyncStorage.getItem('token') === token) {
        epoch.current++; credentials.current=null; setApiSession(null,'household');
        await AsyncStorage.removeItem('token'); setUser(null); setUserBookings([]);
      }
    }
  },[]);

  const logout = async () => {
    setRestoreError('');
    const token=credentials.current, role=activeRole, account=user?.id;
    epoch.current++;
    const requested=epoch.current;
    bookingRequest.current++;
    bookingSnapshot.current=null;
    credentials.current=null; scope.current='';
    setApiSession(null,'household');
    setUser(null); setUserBookings([]); setBookingsError(''); setActiveRole('household');
    const deviceId=await AsyncStorage.getItem('pushDeviceId');
    // No credentials are persisted for cleanup. Retry only after the same account signs in.
    if(requested===epoch.current) {
      if(deviceId && account) await AsyncStorage.setItem('pendingPushCleanup',JSON.stringify({deviceId,account}));
      await AsyncStorage.multiRemove(['token','activeRole','pushEnabled','pushDeviceId','pendingNotification']);
    }
    if(deviceId && token) notificationsAPI.removeDevice(deviceId,{detached:true,timeoutMs:5000,headers:{Authorization:`Bearer ${token}`,'X-Active-Role':role}})
      .then(async()=>{const pending=await AsyncStorage.getItem('pendingPushCleanup');if(pending===JSON.stringify({deviceId,account}))await AsyncStorage.removeItem('pendingPushCleanup');}).catch(()=>{});
  };

  const switchMode = async (mode) => {
    if (user?.role !== 'both' || !['household','helper'].includes(mode)) return;
    if(mode===activeRole)return;
    epoch.current++;
    bookingRequest.current++;
    bookingSnapshot.current=null;
    try {
      scope.current=`${user.id}:${mode}`;
      setApiSession(credentials.current,mode);
      setUserBookings([]);
      setActiveRole(mode);
      await AsyncStorage.setItem('activeRole',mode);
      // NotificationProvider refreshes the device audience independently of navigation.
    }catch(error){Alert.alert('Role preference not saved',error.message);throw error;}
  };

  const [userBookings, setUserBookings] = useState([]);
  const [bookingsError, setBookingsError] = useState('');
  const fetchUserBookings = useCallback(async () => {
    const requestedScope=scope.current, request=++bookingRequest.current;
    // Worker Dashboard owns its raw booking list; household formatting is unused there.
    if(!credentials.current || !requestedScope.endsWith(':household'))return;
    try {
      const rows = await bookingsAPI.getMyBookings();
      if(requestedScope!==scope.current || request!==bookingRequest.current)return;
      const snapshot=JSON.stringify(rows);
      if(snapshot!==bookingSnapshot.current) {
        bookingSnapshot.current=snapshot;
        setUserBookings(formatBookings(rows));
      }
      setBookingsError('');
    } catch (error) { if(requestedScope===scope.current && request===bookingRequest.current)setBookingsError(error.message); }
  },[]);
  useEffect(() => {
    bookingSnapshot.current=null;
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
        restoreError,
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

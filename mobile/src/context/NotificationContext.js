import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Alert } from '../components/Feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE, notificationsAPI, authAPI, getSessionGeneration } from '../api/client';
import { createSynchronizer } from '../utils/sync';
import { openNotification as routeNotification } from '../utils/openNotification';

const NotificationContext = createContext(null);
let nativeNotifications;
async function getNativeNotifications() {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') throw new Error('Remote push requires a native Android development or production build. Expo Go supports the in-app inbox only.');
  if (!nativeNotifications) nativeNotifications = await import('expo-notifications');
  return nativeNotifications;
}

export function NotificationProvider({ children, navigationRef }) {
  const { user, activeRole, fetchUserBookings, switchMode, refreshUser } = useAuth();
  const seen=useRef(new Set());
  const [revision, setRevision] = useState(0);
  const [resources,setResources]=useState({});
  const invalidate=changed=>{
    setRevision(value=>value+1);
    setResources(previous=>{const next={...previous};changed.forEach(key=>{next[key]=(next[key] || 0)+1;});return next;});
  };
  const [pushStatus, setPushStatus] = useState('Not enabled');
  const [unreadCount,setUnreadCount]=useState(0);
  useEffect(()=>{
    let disposed=false;
    setUnreadCount(0);
    if(user)notificationsAPI.list().then(rows=>{if(!disposed)setUnreadCount(rows.filter(row=>!row.read_at).length);}).catch(()=>{});
    return()=>{disposed=true;};
  },[user?.id,activeRole,resources.notifications]);

  useEffect(()=>{seen.current.clear();},[user?.id,activeRole]);
  const openNotification = useCallback(async (data) => {
    const generation=getSessionGeneration();
    if (!user || !data?.notification_id) return;
    if(!navigationRef.isReady()) {await AsyncStorage.setItem('pendingNotification',JSON.stringify(data));return;}
    try {
      // Fetch from authenticated inbox before routing; never trust push-supplied IDs/roles.
      const mine = await notificationsAPI.list();
      if(generation!==getSessionGeneration())return;
      const item = mine.find(row => Number(row.id) === Number(data.notification_id));
      if (!item) return;
      await notificationsAPI.read(item.id);
      if(generation!==getSessionGeneration())return;
      await routeNotification(navigationRef,item,activeRole,user,switchMode);
    } catch (err) { setPushStatus(err.message); }
  }, [user?.id, activeRole, navigationRef]);
  const navigationReady=async()=>{
    const pending=await AsyncStorage.getItem('pendingNotification');
    if(pending) {await AsyncStorage.removeItem('pendingNotification');try {await openNotification(JSON.parse(pending));}catch {}}
  };

  const registerPush = useCallback(async (askPermission = false) => {
    if (!user) return;
    const generation=getSessionGeneration();
    try {
      const Notifications = await getNativeNotifications();
      if (!Device.isDevice) throw new Error('Push registration needs a physical device. In-app notifications remain available.');
      await Notifications.setNotificationChannelAsync('marketplace', { name: 'Marketplace updates', importance: Notifications.AndroidImportance.HIGH });
      let permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== 'granted' && askPermission) permissions = await Notifications.requestPermissionsAsync();
      if (permissions.status !== 'granted') throw new Error('Notification permission not granted. Enable it in Android Settings.');
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      if (!/^[0-9a-f-]{36}$/i.test(projectId || '')) throw new Error('EAS project ID is missing. Follow docs/DEPLOYMENT.md.');
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      if(generation!==getSessionGeneration())return;
      let deviceId = await AsyncStorage.getItem('pushDeviceId');
      if (!deviceId) {
        deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => { const value = Math.floor(Math.random() * 16); return (char === 'x' ? value : (value & 3) | 8).toString(16); });
        await AsyncStorage.setItem('pushDeviceId', deviceId);
      }
      const pending=await AsyncStorage.getItem('pendingPushCleanup');
      if(pending && Number(JSON.parse(pending).account)===Number(user.id)) {
        await notificationsAPI.removeDevice(JSON.parse(pending).deviceId,{timeoutMs:5000});
        await AsyncStorage.removeItem('pendingPushCleanup');
      }
      if(generation!==getSessionGeneration())return;
      await notificationsAPI.register({ device_id: deviceId, token, platform: Platform.OS });
      if(generation!==getSessionGeneration())return;
      await AsyncStorage.setItem('pushEnabled', 'true');
      setPushStatus('Device registered. System delivery must be checked on this phone.');
    } catch (err) { if(generation!==getSessionGeneration())return;setPushStatus(err.message); if (askPermission) Alert.alert('Push setup', err.message); }
  }, [user?.id,activeRole]);

  const disablePush = async () => {
    try {
      const deviceId = await AsyncStorage.getItem('pushDeviceId');
      if (deviceId) await notificationsAPI.removeDevice(deviceId);
      await AsyncStorage.removeItem('pushEnabled');
      setPushStatus('Disabled');
    } catch (err) { Alert.alert('Unable to disable notifications', err.message); }
  };

  useEffect(() => {
    if (!user) return;
    let disposed = false, socket;
    const sync = createSynchronizer(authAPI.revisions, changed => {
      invalidate(changed);
      if (changed.includes('bookings')) fetchUserBookings();
      if (changed.includes('profile') || changed.includes('helpers')) refreshUser();
    });
    const refresh = () => sync.check();
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 30000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') sync.check(true); });
    refresh();
    AsyncStorage.getItem('token').then(token => {
      if (disposed || !token) return;
      socket = io(API_BASE.replace(/\/api\/?$/, ''), { auth: { token,activeRole }, transports: ['websocket','polling'] });
      socket.on('connect', refresh);
      socket.on('sync_hint', () => sync.check());
      socket.on('new_message', () => sync.check());
      socket.on('notification', item => {
        if(item.data?.audience && item.data.audience!==activeRole) return;
        const duplicate=seen.current.has(item.id);
        seen.current.add(item.id);
        if(seen.current.size>500) seen.current.delete(seen.current.values().next().value);
        sync.check();
        if (!duplicate && item.type === 'emergency_new' && activeRole === 'helper') Alert.alert('Incoming emergency request', 'Open emergency requests to view details.', [{ text: 'Later' }, { text: 'View', onPress: () => navigationRef.isReady() && navigationRef.navigate('Emergency') }]);
      });
    });
    return () => { disposed = true; sync.stop(); clearInterval(timer); foreground.remove(); socket?.disconnect(); };
  }, [user?.id, activeRole]);

  useEffect(() => {
    if (!user) return;
    let disposed = false;
    const subscriptions = [];
    const refresh = async () => {
      if(disposed)return;
      if (await AsyncStorage.getItem('pushEnabled') === 'true') await registerPush();
      else if(await AsyncStorage.getItem('pushPrompted')!=='true') {await AsyncStorage.setItem('pushPrompted','true');await registerPush(true);}
    };
    refresh();
    subscriptions.push(AppState.addEventListener('change', state => { if (state === 'active') refresh(); }));
    getNativeNotifications().then(async Notifications => {
      if (disposed) return;
      Notifications.setNotificationHandler({ handleNotification: async notification => {
        if(disposed || notification.request.content.data?.audience && notification.request.content.data.audience!==activeRole)return {shouldShowBanner:false,shouldShowList:false,shouldPlaySound:false,shouldSetBadge:false};
        const id=notification.request.content.data?.notification_id,duplicate=seen.current.has(id);
        if(id) seen.current.add(id);
        return {shouldShowBanner:!duplicate,shouldShowList:!duplicate,shouldPlaySound:!duplicate,shouldSetBadge:false};
      }});
      subscriptions.push(Notifications.addPushTokenListener(() => registerPush()));
      subscriptions.push(Notifications.addNotificationReceivedListener(() => {if(!disposed)invalidate(['notifications','emergency']);}));
      subscriptions.push(Notifications.addNotificationResponseReceivedListener(response => openNotification(response.notification.request.content.data)));
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!disposed && last) {
        await openNotification(last.notification.request.content.data);
        await Notifications.clearLastNotificationResponseAsync();
      }
    }).catch(() => {});
    return () => { disposed = true; subscriptions.forEach(subscription => subscription.remove()); };
  }, [user?.id, registerPush, openNotification]);

  return <NotificationContext.Provider value={{ revision, resources, unreadCount, pushStatus, navigationReady, enablePush: () => registerPush(true), disablePush }}>{children}</NotificationContext.Provider>;
}
export const useNotifications = resource => {
  const context=useContext(NotificationContext);
  if(!resource)return context;
  return {...context,revision:resource.split(',').map(key=>context?.resources?.[key] || 0).join(':')};
};

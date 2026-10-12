import { Alert } from '../components/Feedback';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI, emergencyAPI } from '../api/client';
import { openNotification } from '../utils/openNotification';

export default function NotificationsScreen({ navigation }) {
  const { revision, pushStatus, enablePush, disablePush } = useNotifications('notifications,emergency');
  const { activeRole, user, switchMode } = useAuth();
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [opening,setOpening]=useState(null),openLock=useRef(false);
  const [emergencies,setEmergencies]=useState([]),scope=useRef(''),request=useRef(0);
  scope.current=`${user?.id}:${activeRole}`;
  useEffect(()=>()=>{request.current++;},[]);
  const load = useCallback(async () => {
    const current=scope.current,id=++request.current;
    try { const [rows,details]=await Promise.all([notificationsAPI.list(),activeRole==='helper'?emergencyAPI.list():Promise.resolve([])]);if(current!==scope.current || id!==request.current)return;setItems(rows);setEmergencies(details);setError(''); }
    catch (err) { if(current===scope.current && id===request.current)setError(err.message); }
    finally { if(current===scope.current && id===request.current)setLoading(false); }
  }, [user?.id,activeRole]);
  useFocusEffect(useCallback(() => { load(); return () => { request.current++; }; }, [load, revision]));
  const open = async item => {
    if(openLock.current)return;
    openLock.current=true;setOpening(item.id);
    try {
      await notificationsAPI.read(item.id);
      await openNotification(navigation,item,activeRole,user,switchMode);
    } catch (err) { Alert.alert('Unable to open update', err.message); }
    finally {openLock.current=false;setOpening(null);}
  };
  return <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16 }}>
    <Text style={{ color: '#475569', marginBottom: 12 }}>{pushStatus}</Text>
    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
      <TouchableOpacity onPress={enablePush}><Text style={{ color: '#0d9488', fontWeight: '800' }}>Enable push</Text></TouchableOpacity>
      <TouchableOpacity onPress={disablePush}><Text style={{ color: '#64748b' }}>Disable push</Text></TouchableOpacity>
    </View>
    {error ? <Text onPress={load} style={{ color: '#b91c1c', paddingBottom: 12 }}>{error} — Tap to retry</Text> : null}
    {loading ? <ActivityIndicator color="#0d9488" /> : <FlatList data={items} keyExtractor={item => String(item.id)} onRefresh={load} refreshing={loading}
      ListEmptyComponent={<Text>No notifications yet.</Text>}
      renderItem={({ item }) => {const emergency=activeRole==='helper' && item.type==='emergency_new' ? emergencies.find(row=>Number(row.id)===Number(item.data?.request_id) && ['pending','accepted'].includes(row.effective_status)):null;return <TouchableOpacity onPress={() => open(item)} disabled={opening!==null} accessibilityState={{busy:opening===item.id}} style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: item.read_at ? '#e2e8f0' : '#0d9488' }}>
        <Text style={{ color: '#0f172a', fontWeight: '800' }}>{emergency ? `Emergency help needed for ${emergency.category_name || 'the requested service'}.` : item.title}</Text>
        {!item.read_at?<Text style={{color:'#0f766e',fontWeight:'700',marginTop:6}}>Unread</Text>:null}
        {opening===item.id?<ActivityIndicator color="#0d9488"/>:null}
        {emergency?<><Text style={{color:'#334155',marginTop:8}}>Requested by: {emergency.household_name}</Text><Text style={{color:'#334155',marginTop:4}}>Location: {emergency.location}</Text><Text style={{color:'#334155',marginTop:4}}>Contact: {emergency.contact_phone}</Text><Text style={{color:'#334155',marginTop:8}}>If you want to accept this emergency work, contact the client at the number above.</Text><TouchableOpacity accessibilityLabel="Call emergency client" style={{paddingVertical:14}} onPress={()=>Linking.openURL('tel:'+emergency.contact_phone.replace(/[^+\d]/g,'')).catch(()=>Alert.alert('Dialer unavailable','Open your phone app and use the contact shown.'))}><Text style={{color:'#0d9488',fontWeight:'800'}}>Call client</Text></TouchableOpacity></>:null}
        <Text style={{ color: '#64748b', marginTop: 6 }}>{new Date(item.created_at).toLocaleString()}</Text>
      </TouchableOpacity>;}} />}
  </View>;
}

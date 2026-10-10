import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI, messagesAPI } from '../api/client';
import { openNotification } from '../utils/openNotification';

export default function NotificationsScreen({ navigation }) {
  const { revision, pushStatus, enablePush, disablePush } = useNotifications();
  const { activeRole, user, switchMode } = useAuth();
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setItems(await notificationsAPI.list()); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { load(); const timer = setInterval(load, 10000); return () => clearInterval(timer); }, [load, revision]));
  const open = async item => {
    try {
      await notificationsAPI.read(item.id);
      await openNotification(navigation,item,activeRole,user,switchMode);
    } catch (err) { Alert.alert('Unable to open update', err.message); }
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
      renderItem={({ item }) => <TouchableOpacity onPress={() => open(item)} style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: item.read_at ? '#e2e8f0' : '#0d9488' }}>
        <Text style={{ color: '#0f172a', fontWeight: '800' }}>{item.title}</Text>
        <Text style={{ color: '#64748b', marginTop: 6 }}>{new Date(item.created_at).toLocaleString()}</Text>
      </TouchableOpacity>} />}
  </View>;
}

import { Alert } from '../components/Feedback';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { emergencyAPI } from '../api/client';
import { useNotifications } from '../context/NotificationContext';

export default function EmergencyScreen({ navigation }) {
  const { activeRole, fetchUserBookings } = useAuth();
  const { revision } = useNotifications();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setRequests(await emergencyAPI.list()); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [activeRole]);
  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]));
  useEffect(() => { load(); }, [load, revision]);
  useEffect(() => { setRequests([]); setLoading(true); }, [activeRole]);

  const act = async (id, action) => {
    setBusy(id);
    try {
      await emergencyAPI[action](id);
      await load();
      if (action === 'accept') {
        await fetchUserBookings();
        Alert.alert('Accepted', 'Confirmed booking created. Manage work from Home.', [
          { text: 'View booking', onPress: () => navigation.navigate('Main', { screen: 'Home',params:{section:'main'} }) },
          { text: 'Stay here' },
        ]);
      }
    } catch (err) { Alert.alert('Request unavailable', err.message); await load(); }
    finally { setBusy(null); }
  };
  return (
    <View style={styles.container}>
      {error ? <TouchableOpacity onPress={load}><Text style={styles.error}>{error} — Tap to retry</Text></TouchableOpacity> : null}
      {loading ? <ActivityIndicator color="#0d9488" size="large" /> : (
        <FlatList data={requests} keyExtractor={item => String(item.id)} refreshing={loading} onRefresh={load}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={<Text style={styles.empty}>No emergency requests. Availability and service category determine incoming requests.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.category_name || 'Emergency service'} · {item.effective_status}</Text>
              <Text style={styles.text}>Requested by: {item.household_name}</Text>
              <Text style={styles.text}>Location: {item.location}</Text>
              <Text style={styles.text}>Contact: {item.contact_phone}</Text>
              <Text style={styles.text}>{item.description}</Text>
              <Text style={styles.text}>{activeRole === 'helper' ? item.household_name : item.helper_name || 'Waiting for a worker'}</Text>
              {item.booking_id ? <Text style={styles.text}>Booking #{item.booking_id} · {item.booking_status}</Text> : null}
              {activeRole==='helper' && item.effective_status==='pending' && <><Text style={styles.text}>If you want to accept this emergency work, contact the client at the number above.</Text><TouchableOpacity accessibilityLabel="Call household" style={styles.secondary} onPress={()=>Linking.openURL('tel:'+item.contact_phone.replace(/[^+\d]/g,'')).catch(()=>Alert.alert('Dialer unavailable','No calling app is available on this device.'))}><Text style={{color:'#0f766e',fontWeight:'700'}}>Call client</Text></TouchableOpacity></>}
              {item.effective_status === 'pending' && (
                <View style={styles.row}>
                  {activeRole === 'helper' ? <>
                    <TouchableOpacity style={styles.button} disabled={busy !== null} onPress={() => act(item.id, 'accept')}><Text style={styles.buttonText}>{busy === item.id ? 'Updating…' : 'Accept'}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.secondary} disabled={busy !== null} onPress={() => act(item.id, 'decline')}><Text>Decline</Text></TouchableOpacity>
                  </> : <TouchableOpacity style={styles.secondary} disabled={busy !== null} onPress={() => act(item.id, 'cancel')}><Text>Cancel request</Text></TouchableOpacity>}
                </View>
              )}
            </View>
          )} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  card: { padding: 16, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#991b1b', marginBottom: 8 },
  text: { color: '#334155', marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap:'wrap', gap: 12, marginTop: 8 },
  button: { backgroundColor: '#0d9488', borderRadius: 8, padding: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12 },
  error: { padding: 16, color: '#b91c1c' },
  empty: { padding: 20, textAlign: 'center', color: '#64748b' },
});

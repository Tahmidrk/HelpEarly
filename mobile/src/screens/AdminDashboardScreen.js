import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';

export default function AdminDashboardScreen() {
  const [tab,setTab]=useState('overview'), [stats,setStats]=useState(null), [users,setUsers]=useState([]), [complaints,setComplaints]=useState([]);
  const [search,setSearch]=useState(''), [notes,setNotes]=useState({}), [loading,setLoading]=useState(true), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);
    try {
      if(tab==='overview') setStats(await apiRequest('/admin/stats'));
      else if(tab==='users') setUsers((await apiRequest(`/admin/users?limit=100&search=${encodeURIComponent(search)}`)).users);
      else setComplaints(await apiRequest('/complaints'));
      setError('');
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  },[tab,search]);
  useFocusEffect(useCallback(()=>{load();},[load]));
  const update=async(path,body)=>{
    if(busy) return;
    setBusy(true);
    try { await apiRequest(path,{method:'PUT',body:JSON.stringify(body)}); await load(); }
    catch(err) { Alert.alert('Update failed',err.message); }
    finally { setBusy(false); }
  };
  const button=(label,onPress)=> <TouchableOpacity disabled={busy} style={styles.button} onPress={onPress}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
  return <View style={styles.page}>
    <View style={styles.header}><Text style={styles.title}>System Moderation</Text></View>
    <View style={styles.tabs}>{['overview','users','complaints'].map(value=><TouchableOpacity key={value} style={styles.tab} onPress={()=>setTab(value)}><Text style={{color:tab===value?'#0d9488':'#64748b',fontWeight:'800'}}>{value.toUpperCase()}</Text></TouchableOpacity>)}</View>
    {error ? <Text style={styles.error} onPress={load}>{error} — Tap to retry</Text> : null}
    {loading ? <ActivityIndicator color="#0d9488" style={{margin:24}}/> : <ScrollView contentContainerStyle={{padding:16}} keyboardShouldPersistTaps="handled">
      {tab==='overview' && stats && <View style={styles.card}>
        {[
          ['Registered accounts',stats.userBreakdown?.total], ['Active accounts',stats.userBreakdown?.active],
          ['Worker profiles',stats.helpers],['Banned accounts',stats.userBreakdown?.banned],
          ['Total bookings',stats.bookings?.total],['Completed bookings',stats.bookings?.completed],
          ['Completed job value (recorded)',`৳${stats.revenue ?? 0}`],['Open jobs',stats.jobs?.open],
        ].map(([label,value])=><Text key={label} style={styles.line}>{label}: {value ?? 0}</Text>)}
      </View>}
      {tab==='users' && <>
        <TextInput style={styles.input} placeholder="Search accounts" value={search} onChangeText={setSearch}/>
        {!users.length && <Text>No accounts match.</Text>}
        {users.map(item=><View key={item.id} style={styles.card}>
          <Text style={styles.name}>{item.name} · {item.role}</Text><Text>{item.email}</Text>
          <Text style={styles.line}>NID: {item.nid_number || 'Not supplied'}</Text><Text>{item.is_active?'Active':'Banned'}</Text>
          {item.helper_profile_id ? button(item.is_verified?'Unverify worker':'Verify worker',()=>update(`/admin/helpers/${item.helper_profile_id}/verify`,{is_verified:!item.is_verified})) : null}
          {item.role!=='admin' && button(item.is_active?'Ban account':'Restore account',()=>Alert.alert('Confirm account change',`Change access for ${item.name}?`,[{text:'Cancel'},{text:'Confirm',onPress:()=>update(`/admin/users/${item.id}`,{is_active:!item.is_active})}]))}
        </View>)}
      </>}
      {tab==='complaints' && <>
        {!complaints.length && <Text>No complaints.</Text>}
        {complaints.map(item=><View key={item.id} style={styles.card}>
          <Text style={styles.name}>{item.subject} · {item.status}</Text>
          <Text style={styles.line}>{item.complainant_name} → {item.accused_name}</Text><Text>{item.description}</Text>
          <TextInput multiline style={styles.input} placeholder="Investigation notes" value={notes[item.id] ?? item.admin_notes ?? ''} onChangeText={value=>setNotes(prev=>({...prev,[item.id]:value}))}/>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{['reviewing','resolved','dismissed'].map(status=><View key={status}>{button(status,()=>update(`/complaints/${item.id}`,{status,admin_notes:notes[item.id] ?? item.admin_notes ?? ''}))}</View>)}</View>
        </View>)}
      </>}
    </ScrollView>}
  </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f8fafc'},header:{backgroundColor:'#1e293b',padding:20},title:{fontSize:20,fontWeight:'800',color:'#fff'},tabs:{flexDirection:'row',backgroundColor:'#fff'},tab:{flex:1,paddingVertical:16,alignItems:'center'},card:{backgroundColor:'#fff',padding:16,borderRadius:14,marginBottom:12,borderWidth:1,borderColor:'#e2e8f0'},name:{fontWeight:'800',fontSize:16,color:'#0f172a'},line:{marginVertical:6,color:'#475569'},input:{borderWidth:1,borderColor:'#e2e8f0',borderRadius:10,padding:12,marginVertical:12,color:'#0f172a'},button:{backgroundColor:'#0d9488',borderRadius:8,padding:10,marginTop:8},buttonText:{color:'#fff',fontWeight:'700'},error:{color:'#b91c1c',padding:16}});

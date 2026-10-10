import React,{useState,useCallback} from 'react';
import {View,Text,FlatList,ActivityIndicator} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {complaintsAPI} from '../api/client';
import {useNotifications} from '../context/NotificationContext';
export default function ComplaintsScreen(){
  const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const {revision}=useNotifications();
  const load=useCallback(async()=>{try{setItems(await complaintsAPI.getMine());setError('');}catch(err){setError(err.message);}finally{setLoading(false);}},[]);
  useFocusEffect(useCallback(()=>{load();},[load,revision]));
  return <View style={{flex:1,padding:16,backgroundColor:'#f8fafc'}}>
    {error?<Text style={{color:'#b91c1c'}} onPress={load}>{error} — Tap to retry</Text>:null}
    {loading?<ActivityIndicator color="#0d9488"/>:<FlatList data={items} keyExtractor={item=>String(item.id)} ListEmptyComponent={<Text>No complaints filed.</Text>} renderItem={({item})=><View style={{padding:16,backgroundColor:'#fff',borderRadius:12,marginBottom:12}}><Text style={{fontWeight:'800',color:'#0f172a'}}>{item.subject} · {item.status}</Text><Text style={{marginVertical:8}}>{item.description}</Text><Text style={{color:'#64748b'}}>Regarding {item.accused_name}</Text>{item.admin_notes?<Text style={{marginTop:8}}>Admin: {item.admin_notes}</Text>:null}</View>}/>}
  </View>;
}

import React,{useState,useRef,useEffect} from 'react';
import {View,Text,TextInput,TouchableOpacity,ActivityIndicator,Linking} from 'react-native';
import * as Location from 'expo-location';
export default function ServiceLocationInput({value,onChangeText,onSelection,style}) {
  const [candidates,setCandidates]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
  const request=useRef(0),address=useRef(value);address.current=value;
  useEffect(()=>()=>{request.current++;},[]);
  const search=async()=>{
    const current=++request.current,searched=value;
    setBusy(true);setError('');setCandidates([]);
    try {
      if(value.trim().length<5)throw new Error('Enter road, area and city before finding location.');
      const permission=await Location.requestForegroundPermissionsAsync();
      if(!permission.granted)throw new Error('Location permission denied. Address can be saved; map position remains unconfirmed.');
      const results=await Location.geocodeAsync(value.trim());
      if(current!==request.current || searched!==address.current)return;
      if(!results.length)throw new Error('Address could not be mapped. Correct area/city and try again.');
      setCandidates(results.slice(0,5));
    }catch(e){if(current===request.current)setError(e.message);}finally{if(current===request.current)setBusy(false);}
  };
  return <View><TextInput value={value} onChangeText={text=>{onChangeText(text);onSelection?.(null);setConfirmed(false);setCandidates([]);}} placeholder="Road, service area, city" style={style}/><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={search} style={{paddingVertical:12,minHeight:48}}>{busy?<ActivityIndicator color="#0d9488"/>:<Text style={{color:'#0d9488',fontWeight:'700'}}>Find and confirm service area</Text>}</TouchableOpacity>{error?<Text accessibilityRole="alert" style={{color:'#b91c1c'}}>{error}</Text>:null}{candidates.map((c,i)=><View key={i} style={{padding:12,borderWidth:1,borderColor:'#cbd5e1',borderRadius:10,marginBottom:8}}><Text>Result {i+1}: {c.latitude.toFixed(2)}, {c.longitude.toFixed(2)}</Text><TouchableOpacity style={{paddingVertical:12}} onPress={()=>Linking.openURL(`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=14/${c.latitude}/${c.longitude}`).catch(()=>setError('Maps unavailable.'))}><Text style={{color:'#0d9488'}}>Review on map</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={{minHeight:48,justifyContent:'center'}} onPress={()=>{onSelection?.({latitude:c.latitude,longitude:c.longitude,location_confirmed:true});setConfirmed(true);setCandidates([]);}}><Text style={{color:'#0f766e',fontWeight:'800'}}>Confirm this service area</Text></TouchableOpacity></View>)}<Text style={{color:'#64748b',fontSize:12}}>{confirmed?'Mapped area confirmed. Save profile to apply.':'Map position unconfirmed until you review and select a result. Public maps show approximate service area.'}</Text></View>;
}

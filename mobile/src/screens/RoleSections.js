import React, { useEffect,useState } from 'react';
import { View,Text,TouchableOpacity } from 'react-native';
import JobsScreen from './JobsScreen';
import WorkerDashboardScreen from './WorkerDashboardScreen';
import ComplaintsScreen from './ComplaintsScreen';
import EmergencyScreen from './EmergencyScreen';

function Sections({navigation,route,worker}) {
  const [section,setSection]=useState('main');
  useEffect(()=>{if(route?.params?.section){setSection(route.params.section);navigation.setParams({section:null});}},[route?.params?.section]);
  const tabs=worker?[['main','Dashboard'],['complaints','Complaints'],['broadcasts','Broadcasts']]:[['main','My Posts'],['complaints','Complaints'],['broadcasts','Broadcasts']];
  const Screen=section==='complaints'?ComplaintsScreen:section==='broadcasts'?EmergencyScreen:worker?WorkerDashboardScreen:JobsScreen;
  return <View style={{flex:1,backgroundColor:'#f8fafc'}}><View style={{flexDirection:'row',backgroundColor:'#fff',borderBottomWidth:1,borderColor:'#e2e8f0'}}>{tabs.map(([key,label])=><TouchableOpacity accessibilityRole="tab" accessibilityState={{selected:section===key}} key={key} onPress={()=>setSection(key)} style={{flex:1,minHeight:48,padding:12,alignItems:'center',justifyContent:'center',borderBottomWidth:section===key?2:0,borderBottomColor:'#0d9488'}}><Text style={{fontSize:12,fontWeight:'700',color:section===key?'#0d9488':'#64748b'}}>{label}</Text></TouchableOpacity>)}</View><Screen navigation={navigation} route={route}/></View>;
}
export const HouseholdPostsScreen=props=><Sections {...props} worker={false}/>;
export const WorkerHomeScreen=props=><Sections {...props} worker/>;

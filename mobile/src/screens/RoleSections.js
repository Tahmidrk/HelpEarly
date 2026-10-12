import React, { useEffect,useState } from 'react';
import { View,Text,TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import JobsScreen from './JobsScreen';
import WorkerDashboardScreen, { WorkerHomeHeader } from './WorkerDashboardScreen';
import ComplaintsScreen from './ComplaintsScreen';
import EmergencyScreen from './EmergencyScreen';

function Sections({navigation,route,worker}) {
  const [section,setSection]=useState('main');
  useEffect(()=>{if(route?.params?.section){setSection(route.params.section);navigation.setParams({section:null});}},[route?.params?.section]);
  const tabs=worker?[['main','Dashboard'],['complaints','Complaints'],['broadcasts','Broadcasts']]:[['main','My Posts'],['complaints','Complaints'],['broadcasts','Broadcasts']];
  const Screen=section==='complaints'?ComplaintsScreen:section==='broadcasts'?EmergencyScreen:worker?WorkerDashboardScreen:JobsScreen;
  const Container=worker?SafeAreaView:View;
  return <Container edges={worker?['top']:undefined} style={{flex:1,backgroundColor:'#f8fafc'}}>{worker && <WorkerHomeHeader navigation={navigation}/>}<View style={{flexDirection:'row',backgroundColor:'#ffffff',padding:6,borderBottomWidth:1,borderBottomColor:'#e2e8f0',gap:8}}>{tabs.map(([key,label])=><TouchableOpacity accessibilityRole="tab" accessibilityState={{selected:section===key}} key={key} onPress={()=>setSection(key)} activeOpacity={0.85} style={[{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:10,borderRadius:12,backgroundColor:'#f1f5f9'},section===key&&{backgroundColor:'#f0fdfa',borderWidth:1,borderColor:'#ccfbf1'}]}><Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[{fontSize:13,fontWeight:'600',color:'#64748b'},section===key&&{color:'#0d9488',fontWeight:'800'}]}>{label}</Text></TouchableOpacity>)}</View><Screen navigation={navigation} route={route} embeddedSections={worker} historyOnly={worker&&section==='complaints'}/></Container>;
}
export const HouseholdPostsScreen=props=><Sections {...props} worker={false}/>;
export const WorkerHomeScreen=props=><Sections {...props} worker/>;

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormModal } from './FormLayout';

let display;
export const Alert={alert:(title,message,buttons,options)=>display?.({title,message,buttons,options,key:Date.now()})};
export function FeedbackProvider({children}) {
  const [item,setItem]=useState(null),insets=useSafeAreaInsets();
  useEffect(()=>{display=setItem;return()=>{display=null;};},[]);
  const confirm=item?.buttons?.length>1;
  useEffect(()=>{if(!item||confirm)return;const timer=setTimeout(()=>setItem(null),6000);return()=>clearTimeout(timer);},[item,confirm]);
  const kind=/fail|error|unavailable|not sent|could not/i.test(item?.title||'')?'error':/required|missing|permission|validation/i.test(item?.title||'')?'warning':/success|saved|complete|sent|accepted|published/i.test(item?.title||'')?'success':'information';
  const color={error:'#b91c1c',warning:'#92400e',success:'#0f766e',information:'#0d9488'}[kind];
  const close=()=>{setItem(null);item?.options?.onDismiss?.();};
  const content=item&&<View style={[styles.card,{borderColor:color}]} accessibilityLiveRegion="polite" accessibilityRole="alert">
    <View style={styles.row}><Ionicons name={{error:'alert-circle',warning:'warning',success:'checkmark-circle',information:'information-circle'}[kind]} size={24} color={color}/><Text style={[styles.title,{color}]}>{item.title}</Text><TouchableOpacity accessibilityLabel="Dismiss message" onPress={close}><Ionicons name="close" size={24} color="#64748b"/></TouchableOpacity></View>
    <Text style={styles.message}>{item.message}</Text>
    {item.buttons?.map((b,i)=><TouchableOpacity key={i} accessibilityRole="button" style={styles.button} onPress={()=>{setItem(null);b.onPress?.();}}><Text style={{color:b.style==='destructive'?'#b91c1c':'#0f766e',fontWeight:'700'}}>{b.text||'OK'}</Text></TouchableOpacity>)}
  </View>;
  return <>{children}{confirm?<FormModal visible transparent animationType="fade" onRequestClose={close}><View style={styles.overlay}>{content}</View></FormModal>:item?<View pointerEvents="box-none" style={[styles.toast,{bottom:insets.bottom+12}]}>{content}</View>:null}</>;
}
const styles=StyleSheet.create({toast:{position:'absolute',left:16,right:16},overlay:{flex:1,justifyContent:'center',padding:20,backgroundColor:'rgba(15,23,42,0.5)'},card:{backgroundColor:'#fff',padding:18,borderRadius:16,borderWidth:1,elevation:8},row:{flexDirection:'row',alignItems:'center',gap:10},title:{flex:1,fontSize:16,fontWeight:'800'},message:{marginTop:10,color:'#334155',fontSize:14,lineHeight:21},button:{paddingVertical:14,alignItems:'center',minHeight:48}});

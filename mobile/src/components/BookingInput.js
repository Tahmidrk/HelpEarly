import {FormTextInput as TextInput} from './FormLayout';
import React,{useState} from 'react';
import {View,Text} from 'react-native';
export default function BookingInput({style,error,...props}) {
  const [focused,setFocused]=useState(false);
  return <View><TextInput {...props} style={[{borderWidth:1,borderColor:'#cbd5e1',borderRadius:12,backgroundColor:'#fff',color:'#0f172a',padding:12,minHeight:48},style,{borderColor:error?'#b91c1c':focused?'#0d9488':'#cbd5e1'}]} onFocus={e=>{setFocused(true);props.onFocus?.(e);}} onBlur={e=>{setFocused(false);props.onBlur?.(e);}} placeholderTextColor="#64748b"/>{error?<Text accessibilityRole="alert" style={{color:'#b91c1c'}}>{error}</Text>:null}</View>;
}

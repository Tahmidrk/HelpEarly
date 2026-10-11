import {FormTextInput as TextInput} from './FormLayout';
import React,{useState} from 'react';
import {View,TouchableOpacity,Text,Platform} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Ionicons} from '@expo/vector-icons';
import {parseDate,dateText} from '../utils/dateOnly';
export default function DateInput({value,onChangeText,style}) {
  const [open,setOpen]=useState(false),[error,setError]=useState('');
  let selected;try{selected=parseDate(value);}catch{selected=new Date();}
  const validate=()=>{try{parseDate(value);setError('');}catch(e){setError(e.message);}};
  return <View><View style={{flexDirection:'row',alignItems:'center',gap:8}}><TextInput accessibilityLabel="Preferred date YYYY-MM-DD" value={value} onChangeText={text=>{onChangeText(text);setError('');}} onBlur={validate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" style={[style,{flex:1,borderColor:error?'#b91c1c':'#cbd5e1'}]}/><TouchableOpacity accessibilityLabel="Choose date from calendar" style={{padding:12,minHeight:48}} onPress={()=>setOpen(true)}><Ionicons name="calendar-outline" size={24} color="#0d9488"/></TouchableOpacity></View>{error?<Text accessibilityRole="alert" style={{color:'#b91c1c'}}>{error}</Text>:null}{open&&Platform.OS!=='web'?<DateTimePicker value={selected} minimumDate={new Date(new Date().setHours(0,0,0,0))} mode="date" onChange={(event,date)=>{setOpen(false);if(event.type!=='dismissed'&&date){onChangeText(dateText(date));setError('');}}}/>:null}{open&&Platform.OS==='web'?<Text>Type date as YYYY-MM-DD.</Text>:null}</View>;
}

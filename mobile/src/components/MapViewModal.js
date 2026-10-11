import React,{useState,useEffect} from 'react';
import {View,Text,TouchableOpacity,Linking,Platform,StyleSheet,Dimensions} from 'react-native';
import {WebView} from 'react-native-webview';
import {Ionicons} from '@expo/vector-icons';
import {FormModal as Modal} from './FormLayout';
import {Alert} from './Feedback';
const {width}=Dimensions.get('window');
export default function MapViewModal({visible,onClose,locationName='',coordinates}) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[visible,locationName,coordinates?.latitude,coordinates?.longitude]);
 const valid=coordinates?.location_confirmed && coordinates.latitude!=null && coordinates.longitude!=null && Number.isFinite(Number(coordinates.latitude)) && Number.isFinite(Number(coordinates.longitude));
 const lat=valid?Number(Number(coordinates.latitude).toFixed(2)):null,lng=valid?Number(Number(coordinates.longitude).toFixed(2)):null;
 const query=valid?lat+','+lng:locationName;
 const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
 const open=()=>{if(!query.trim())return Alert.alert('Location unavailable','Ask the worker to confirm their service area.');Linking.openURL(Platform.OS==='android'?'geo:0,0?q='+encodeURIComponent(query):url).catch(()=>Linking.openURL(url).catch(()=>Alert.alert('Maps unavailable','No maps app or browser could be opened.')));};
 const map=valid?'https://www.openstreetmap.org/export/embed.html?bbox='+[lng-.02,lat-.02,lng+.02,lat+.02].join(',')+'&layer=mapnik&marker='+lat+','+lng:null;
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.overlay}><View style={styles.modalCard}><View style={styles.header}><View style={styles.titleRow}><Ionicons name="map" size={20} color="#0d9488"/><Text style={styles.titleText}>Service Area Map</Text></View><TouchableOpacity accessibilityLabel="Close map" onPress={onClose} style={styles.closeBtn}><Ionicons name="close" size={24} color="#64748b"/></TouchableOpacity></View><View style={styles.locationBar}><Text style={styles.locationText}>{locationName || 'Location not supplied'}</Text></View>{valid&&!failed?<View style={styles.mapContainer}>{Platform.OS==='web'?<iframe title="Confirmed service area" src={map} style={{width:'100%',height:'100%',border:0}}/>:<WebView source={{uri:map}} originWhitelist={['https://www.openstreetmap.org']} javaScriptEnabled onError={()=>setFailed(true)} onHttpError={()=>setFailed(true)} onShouldStartLoadWithRequest={request=>request.url.startsWith('https://www.openstreetmap.org/')}/>}</View>:<View style={[styles.mapContainer,{justifyContent:'center',padding:20}]}><Text style={{color:'#475569',textAlign:'center'}}>{failed?'Map preview unavailable. Open Maps below.':'Unverified address. Ask worker to correct and confirm service area. Address search below does not imply a verified map pin.'}</Text></View>}<Text style={{color:'#64748b',fontSize:12,marginTop:10}}>{valid?'Confirmed approximate service area; precise home coordinates are not shown. © OpenStreetMap contributors':'Service area has not been confirmed.'}</Text><TouchableOpacity style={styles.openAppBtn} onPress={open}><Ionicons name="compass" size={18} color="#fff"/><Text style={styles.openAppBtnText}>{valid?'Open Full Map App':'Search Address in Maps'}</Text></TouchableOpacity></View></View></Modal>;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: width - 32,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  closeBtn: { padding: 4 },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  locationText: { fontSize: 13, fontWeight: '600', color: '#0f766e', flex: 1 },
  mapContainer: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e2e8f0',
  },
  mapImage: { width: '100%', height: '100%' },
  pinOverlay: {
    position: 'absolute',
    top: '38%',
    left: '35%',
    alignItems: 'center',
  },
  pinBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0d9488',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pinText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  tapHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tapHintText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  openAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0d9488',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  openAppBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
});

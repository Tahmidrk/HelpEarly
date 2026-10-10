import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Location coordinate map for popular locations in Dhaka / Bangladesh
const LOCATION_COORDS = {
  'dhaka': { lat: 23.8103, lng: 90.4125 },
  'dhanmondi': { lat: 23.7461, lng: 90.3742 },
  'gulshan': { lat: 23.7925, lng: 90.4078 },
  'banani': { lat: 23.7937, lng: 90.4066 },
  'uttara': { lat: 23.8759, lng: 90.3795 },
  'mirpur': { lat: 23.8069, lng: 90.3687 },
  'mohammadpur': { lat: 23.7658, lng: 90.3580 },
  'badda': { lat: 23.7806, lng: 90.4267 },
  'motijheel': { lat: 23.7330, lng: 90.4170 },
  'chittagong': { lat: 22.3569, lng: 91.7832 },
  'sylhet': { lat: 24.8949, lng: 91.8687 },
};

export default function MapViewModal({ visible, onClose, locationName = 'Dhaka, Bangladesh' }) {
  // Resolve lat/lng from location string
  const cleanLoc = (locationName || '').toLowerCase().trim();
  let coords = { lat: 23.8103, lng: 90.4125 }; // Default Dhaka Central

  for (const [key, val] of Object.entries(LOCATION_COORDS)) {
    if (cleanLoc.includes(key)) {
      coords = val;
      break;
    }
  }

  const { lat, lng } = coords;

  const openExternalMap = () => {
    const labelStr = encodeURIComponent(locationName);
    const mapsAppUrl = Platform.select({
      ios: `maps:0,0?q=${labelStr}`,
      android: `geo:0,0?q=${labelStr}`,
    });
    const webUrl = `https://www.google.com/maps?q=${labelStr}`;

    Linking.openURL(mapsAppUrl || webUrl).catch(() => {
      Linking.openURL(webUrl);
    });
  };

  // Dynamic OpenStreetMap static tile url centered on coordinates with red pin
  const osmStaticUrl = `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&z=14&l=map&size=600,450&pt=${lng},${lat},pm2rdm`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="map" size={20} color="#0d9488" />
              <Text style={styles.titleText}>Location Map</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Location Bar */}
          <View style={styles.locationBar}>
            <Ionicons name="location" size={16} color="#0d9488" />
            <Text style={styles.locationText} numberOfLines={1}>
              {locationName}
            </Text>
          </View>

          {/* Map Preview Container */}
          <TouchableOpacity style={styles.mapContainer} activeOpacity={0.9} onPress={openExternalMap}>
            <Image
              source={{ uri: osmStaticUrl }}
              style={styles.mapImage}
              resizeMode="cover"
            />

            {/* Custom Map Pin Overlay */}
            <View style={styles.pinOverlay}>
              <View style={styles.pinBubble}>
                <Ionicons name="navigate" size={14} color="#ffffff" />
                <Text style={styles.pinText}>Approximate Area</Text>
              </View>
              <Ionicons name="location-sharp" size={32} color="#dc2626" style={{ marginTop: -4 }} />
            </View>

            {/* Tap hint overlay */}
            <View style={styles.tapHint}>
              <Ionicons name="open-outline" size={14} color="#ffffff" />
              <Text style={styles.tapHintText}>Tap to open in Phone Maps App</Text>
            </View>
          </TouchableOpacity>

          {/* Action Button */}
          <TouchableOpacity style={styles.openAppBtn} onPress={openExternalMap}>
            <Ionicons name="compass" size={18} color="#ffffff" />
            <Text style={styles.openAppBtnText}>Open Full Map App</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
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

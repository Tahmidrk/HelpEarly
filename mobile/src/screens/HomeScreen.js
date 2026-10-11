import { FormScrollView as ScrollView } from '../components/FormLayout';
import { FormModal as Modal } from '../components/FormLayout';
import { Alert } from '../components/Feedback';
import useMarketplaceCategories from '../utils/useMarketplaceCategories';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { emergencyAPI, helpersAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MapViewModal from '../components/MapViewModal';
import { useNotifications } from '../context/NotificationContext';

export default function HomeScreen({ navigation }) {
  const { revision } = useNotifications();
  const { user, activeRole, switchMode } = useAuth();
  const [helpers, setHelpers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Emergency Modal States
  const [emergencyModal, setEmergencyModal] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState('Cleaning');
  const [emergencyLocation, setEmergencyLocation] = useState(user?.location || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.phone || '');
  const [sendingEmergency, setSendingEmergency] = useState(false);

  // Map Modal State
  const [mapModal, setMapModal] = useState(false);
  const [mapCoordinates,setMapCoordinates]=useState(null);
  const [mapLocation, setMapLocation] = useState('Dhaka, Bangladesh');

  const openMap = (loc,coordinates) => {
    setMapCoordinates(coordinates || null);
    setMapLocation(loc || 'Dhaka, Bangladesh');
    setMapModal(true);
  };

  const categoryNames = useMarketplaceCategories();
  const categoryIcons = {Cleaning:'broom',Plumbing:'pipe',Electrical:'flash',Gardening:'flower',Babysitting:'baby-carriage',Moving:'truck-delivery',Cooking:'silverware-fork-knife'};
  const categories = [{name:'All',icon:'apps'}, ...categoryNames.map(name=>({name,icon:categoryIcons[name]||'apps'}))];

  useEffect(() => {
    fetchTopHelpers();
  }, [revision]);

  const fetchTopHelpers = async () => {
    try {
      const data = await helpersAPI.getAll({ limit: 50 });
      const list = Array.isArray(data) ? data : (data?.helpers || []);
      setHelpers(list);
    } catch (e) {
      console.log(e);
      setHelpers([]);
    } finally {
      setLoading(false);
    }
  };

  const ALLOWED_CATS = categoryNames.map(name=>name.toLowerCase());

  const filteredHelpers = helpers.filter((h) => {
    if (Number(h.user_id) === Number(user?.id)) return false;
    // Collect all valid categories associated with this helper
    const primaryCat = h.primary_category || h.category || (h.services && h.services[0]?.category_name) || '';
    const serviceCats = (h.services || []).map((s) => s.category_name);
    const allHelperCats = [primaryCat, ...serviceCats]
      .filter(Boolean)
      .map((c) => c.toLowerCase());

    // Filter by top Category Pill selection ('Cleaning', 'Plumbing', etc.)
    let matchesCat = true;
    if (selectedCategory !== 'All') {
      const targetCat = selectedCategory.toLowerCase();
      // Match either primary category or any offered service category
      matchesCat = allHelperCats.includes(targetCat);
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCat;

    const serviceNames = (h.services || []).map((s) => s.service_name?.toLowerCase() || '');
    const matchesQuery =
      h.name?.toLowerCase().includes(q) ||
      h.location?.toLowerCase().includes(q) ||
      h.bio?.toLowerCase().includes(q) ||
      allHelperCats.some((c) => c.includes(q)) ||
      serviceNames.some((s) => s.includes(q));

    return matchesCat && matchesQuery;
  });

  const submitEmergency = async () => {
    if (!emergencyLocation.trim() || !emergencyContact.trim()) {
      Alert.alert('Missing details', 'Enter your location and contact number.');
      return;
    }
    try {
      setSendingEmergency(true);
      const result = await emergencyAPI.broadcast({
        category_name: selectedServiceType,
        location: emergencyLocation.trim(),
        contact_phone: emergencyContact.trim(),
      });
      setEmergencyModal(false);
      Alert.alert('Emergency request sent', `${result.helpersNotified} available ${selectedServiceType} worker(s) were notified.`);
    } catch (error) {
      Alert.alert('Emergency request failed', error.message);
    } finally {
      setSendingEmergency(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Top Header Banner without text - thin header fitting status bar */}
      <View style={styles.topHeaderBanner} />

      {/* Top User Greeting Bar */}
      <View style={styles.userGreetingHeader}>
        <TouchableOpacity
          style={styles.userInfoTouchable}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          <View style={styles.userAvatarCircle}>
            <Text style={styles.userAvatarText}>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</Text>
          </View>
          <Text style={styles.userNameText}>{user?.name || 'Valued User'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Role Toggle Switcher */}
        {user?.role === 'both' && (
          <View style={styles.toggleCard}>
            <View style={styles.modeWrapper}>
              <TouchableOpacity
                style={[styles.modeBtn, activeRole === 'household' && styles.modeBtnActive]}
                onPress={() => switchMode('household')}
                activeOpacity={0.8}
              >
                <Ionicons name="home" size={15} color={activeRole === 'household' ? '#0d9488' : '#64748b'} />
                <Text style={[styles.modeText, activeRole === 'household' && styles.modeTextActive]}>Household Mode</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, activeRole === 'helper' && styles.modeBtnActive]}
                onPress={() => switchMode('helper')}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="tools" size={13} color={activeRole === 'helper' ? '#0d9488' : '#64748b'} />
                <Text style={[styles.modeText, activeRole === 'helper' && styles.modeTextActive]}>Worker Mode</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Emergency Alert Action Card */}
        {activeRole === 'household' && <TouchableOpacity
          style={styles.emergencyBtn}
          onPress={() => setEmergencyModal(true)}
          activeOpacity={0.9}
        >
          <View style={styles.emergencyIconBg}>
            <Ionicons name="warning" size={20} color="#dc2626" />
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.emergencyBtnText}>Emergency Help Request</Text>
            <View style={styles.livePulseDot} />
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>}

        {/* Post Job Offers Action Card */}
        <TouchableOpacity
          style={styles.postJobBtn}
          onPress={() => navigation.navigate('Jobs')}
          activeOpacity={0.88}
        >
          <View style={styles.postJobIconBg}>
            <Ionicons name="add-circle" size={20} color="#0d9488" />
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.postJobBtnText}>Post Job Offer</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Search Bar (Matching emergency card styling & height) */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#0d9488" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, category, location..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Top Helpers List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Helpers</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Explore', {
                selectedCategory: 'All',
                highlightHelperId: null,
              })
            }
          >
            <Text style={styles.seeAllText}>See All ({helpers.length})</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#0d9488" size="large" style={{ marginVertical: 20 }} />
        ) : filteredHelpers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={36} color="#94a3b8" />
            <Text style={styles.emptyText}>No helpers found for this search</Text>
          </View>
        ) : (
          filteredHelpers.map((h) => {
            const helperCat = h.primary_category || h.category || h.services?.[0]?.category_name || 'Category not set';
            const prices = (h.services || []).map((s) => Number(s.price)).filter((p) => !isNaN(p) && p > 0);
            const minPrice = prices.length ? Math.min(...prices) : Number(h.hourly_rate || 0);
            const maxPrice = prices.length ? Math.max(...prices) : minPrice;
            const priceRangeDisplay = minPrice>0 ? (minPrice === maxPrice ? `৳${minPrice}` : `৳${minPrice} - ৳${maxPrice}`) : 'Offer a fee';

            return (
              <TouchableOpacity
                key={h.id}
                style={styles.helperCard}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('HelperDetail', {
                    helperId: h.id,
                    helperData: h,
                  })
                }
              >
                <View style={styles.helperHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{h.name?.charAt(0) || 'H'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    {/* 1. Name */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.helperName}>{h.name}</Text>

                    </View>

                    {/* 2. Category */}
                    <Text style={styles.helperCategoryText}>{helperCat}</Text>

                    {/* 3. Location */}
                    <TouchableOpacity
                      onPress={() => openMap(h.location,h)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}
                    >
                      <Ionicons name="location-outline" size={13} color="#0d9488" />
                      <Text style={styles.helperLocationText}>{h.location || 'Dhaka'}</Text>
                    </TouchableOpacity>

                    {/* 4. Review star */}
                    {(() => {
                      const formattedRating = (Number(h.total_reviews) > 0 ? Number(h.avg_rating).toFixed(1) : 'Not rated');
                      const reviewCount = Number(h.total_reviews) || 0;
                      return (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={13} color="#f59e0b" />
                          <Text style={styles.ratingText}>{formattedRating} ({reviewCount} reviews)</Text>
                        </View>
                      );
                    })()}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.price}>{priceRangeDisplay}</Text>
                    <Text style={styles.perHour}>estimated</Text>
                    <TouchableOpacity
                      style={styles.bookMiniBtn}
                      onPress={() => {
                        const formattedRating = (Number(h.total_reviews) > 0 ? Number(h.avg_rating).toFixed(1) : 'Not rated');
                        const reviewCount = Number(h.total_reviews) || 0;
                        navigation.navigate('HelperDetail', {
                          helperId: h.id,
                          helperData: { ...h, avg_rating: formattedRating, total_reviews: reviewCount },
                        });
                      }}
                    >
                      <Text style={styles.bookMiniBtnText}>Book Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Emergency Request Modal */}
      <Modal visible={emergencyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.modalBadgeIcon}>
                  <Ionicons name="warning" size={18} color="#dc2626" />
                </View>
                <Text style={styles.modalTitle}>Broadcast Emergency Request</Text>
              </View>
              <TouchableOpacity onPress={() => setEmergencyModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Service Category Picker - Standard app categories */}
            <Text style={styles.fieldLabel}>1. Select Needed Service Type</Text>
            <View style={styles.serviceTypesRow}>
              {categoryNames.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.serviceTypeChip, selectedServiceType === s && styles.serviceTypeChipActive]}
                  onPress={() => setSelectedServiceType(s)}
                >
                  <Text style={[styles.serviceChipText, selectedServiceType === s && styles.serviceChipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Location Confirmation */}
            <Text style={styles.fieldLabel}>2. Your Location Area</Text>
            <TextInput
              style={styles.modalInput}
              value={emergencyLocation}
              onChangeText={setEmergencyLocation}
              placeholder="e.g. Dhaka Central, Gulshan, etc."
            />

            {/* Contact Phone Number */}
            <Text style={styles.fieldLabel}>3. Your Contact Phone Number</Text>
            <TextInput
              style={styles.modalInput}
              value={emergencyContact}
              onChangeText={setEmergencyContact}
              keyboardType="phone-pad"
              placeholder="e.g. 01700000000"
            />

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEmergencyModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sendEmergencyBtn}
                onPress={submitEmergency}
                disabled={sendingEmergency}
              >
                <Ionicons name="paper-plane" size={16} color="#ffffff" />
                <Text style={styles.sendEmergencyBtnText}>{sendingEmergency ? 'Sending...' : 'Broadcast Now'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Map Modal */}
      <MapViewModal coordinates={mapCoordinates}
        visible={mapModal}
        onClose={() => setMapModal(false)}
        locationName={mapLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  topHeaderBanner: {
    height: 36,
    backgroundColor: '#0d9488',
    width: '100%',
  },
  userGreetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  userInfoTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#99f6e4',
  },
  userAvatarText: { color: '#0d9488', fontWeight: '900', fontSize: 16 },
  greetingSubText: { color: '#ccfbf1', fontSize: 11, fontWeight: '600' },
  userNameText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  locationText: { color: '#0d9488', fontSize: 12, fontWeight: '700' },
  toggleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 6,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    elevation: 2,
  },
  modeWrapper: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  modeTextActive: { color: '#0d9488', fontWeight: '800' },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    elevation: 2,
  },
  emergencyIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emergencyBtnText: { color: '#991b1b', fontSize: 14, fontWeight: '800' },
  emergencySubText: { color: '#64748b', fontSize: 11, marginTop: 2 },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  modalSubtitle: { fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#334155', marginTop: 10, marginBottom: 6 },
  serviceTypesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  serviceTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceTypeChipActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  serviceChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  serviceChipTextActive: { color: '#ffffff' },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  previewBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  previewTitle: { fontSize: 12, fontWeight: '800', color: '#991b1b', marginBottom: 4 },
  previewText: { fontSize: 12, color: '#7f1d1d', lineHeight: 17, fontStyle: 'italic' },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  sendEmergencyBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#dc2626',
  },
  sendEmergencyBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  postJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    elevation: 2,
  },
  postJobIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdfa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  postJobBtnText: { color: '#0f766e', fontSize: 14, fontWeight: '800' },
  postJobSubText: { color: '#64748b', fontSize: 11, marginTop: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a', paddingVertical: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  seeAllText: { fontSize: 13, fontWeight: '700', color: '#0d9488' },
  categoriesScroll: { marginBottom: 20 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  categoryChipActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  categoryChipText: { color: '#0f766e', fontWeight: '700', fontSize: 13 },
  categoryChipTextActive: { color: '#ffffff' },
  helperCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  helperHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f0fdfa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0d9488',
  },
  avatarText: { color: '#0f766e', fontWeight: '800', fontSize: 16 },
  helperName: { fontSize: 14.5, fontWeight: '800', color: '#0f172a' },
  helperCategoryText: { fontSize: 12, fontWeight: '700', color: '#0d9488', marginTop: 1 },
  helperLocationText: { fontSize: 11.5, fontWeight: '600', color: '#64748b' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ratingText: { fontSize: 11.5, color: '#334155', fontWeight: '600' },
  price: { color: '#0d9488', fontWeight: '800', fontSize: 15 },
  perHour: { fontSize: 10.5, color: '#94a3b8' },
  bookMiniBtn: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
  },
  bookMiniBtnText: { color: '#ffffff', fontSize: 11.5, fontWeight: '700' },
  emptyCard: { padding: 30, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
});

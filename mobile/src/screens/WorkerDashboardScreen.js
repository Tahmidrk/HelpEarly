import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bookingsAPI, helpersAPI, jobsAPI, complaintsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {useFocusEffect} from '@react-navigation/native';

import MapViewModal from '../components/MapViewModal';

export default function WorkerDashboardScreen({ navigation }) {
  const {revision}=useNotifications();
  useFocusEffect(React.useCallback(()=>{loadWorkerData();},[revision]));
  const { user, activeRole, switchMode } = useAuth();
  const [activeTab, setActiveTab] = useState('bookings');
  const [isAvailable, setIsAvailable] = useState(user?.helperProfile?.is_available !== false);
  const [bookings, setBookings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Complaint / Report Modal State (Matched to Household mode)
  const [complaintBooking, setComplaintBooking] = useState(null);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // View Details Modal State
  const [viewDetailsBooking, setViewDetailsBooking] = useState(null);

  // Client Profile Modal State
  const [selectedClientProfile, setSelectedClientProfile] = useState(null);

  // Map View Modal State
  const [mapModal, setMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState('Dhaka, Bangladesh');

  const openMapForLocation = (loc) => {
    setMapLocation(loc || 'Dhaka, Bangladesh');
    setMapModal(true);
  };

  useEffect(() => {
    loadWorkerData();
    setIsAvailable(user?.helperProfile?.is_available !== false);
  }, [user?.id, activeRole, user?.helperProfile?.is_available]);

  const handleAvailability = async (value) => {
    try {
      await helpersAPI.update({ is_available: value });
      setIsAvailable(value);
    } catch (error) {
      Alert.alert('Availability Not Saved', error.message);
    }
  };

  const loadWorkerData = async () => {
    try {
      setLoading(true);
      const [bData, aData] = await Promise.all([
        bookingsAPI.getMyBookings(),
        jobsAPI.getApplications(),
      ]);
      setBookings(bData);
      setApplications(aData);
    } catch (err) {
      Alert.alert('Could Not Load Dashboard', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingAction = async (id, status) => {
    try {
      await bookingsAPI.updateStatus(id, status);
      setBookings(bookings.map((b) => (b.id === id ? { ...b, status } : b)));
      Alert.alert('Status Updated', `Booking request marked as ${status}.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleOpenComplaint = (booking) => {
    setComplaintBooking(booking);
    setComplaintSubject('');
    setComplaintDescription('');
  };

  const handleSubmitComplaint = async () => {
    if (!complaintSubject.trim() || !complaintDescription.trim()) {
      Alert.alert('Missing Details', 'Please provide both an issue subject and a description.');
      return;
    }
    try {
      setSubmittingComplaint(true);
      await complaintsAPI.create({
        accused_id: complaintBooking.user_id || complaintBooking.client_id,
        subject: complaintSubject.trim(),
        description: complaintDescription.trim(),
      });
      Alert.alert('Complaint Filed', 'Your complaint has been logged and sent to platform administrators for investigation.');
      setComplaintBooking(null);
      setComplaintSubject('');
      setComplaintDescription('');
    } catch (err) {
      Alert.alert('Complaint Failed', err.message);
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const completedBookings = bookings.filter(
    (b) => b.status === 'completed' || b.status === 'Completed'
  );
  const totalEarnings = completedBookings.reduce((sum, b) => {
    const p = Number(b.total_price || b.amount || 0);
    return sum + (Number.isFinite(p) ? p : 0);
  }, 0);

  return (
    <View style={styles.container}>
      {/* Top Header Banner matching status bar height */}
      <View style={styles.topHeaderBanner} />

      {/* Top User Greeting Bar (Identical layout to Household Mode) */}
      <View style={styles.userGreetingHeader}>
        <TouchableOpacity
          style={styles.userInfoTouchable}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          <View style={styles.userAvatarCircle}>
            <Text style={styles.userAvatarText}>{user?.name ? user.name.charAt(0).toUpperCase() : 'W'}</Text>
          </View>
          <Text style={styles.userNameText}>{user?.name || 'Helper Account'}</Text>
        </TouchableOpacity>

        {/* Availability Toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800', marginTop: 2 }}>
            {isAvailable ? 'ONLINE' : 'OFFLINE'}
          </Text>
          <Switch
            value={isAvailable}
            onValueChange={handleAvailability}
            trackColor={{ false: '#cbd5e1', true: '#99f6e4' }}
            thumbColor={isAvailable ? '#ffffff' : '#64748b'}
          />
        </View>
      </View>

      {/* Dual Role Mode Switcher Bar */}
      {user?.role === 'both' && (
        <View style={styles.toggleCard}>
          <View style={styles.modeWrapper}>
            <TouchableOpacity
              style={[styles.modeBtn, activeRole === 'household' && styles.modeBtnActive]}
              onPress={() => switchMode('household')}
            >
              <Ionicons name="home" size={15} color={activeRole === 'household' ? '#0d9488' : '#64748b'} />
              <Text style={[styles.modeText, activeRole === 'household' && styles.modeTextActive]}>Household Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, activeRole === 'helper' && styles.modeBtnActive]}
              onPress={() => switchMode('helper')}
            >
              <Ionicons name="construct" size={14} color={activeRole === 'helper' ? '#0d9488' : '#64748b'} />
              <Text style={[styles.modeText, activeRole === 'helper' && styles.modeTextActive]}>Worker Mode</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{bookings.length}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>৳{totalEarnings}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{bookings.filter((b) => b.status === 'pending').length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'bookings' && styles.tabBtnActive]}
          onPress={() => setActiveTab('bookings')}
        >
          <Text style={[styles.tabText, activeTab === 'bookings' && styles.tabTextActive]}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'wallet' && styles.tabBtnActive]}
          onPress={() => setActiveTab('wallet')}
        >
          <Text style={[styles.tabText, activeTab === 'wallet' && styles.tabTextActive]}>Earnings ৳</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 30 }} />
      ) : activeTab === 'bookings' ? (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="clipboard-outline" size={40} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Booking Requests Yet</Text>
              <Text style={styles.emptySub}>Client booking requests will appear here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Top Row: Client Name & Status Badge */}
              <View style={styles.cardTop}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                  onPress={() =>
                    setSelectedClientProfile({
                      id: item.user_id || item.client_id,
                      name: item.booker_name || item.client_name || item.user_name || item.user?.name || 'Customer',
                      location: item.address || item.booker_location || item.location || 'Gulshan-2, Dhaka, Bangladesh',
                      phone: item.booker_phone || item.phone,
                      email: item.booker_email || item.email,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ccfbf1' }}>
                    <Ionicons name="person" size={16} color="#0d9488" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>
                      {item.booker_name || item.client_name || item.user_name || item.user?.name || 'Customer'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      item.status === 'completed'
                        ? '#dcfce7'
                        : item.status === 'confirmed'
                        ? '#e0f2fe'
                        : item.status === 'cancelled' || item.status === 'declined'
                        ? '#fef2f2'
                        : '#fef3c7',
                  },
                ]}>
                  <Text style={[
                    styles.statusText,
                    {
                      color:
                        item.status === 'completed'
                          ? '#15803d'
                          : item.status === 'confirmed'
                          ? '#0369a1'
                          : item.status === 'cancelled' || item.status === 'declined'
                          ? '#dc2626'
                          : '#92400e',
                    },
                  ]}>
                    {item.status === 'completed'
                      ? '✓ Completed'
                      : item.status === 'confirmed'
                      ? 'Accepted'
                      : item.status === 'cancelled' || item.status === 'declined'
                      ? 'Declined'
                      : item.status || 'Pending'}
                  </Text>
                </View>
              </View>

              {/* Service & Booking Details */}
              <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, marginVertical: 8, borderWidth: 1, borderColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a', flex: 1 }}>{item.service_name || item.sub_service || 'Home Service Booking'}</Text>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' }}
                    onPress={() => setViewDetailsBooking(item)}
                  >
                    <Ionicons name="eye-outline" size={13} color="#0d9488" />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0d9488' }}>View</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardMeta}>📅 {new Date(item.service_date || Date.now()).toLocaleDateString()} · 📍 {item.address || item.booker_location || item.location || 'Dhaka'}</Text>
                {item.notes && <Text style={styles.notes}>"{item.notes}"</Text>}
              </View>

              {/* Action Buttons: Accept / Decline / Complete / Report */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 4 }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef2f2', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', height: 34 }}
                  onPress={() => handleOpenComplaint(item)}
                >
                  <Ionicons name="alert-circle" size={15} color="#dc2626" />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626' }}>Report</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {item.status === 'pending' || !item.status ? (
                    <>
                      <TouchableOpacity style={[styles.acceptBtn, { height: 34, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 }]} onPress={() => handleBookingAction(item.id, 'confirmed')}>
                        <Ionicons name="checkmark-circle-outline" size={15} color="#0d9488" />
                        <Text style={styles.acceptText}>Accept Job</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.declineBtn, { height: 34, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 }]} onPress={() => handleBookingAction(item.id, 'cancelled')}>
                        <Ionicons name="close-circle-outline" size={15} color="#dc2626" />
                        <Text style={styles.declineText}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  ) : item.status === 'confirmed' ? (
                    <TouchableOpacity style={[styles.acceptBtn, { height: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12 }]} onPress={() => handleBookingAction(item.id, 'in_progress')}>
                      <Ionicons name="play-circle-outline" size={16} color="#0d9488" />
                      <Text style={styles.acceptText}>Start Work</Text>
                    </TouchableOpacity>
                  ) : item.status === 'in_progress' ? (
                    <TouchableOpacity style={[styles.completeBtn, { height: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12 }]} onPress={() => handleBookingAction(item.id, 'completed')}>
                      <Ionicons name="checkmark-done-circle-outline" size={16} color="#16a34a" />
                      <Text style={styles.completeText}>Mark Completed</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        />
      ) : (
        /* Wallet View */
        <ScrollView style={{ padding: 16 }}>
          <View style={styles.walletCard}>
            <Text style={styles.walletTitle}>Total Earnings Balance</Text>
            <Text style={styles.walletAmount}>৳{totalEarnings}</Text>
            <Text style={styles.walletSub}>Paid directly for completed service requests</Text>
          </View>

          <Text style={styles.sectionHeader}>Completed Payout History</Text>
          {completedBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="wallet-outline" size={40} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Completed Earnings Yet</Text>
            </View>
          ) : (
            completedBookings.map((b) => (
              <View key={b.id} style={styles.payoutCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutTitle}>{b.service_name || 'Home Service'}</Text>
                  <Text style={styles.payoutDate}>{new Date(b.service_date || Date.now()).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.payoutAmount}>+৳{b.total_price || 0}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Report Issue / Complaint Modal (Matches Household Mode 1:1) */}
      <Modal visible={!!complaintBooking} transparent animationType="slide" onRequestClose={() => setComplaintBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#dc2626' }}>Report Booker / Complaint</Text>
              </View>
              <TouchableOpacity onPress={() => setComplaintBooking(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              Report issue regarding client <Text style={{ fontWeight: '800', color: '#0f172a' }}>{complaintBooking?.client_name || complaintBooking?.user_name || 'Booker'}</Text>
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Subject / Issue Type</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', padding: 10, fontSize: 13, color: '#0f172a', marginBottom: 12 }}
              placeholder="e.g. Unresponsive, Invalid location, Rude behavior"
              placeholderTextColor="#94a3b8"
              value={complaintSubject}
              onChangeText={setComplaintSubject}
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Description & Details</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', padding: 10, height: 90, textAlignVertical: 'top', fontSize: 13, color: '#0f172a', marginBottom: 16 }}
              placeholder="Describe what happened in detail for platform admin review..."
              placeholderTextColor="#94a3b8"
              multiline
              value={complaintDescription}
              onChangeText={setComplaintDescription}
            />

            <TouchableOpacity
              style={{ backgroundColor: '#dc2626', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
              onPress={handleSubmitComplaint}
              disabled={submittingComplaint}
            >
              {submittingComplaint ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>Submit Complaint to Admin</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full Booking Details Modal */}
      <Modal visible={!!viewDetailsBooking} transparent animationType="slide" onRequestClose={() => setViewDetailsBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 22 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="document-text" size={22} color="#0d9488" />
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#0f172a' }}>Booking Request Details</Text>
              </View>
              <TouchableOpacity onPress={() => setViewDetailsBooking(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Client Info */}
            <View style={{ backgroundColor: '#f0fdfa', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ccfbf1', marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0d9488', textTransform: 'uppercase', marginBottom: 4 }}>Client / Booker Info</Text>
              <TouchableOpacity
                onPress={() => {
                  const b = viewDetailsBooking;
                  setViewDetailsBooking(null);
                  setSelectedClientProfile({
                    id: b?.user_id || b?.client_id,
                    name: b?.booker_name || b?.client_name || b?.user_name || 'Customer',
                    location: b?.address || b?.booker_location || b?.location || 'Gulshan-2, Dhaka, Bangladesh',
                    phone: b?.booker_phone || b?.phone,
                    email: b?.booker_email || b?.email,
                  });
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>
                  {viewDetailsBooking?.booker_name || viewDetailsBooking?.client_name || viewDetailsBooking?.user_name || 'Customer'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 12.5, color: '#475569', flex: 1, marginRight: 8 }}>
                  📍 {viewDetailsBooking?.address || viewDetailsBooking?.booker_location || viewDetailsBooking?.location || 'Dhaka, Bangladesh'}
                </Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0d9488', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                  onPress={() => openMapForLocation(viewDetailsBooking?.address || viewDetailsBooking?.booker_location || viewDetailsBooking?.location || 'Dhaka, Bangladesh')}
                >
                  <Ionicons name="map" size={14} color="#ffffff" />
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#ffffff' }}>Open Map</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Service & Schedule */}
            <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Service Requested:</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#0f172a' }}>{viewDetailsBooking?.service_name || viewDetailsBooking?.sub_service || 'Home Service'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Scheduled Date:</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0f172a' }}>{new Date(viewDetailsBooking?.service_date || Date.now()).toLocaleDateString()}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Offered Rate / Budget:</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#0d9488' }}>৳{viewDetailsBooking?.total_price || viewDetailsBooking?.amount || 0}</Text>
              </View>
            </View>

            {/* Client Notes */}
            {viewDetailsBooking?.notes ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Client Instructions & Notes</Text>
                <View style={{ backgroundColor: '#ffffff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#cbd5e1' }}>
                  <Text style={{ fontSize: 12.5, color: '#334155', fontWeight: 'normal', lineHeight: 18 }}>{viewDetailsBooking.notes}</Text>
                </View>
              </View>
            ) : null}

            {/* Attached Image / Photo View */}
            {(viewDetailsBooking?.photo_urls?.[0] || viewDetailsBooking?.photoUri) && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                  📷 Attached Task Photo
                </Text>
                <Image
                  source={{ uri: viewDetailsBooking.photo_urls?.[0] || viewDetailsBooking.photoUri }}
                  style={{ width: '100%', height: 160, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f1f5f9' }}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Action Buttons: Chat Client & Close Details */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#0d9488', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                onPress={() => {
                  const clientToChatName = viewDetailsBooking?.booker_name || viewDetailsBooking?.client_name || viewDetailsBooking?.user_name || 'Customer';
                  const clientToChatId = viewDetailsBooking?.user_id || viewDetailsBooking?.client_id;
                  setViewDetailsBooking(null);
                  if (navigation) {
                    navigation.navigate('Inbox', {
                      helperUserId: clientToChatId,
                      helperName: clientToChatName,
                    });
                  }
                }}
              >
                <Ionicons name="chatbubbles-outline" size={18} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13.5 }}>Chat Client</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                onPress={() => setViewDetailsBooking(null)}
              >
                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 13.5 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Client Profile Dossier Modal */}
      <Modal visible={!!selectedClientProfile} transparent animationType="fade" onRequestClose={() => setSelectedClientProfile(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 22 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-circle" size={26} color="#0d9488" />
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Household Client Profile</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedClientProfile(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Avatar & Name Header */}
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0d9488', marginBottom: 8 }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#0d9488' }}>{selectedClientProfile?.name?.charAt(0) || 'C'}</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>{selectedClientProfile?.name}</Text>
              <View style={{ backgroundColor: '#ccfbf1', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 4 }}>
                <Text style={{ color: '#0f766e', fontSize: 11, fontWeight: '800' }}>Household booker</Text>
              </View>
            </View>

            {/* Profile Meta Cards */}
            <View style={{ backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="location-outline" size={18} color="#0d9488" />
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600', flex: 1 }}>{selectedClientProfile?.location}</Text>
              </View>

              {selectedClientProfile?.phone ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="call-outline" size={18} color="#0d9488" />
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>{selectedClientProfile?.phone}</Text>
              </View> : null}

              {selectedClientProfile?.email ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="mail-outline" size={18} color="#0d9488" />
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>{selectedClientProfile?.email}</Text>
              </View> : null}
            </View>

            {/* Action Buttons: Chat Client & Close */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#0d9488', paddingVertical: 11, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                onPress={() => {
                  const clientToChat = selectedClientProfile;
                  setSelectedClientProfile(null);
                  if (navigation) {
                    navigation.navigate('Inbox', {
                      helperUserId: clientToChat?.id,
                      helperName: clientToChat?.name || 'Customer',
                    });
                  }
                }}
              >
                <Ionicons name="chatbubbles-outline" size={17} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13.5 }}>Chat Client</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: 'center' }}
                onPress={() => setSelectedClientProfile(null)}
              >
                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 13.5 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Map View Modal */}
      <MapViewModal
        visible={mapModal}
        onClose={() => setMapModal(false)}
        locationName={mapLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
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
  userNameText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  onlineToggle: { alignItems: 'center' },
  toggleCard: {
    backgroundColor: '#ffffff',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modeWrapper: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
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
  onlineText: { color: '#ffffff', fontSize: 10, fontWeight: '900', marginBottom: 2 },
  statsGrid: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  statCard: { flex: 1, backgroundColor: '#f0fdfa', padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ccfbf1' },
  statVal: { fontSize: 18, fontWeight: '900', color: '#0f766e' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '600' },
  tabsRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#0d9488' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#0d9488' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clientName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  notes: { fontSize: 12, color: '#334155', fontWeight: 'normal', marginVertical: 8 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' },
  acceptBtn: { backgroundColor: '#f0fdfa', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#ccfbf1' },
  acceptText: { color: '#0d9488', fontWeight: '800', fontSize: 12 },
  declineBtn: { backgroundColor: '#fef2f2', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' },
  declineText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  completeBtn: { backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  completeText: { color: '#16a34a', fontWeight: '800', fontSize: 12 },
  completedLabel: { color: '#16a34a', fontWeight: '800', fontSize: 12 },
  walletCard: { backgroundColor: '#0d9488', borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center' },
  walletTitle: { color: '#ccfbf1', fontSize: 13, fontWeight: '700' },
  walletAmount: { color: '#ffffff', fontSize: 32, fontWeight: '900', marginVertical: 6 },
  walletSub: { color: '#99f6e4', fontSize: 11 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  payoutCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  payoutTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  payoutDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  payoutAmount: { color: '#16a34a', fontWeight: '900', fontSize: 16 },
  emptyCard: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
});

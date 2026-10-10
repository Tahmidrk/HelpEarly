import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  BackHandler,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { helpersAPI, reviewsAPI, complaintsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ChatScreen from './ChatScreen';
import MapViewModal from '../components/MapViewModal';

export default function ExploreScreen({ route, navigation }) {
  const { user, activeRole, userBookings, fetchUserBookings, cancelBooking, updateBookingSchedule } = useAuth();
  const { selectedCategory: paramCat, highlightHelperId: paramHighlightId, openSubTab } = route.params || {};

  const [activeSubTab, setActiveSubTab] = useState(openSubTab || 'helpers'); // 'helpers' | 'bookings' | 'chats'

  useEffect(() => {
    if (route.params?.openSubTab) {
      setActiveSubTab(route.params.openSubTab);
    }
  }, [route.params?.openSubTab]);

  useEffect(() => {
    if (activeSubTab === 'bookings' && fetchUserBookings) {
      fetchUserBookings();
    }
  }, [activeSubTab]);

  const [editingBooking, setEditingBooking] = useState(null);
  const [viewDetailsBooking, setViewDetailsBooking] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  // Review & Rating Modal state
  const [reviewBooking, setReviewBooking] = useState(null);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // File Complaint Modal state
  const [complaintBooking, setComplaintBooking] = useState(null);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const handleCancelBooking = (bookingId) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelBooking(bookingId);
            Alert.alert('Booking Cancelled', 'Your booking request has been cancelled.');
          } catch (error) {
            Alert.alert('Cancellation Failed', error.message);
          }
        },
      },
    ]);
  };

  const handleSaveEditBooking = async () => {
    if (!editDate || !editTime) {
      Alert.alert('Required', 'Please specify date and time.');
      return;
    }
    try {
      await updateBookingSchedule(editingBooking.id, editDate, editTime);
      Alert.alert('Booking Updated', 'Your schedule changes have been saved.');
      setEditingBooking(null);
    } catch (error) {
      Alert.alert('Update Failed', error.message);
    }
  };

  const handleSubmitReview = async () => {
    if (!rating) {
      Alert.alert('Required', 'Please choose a star rating.');
      return;
    }
    if (!reviewComment.trim()) {
      Alert.alert('Required', 'Please write a brief comment/review for the helper.');
      return;
    }
    try {
      setSubmittingReview(true);
      const rawBId = reviewBooking?.rawId || reviewBooking?.id;
      const validBookingId = (rawBId && !isNaN(Number(rawBId))) ? Number(rawBId) : null;
      const validHelperId = Number(reviewBooking?.helper_id);
      if (!validBookingId || !validHelperId) throw new Error('Booking information is incomplete. Refresh and try again.');

      await reviewsAPI.create({
        booking_id: validBookingId,
        helper_id: validHelperId,
        rating: rating,
        comment: reviewComment.trim(),
      });
      Alert.alert('Thank You!', 'Your rating and review have been submitted successfully.');
      setReviewBooking(null);
      setReviewComment('');
      setRating(0);
    } catch (e) {
      Alert.alert('Review Not Saved', e.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitComplaint = async () => {
    if (!complaintSubject.trim() || !complaintDescription.trim()) {
      Alert.alert('Required', 'Please fill in both the subject and issue details.');
      return;
    }
    try {
      setSubmittingComplaint(true);
      await complaintsAPI.create({
        accused_id: complaintBooking.helper_user_id,
        subject: complaintSubject.trim(),
        description: complaintDescription.trim(),
      });
      Alert.alert('Complaint Filed', 'Your complaint has been logged and sent to platform administrators for investigation.');
      setComplaintBooking(null);
      setComplaintSubject('');
      setComplaintDescription('');
    } catch (e) {
      Alert.alert('Complaint Not Saved', e.message);
    } finally {
      setSubmittingComplaint(false);
    }
  };
  const [helpers, setHelpers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(paramCat || 'All');
  const [highlightId, setHighlightId] = useState(paramHighlightId || null);
  const [search, setSearch] = useState('');
  const [mapModal, setMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState('Dhaka, Bangladesh');

  const openMapForLocation = (loc) => {
    setMapLocation(loc || 'Dhaka, Bangladesh');
    setMapModal(true);
  };

  const categories = ['All', 'Cleaning', 'Plumbing', 'Electrical', 'Gardening', 'Babysitting', 'Moving', 'Cooking'];

  useEffect(() => {
    if (route.params) {
      if (route.params.openSubTab) {
        setActiveSubTab(route.params.openSubTab);
      }
      if (route.params.selectedCategory !== undefined) {
        setSelectedCategory(route.params.selectedCategory);
      } else {
        setSelectedCategory('All');
      }
      setHighlightId(route.params.highlightHelperId || null);
    } else {
      setSelectedCategory('All');
      setHighlightId(null);
    }
  }, [route.params]);

  // Intercept Android hardware back button when inside Inbox sub-tab
  useEffect(() => {
    const onBackPress = () => {
      if (activeSubTab === 'chats') {
        setActiveSubTab('helpers');
        navigation.setParams({ openSubTab: 'helpers', helperName: null, helperId: null });
        return true; // prevent default back navigation to Home
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [activeSubTab, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setActiveSubTab('helpers');
      setSelectedCategory('All');
      setHighlightId(null);
      navigation.setParams({ openSubTab: null, helperName: null, helperId: null, selectedCategory: 'All', highlightHelperId: null });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    loadHelpers();
  }, []);

  const loadHelpers = async () => {
    try {
      setLoading(true);
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

  const filteredHelpers = helpers.filter((h) => {
    if (Number(h.user_id) === Number(user?.id)) return false;
    const primaryCat = h.primary_category || h.category || (h.services && h.services[0]?.category_name) || '';
    const serviceCats = (h.services || []).map((s) => s.category_name);
    const allCats = [primaryCat, ...serviceCats].filter(Boolean).map((c) => c.toLowerCase());

    const matchCat =
      selectedCategory === 'All' ||
      allCats.includes(selectedCategory.toLowerCase());

    const q = search.toLowerCase().trim();
    if (!q) return matchCat;

    const serviceNames = (h.services || []).map((s) => s.service_name?.toLowerCase() || '');
    const matchSearch =
      h.name?.toLowerCase().includes(q) ||
      h.location?.toLowerCase().includes(q) ||
      h.bio?.toLowerCase().includes(q) ||
      allCats.some((c) => c.includes(q)) ||
      serviceNames.some((s) => s.includes(q));

    return matchCat && matchSearch;
  });

  return (
    <View style={styles.container}>
      {/* Sub-Tab Header Switcher inside Helpers screen */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSubTab === 'helpers' && styles.segmentBtnActive]}
          onPress={() => setActiveSubTab('helpers')}
          activeOpacity={0.85}
        >
          <Ionicons name="people" size={15} color={activeSubTab === 'helpers' ? '#0d9488' : '#64748b'} />
          <Text style={[styles.segmentText, activeSubTab === 'helpers' && styles.segmentTextActive]}>
            Helpers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSubTab === 'bookings' && styles.segmentBtnActive]}
          onPress={() => setActiveSubTab('bookings')}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-sharp" size={15} color={activeSubTab === 'bookings' ? '#0d9488' : '#64748b'} />
          <Text style={[styles.segmentText, activeSubTab === 'bookings' && styles.segmentTextActive]}>
            My Bookings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSubTab === 'chats' && styles.segmentBtnActive]}
          onPress={() => setActiveSubTab('chats')}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubbles" size={15} color={activeSubTab === 'chats' ? '#0d9488' : '#64748b'} />
          <Text style={[styles.segmentText, activeSubTab === 'chats' && styles.segmentTextActive]}>
            Inbox
          </Text>
        </TouchableOpacity>
      </View>

      {/* Render selected subtab view */}
      {activeSubTab === 'chats' ? (
        <View style={{ flex: 1 }}>
          <ChatScreen route={route} navigation={navigation} />
        </View>
      ) : activeSubTab === 'bookings' ? (
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={styles.bookingsSubHeader}>Track & Manage Your Appointments</Text>
          <FlatList
            data={userBookings}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Active Bookings</Text>
                <Text style={styles.emptySub}>Book a service worker from the Helpers tab!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.bookingCard}>
                {/* Header row: Avatar + Name + Status */}
                <View style={styles.bookingCardHeader}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                    activeOpacity={0.7}
                    onPress={() => {
                      const matchedHelper = helpers.find(h => String(h.id) === String(item.helper_id)) || {
                        id: item.helper_id,
                        name: item.helper_name,
                        location: item.location || 'Dhaka',
                        primary_category: item.category || 'Service Worker',
                      };
                      navigation.navigate('HelperDetail', {
                        helperId: item.helper_id || matchedHelper.id,
                        helperData: matchedHelper,
                      });
                    }}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ccfbf1' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0d9488' }}>{item.helper_name?.charAt(0) || 'H'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.bookingHelperName} numberOfLines={1}>{item.helper_name}</Text>
                        <Ionicons name="chevron-forward" size={14} color="#0d9488" />
                      </View>
                      <Text style={styles.bookingIdText}>{item.service || item.category}</Text>
                    </View>
                  </TouchableOpacity>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'Pending'
                        ? styles.statusPending
                        : item.status === 'Accepted'
                        ? styles.statusAccepted
                        : styles.statusCompleted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.status === 'Pending'
                          ? styles.statusPendingText
                          : item.status === 'Accepted'
                          ? styles.statusAcceptedText
                          : styles.statusCompletedText,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                {/* Sub details: Date & Cost Pill */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="time-outline" size={14} color="#0d9488" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>{item.date} · {item.time}</Text>
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0d9488' }}>৳{item.amount}</Text>
                </View>

                {/* Actions row - Clean modern pill buttons */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdfa', borderColor: '#ccfbf1', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                    onPress={() => setViewDetailsBooking(item)}
                  >
                    <Ionicons name="eye-outline" size={13} color="#0d9488" />
                    <Text style={{ color: '#0d9488', fontWeight: '700', fontSize: 11.5 }}>Details</Text>
                  </TouchableOpacity>

                  {/* EDIT BUTTON: Only visible if status is Pending */}
                  {item.status === 'Pending' && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                      onPress={() => {
                        setEditingBooking(item);
                        setEditDate(item.date);
                        setEditTime(item.time);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={13} color="#475569" />
                      <Text style={{ color: '#475569', fontWeight: '700', fontSize: 11.5 }}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  {/* LEAVE REVIEW BUTTON: Appears when booking is Completed */}
                  {item.status === 'Completed' && (
                    <>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdfa', borderColor: '#0d9488', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                        onPress={() => {
                          const matchedHelper = helpers.find(h => String(h.id) === String(item.helper_id)) || {
                            id: item.helper_id,
                            name: item.helper_name,
                            location: item.location || 'Dhaka',
                            primary_category: item.category || 'Service Worker',
                          };
                          navigation.navigate('HelperDetail', {
                            helperId: item.helper_id || matchedHelper.id,
                            helperData: matchedHelper,
                            autoOpenBooking: true,
                          });
                        }}
                      >
                        <Ionicons name="refresh" size={13} color="#0d9488" />
                        <Text style={{ color: '#0d9488', fontWeight: '700', fontSize: 11.5 }}>Rebook</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                        onPress={() => setReviewBooking(item)}
                      >
                        <Ionicons name="star" size={13} color="#b45309" />
                        <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 11.5 }}>Review</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* COMPLAINT / REPORT ISSUE BUTTON */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}
                    onPress={() => setComplaintBooking(item)}
                  >
                    <Ionicons name="flag-outline" size={13} color="#e11d48" />
                    <Text style={{ color: '#e11d48', fontWeight: '700', fontSize: 11.5 }}>Report</Text>
                  </TouchableOpacity>

                  {/* CANCEL BUTTON */}
                  {item.status !== 'Completed' && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}
                      onPress={() => handleCancelBooking(item.id)}
                    >
                      <Ionicons name="close-circle-outline" size={13} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 11.5 }}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Search Header */}
          <View style={styles.headerBox}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#0d9488" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search helper, skill, location..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {/* Category Horizontal Scroll */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={categories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.catChip, selectedCategory === item && styles.catChipActive]}
                  onPress={() => setSelectedCategory(item)}
                >
                  <Text style={[styles.catChipText, selectedCategory === item && styles.catChipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Helper Cards List */}
          {loading ? (
            <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredHelpers}
              keyExtractor={(item) => item.id?.toString()}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Helpers Found</Text>
                  <Text style={styles.emptySub}>Try selecting another category or keyword</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isHighlighted = highlightId && Number(highlightId) === Number(item.id);
                const prices = (item.services || []).map((s) => Number(s.price)).filter((p) => !isNaN(p) && p > 0);
                const minPrice = prices.length ? Math.min(...prices) : Number(item.hourly_rate || 0);
                const maxPrice = prices.length ? Math.max(...prices) : minPrice;
                const priceRangeDisplay = minPrice>0 ? (minPrice === maxPrice ? `৳${minPrice}` : `৳${minPrice} - ৳${maxPrice}`) : 'Offer a fee';
                const catName = selectedCategory !== 'All' ? selectedCategory : (item.primary_category || item.category || item.services?.[0]?.category_name || 'Service Worker');

                // Get bio matching the primary category
                const matchedBio = item.bio || 'No bio provided.';
                const formattedRating = (Number(item.total_reviews) > 0 ? Number(item.avg_rating).toFixed(1) : 'Not rated');
                const reviewCount = Number(item.total_reviews) || 0;

                return (
                  <TouchableOpacity
                    style={[styles.card, isHighlighted && styles.highlightedCard]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('HelperDetail', { helperId: item.id, helperData: { ...item, activeCategoryDisplay: catName, activeBioDisplay: matchedBio, avg_rating: formattedRating, total_reviews: reviewCount } })}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.name?.charAt(0) || 'H'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.name}>{item.name}</Text>
                          {item.is_verified && <Ionicons name="checkmark-circle" size={16} color="#0d9488" />}
                        </View>
                        <Text style={styles.category}>
                          {catName} · 📍 {item.location || 'Dhaka'}
                        </Text>

                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={14} color="#f59e0b" />
                          <Text style={styles.ratingText}>{formattedRating} ({reviewCount} reviews)</Text>
                        </View>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.price}>{priceRangeDisplay}</Text>
                        <Text style={styles.perHour}>estimated</Text>
                      </View>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.profileBtn}
                        onPress={() => navigation.navigate('HelperDetail', { helperId: item.id, helperData: { ...item, activeCategoryDisplay: catName, activeBioDisplay: matchedBio } })}
                      >
                        <Ionicons name="person-outline" size={15} color="#0f766e" />
                        <Text style={styles.profileBtnText}>View Profile</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={() => {
                          setActiveSubTab('chats');
                          navigation.setParams({ openSubTab: 'chats', helperName: item.name, helperUserId: item.user_id, helperProfileId: item.id });
                        }}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={15} color="#0d9488" />
                        <Text style={styles.chatBtnText}>Chat</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.bookBtn}
                        onPress={() => navigation.navigate('HelperDetail', { helperId: item.id, helperData: item })}
                      >
                        <Ionicons name="calendar-outline" size={15} color="#ffffff" />
                        <Text style={styles.bookBtnText}>Book Helper</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Edit Booking Schedule Modal */}
      <Modal visible={!!editingBooking} transparent animationType="slide" onRequestClose={() => setEditingBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="create-outline" size={20} color="#0d9488" />
                <Text style={styles.modalTitle}>Edit Schedule ({editingBooking?.id})</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingBooking(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Scheduled Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="2026-09-10"
            />

            <Text style={styles.label}>Scheduled Time</Text>
            <TextInput
              style={styles.input}
              value={editTime}
              onChangeText={setEditTime}
              placeholder="10:00 AM"
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveEditBooking}>
              <Text style={styles.confirmBtnText}>Save Schedule Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Rate & Review Modal */}
      <Modal visible={!!reviewBooking} transparent animationType="slide" onRequestClose={() => setReviewBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="star" size={20} color="#f59e0b" />
                <Text style={styles.modalTitle}>Rate Service & Helper</Text>
              </View>
              <TouchableOpacity onPress={() => setReviewBooking(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              How was your experience with <Text style={{ fontWeight: '800', color: '#0f172a' }}>{reviewBooking?.helper_name}</Text>?
            </Text>

            {/* Star Rating Bar */}
            <Text style={styles.labelNoMargin}>Star Rating</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginVertical: 10, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={32} color="#f59e0b" />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Your Review / Feedback</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Write a comment about their work punctuality, quality, or behavior..."
              placeholderTextColor="#94a3b8"
              multiline
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmitReview} disabled={submittingReview}>
              {submittingReview ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.confirmBtnText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report Issue / Complaint Modal */}
      <Modal visible={!!complaintBooking} transparent animationType="slide" onRequestClose={() => setComplaintBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <Text style={[styles.modalTitle, { color: '#dc2626' }]}>Report an Issue / Complaint</Text>
              </View>
              <TouchableOpacity onPress={() => setComplaintBooking(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
              Report issue regarding <Text style={{ fontWeight: '800', color: '#0f172a' }}>{complaintBooking?.helper_name}</Text>
            </Text>

            <Text style={styles.labelNoMargin}>Subject / Issue Type</Text>
            <TextInput
              style={[styles.input, { marginTop: 4 }]}
              placeholder="e.g. Unprofessional behavior, No-show, Overcharging"
              placeholderTextColor="#94a3b8"
              value={complaintSubject}
              onChangeText={setComplaintSubject}
            />

            <Text style={styles.label}>Description & Details</Text>
            <TextInput
              style={[styles.input, { height: 90 }]}
              placeholder="Describe what happened in detail for platform admin review..."
              placeholderTextColor="#94a3b8"
              multiline
              value={complaintDescription}
              onChangeText={setComplaintDescription}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: '#dc2626' }]}
              onPress={handleSubmitComplaint}
              disabled={submittingComplaint}
            >
              {submittingComplaint ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.confirmBtnText}>Submit Complaint to Admin</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full Booking Details Modal */}
      <Modal visible={!!viewDetailsBooking} transparent animationType="slide" onRequestClose={() => setViewDetailsBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%', paddingBottom: 24 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text" size={20} color="#0d9488" />
                <Text style={styles.modalTitle}>Booking Details</Text>
              </View>
              <TouchableOpacity onPress={() => setViewDetailsBooking(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: '#f0fdfa', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#ccfbf1' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{viewDetailsBooking?.helper_name}</Text>
                <Text style={{ fontSize: 12, color: '#0f766e', fontWeight: '600', marginTop: 2 }}>
                  Reference ID: #{viewDetailsBooking?.id} · {viewDetailsBooking?.category}
                </Text>
              </View>

              <View style={{ gap: 12, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="construct" size={16} color="#0d9488" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Service Requested</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0f172a' }}>{viewDetailsBooking?.service}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="time" size={16} color="#0d9488" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Schedule</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0f172a' }}>{viewDetailsBooking?.date} at {viewDetailsBooking?.time}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="location" size={16} color="#0d9488" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Location / Address</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0f172a' }}>{viewDetailsBooking?.location || 'Dhaka, Bangladesh'}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="cash" size={16} color="#0d9488" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Estimated Cost</Text>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0d9488' }}>৳{viewDetailsBooking?.amount}</Text>
                  </View>
                </View>
              </View>

              {/* Description / Special Instructions */}
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                  Booking Description / Notes
                </Text>
                <Text style={{ fontSize: 13, color: '#334155', lineHeight: 19 }}>
                  {viewDetailsBooking?.notes || viewDetailsBooking?.description || 'No additional notes provided during booking.'}
                </Text>
              </View>

              {/* Attached Photo */}
              {(viewDetailsBooking?.photo_url || viewDetailsBooking?.photoUri) && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                    Attached Issue Photo
                  </Text>
                  <Image
                    source={{ uri: viewDetailsBooking.photo_url || viewDetailsBooking.photoUri }}
                    style={{ width: '100%', height: 180, borderRadius: 12, resizeMode: 'cover' }}
                  />
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmBtn, { marginTop: 10 }]}
              onPress={() => setViewDetailsBooking(null)}
            >
              <Text style={styles.confirmBtnText}>Close Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Interactive Map Modal */}
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
  // Segmented Sub-Tab Switcher
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  segmentBtnActive: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  segmentTextActive: { color: '#0d9488', fontWeight: '800' },

  headerBox: { backgroundColor: '#ffffff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  catChipActive: { backgroundColor: '#0d9488' },
  catChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  catChipTextActive: { color: '#ffffff', fontWeight: '700' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  highlightedCard: {
    borderColor: '#0d9488',
    borderWidth: 2,
    backgroundColor: '#f0fdfa',
  },
  cardHeader: { flexDirection: 'row', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdfa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0d9488',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#0f766e' },
  name: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  category: { fontSize: 12, color: '#64748b', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  price: { fontSize: 18, fontWeight: '800', color: '#0d9488' },
  perHour: { fontSize: 11, color: '#94a3b8' },
  bio: { fontSize: 13, color: '#475569', marginVertical: 10, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  profileBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 9,
    borderRadius: 10,
  },
  profileBtnText: { color: '#0f766e', fontSize: 11.5, fontWeight: '700' },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingVertical: 9,
    borderRadius: 10,
  },
  chatBtnText: { color: '#0d9488', fontSize: 11.5, fontWeight: '700' },
  bookBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#0d9488',
    paddingVertical: 9,
    borderRadius: 10,
  },
  bookBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 11.5 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 10, marginBottom: 4 },
  valueText: { fontSize: 14, fontWeight: '600', color: '#0f766e' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  inputIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    fontSize: 13.5,
    color: '#0f172a',
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#0d9488',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },

  // My Bookings Tab Styles
  bookingsSubHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bookingHelperName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  bookingIdText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPending: { backgroundColor: '#fffbe6' },
  statusAccepted: { backgroundColor: '#ecfdf5' },
  statusCompleted: { backgroundColor: '#f0f9ff' },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  statusPendingText: { color: '#d97706' },
  statusAcceptedText: { color: '#059669' },
  statusCompletedText: { color: '#0284c7' },
  bookingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 3,
  },
  bookingDetailText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  bookingPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  bookingPhotoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  bookingFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  bookingAmountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  bookingAmountVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0d9488',
  },
  editBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#0d9488',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editBookingBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0d9488',
  },
  cancelBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cancelBookingBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ef4444',
  },
});

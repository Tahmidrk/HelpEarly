import {FormTextInput as TextInput} from '../components/FormLayout';
import DateInput from '../components/DateInput';
import BookingInput from '../components/BookingInput';
import { FormScrollView as ScrollView } from '../components/FormLayout';
import { FormModal as Modal } from '../components/FormLayout';
import { Alert } from '../components/Feedback';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { helpersAPI, bookingsAPI, reviewsAPI, messagesAPI, withPhoto, bookingDate } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MapViewModal from '../components/MapViewModal';
import { useNotifications } from '../context/NotificationContext';

export default function HelperDetailScreen({ route, navigation }) {
  const { revision } = useNotifications('helpers');
  const { user, addBooking } = useAuth();
  const { helperId, helperData, autoOpenBooking } = route.params || {};
  const [helper, setHelper] = useState(helperData || null);
  const [loading, setLoading] = useState(!helperData);
  const [bookingModal, setBookingModal] = useState(!!autoOpenBooking);
  const [successModal, setSuccessModal] = useState(false);

  useEffect(() => {
    if (autoOpenBooking) {
      setBookingModal(true);
    }
  }, [autoOpenBooking]);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [serviceDate, setServiceDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [serviceTime, setServiceTime] = useState('10:00 AM');
  const [selectedSubService, setSelectedSubService] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [photoAsset, setPhotoAsset] = useState(null);
  const [calendarPickerModal, setCalendarPickerModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [offeredFee, setOfferedFee] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [mapModal, setMapModal] = useState(false);
  const [reviewsModal, setReviewsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingErrors,setBookingErrors]=useState({});

  const pickJobPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Camera roll access is needed to attach photos of the issue.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setPhotoAsset(res.assets[0]);
      setPhotoUri(res.assets[0].uri);
    }
  };

  const [liveReviews, setLiveReviews] = useState([]);

  useEffect(() => {
    if (helperId) {
      loadHelperDetail();
      fetchLiveReviews();
    }
  }, [helperId, revision]);

  const fetchLiveReviews = async () => {
    try {
      const res = await reviewsAPI.getByHelper(helperId);
      const reviewsList = Array.isArray(res) ? res : (res?.reviews || []);
      setLiveReviews(reviewsList);
    } catch (e) {
      console.log('Error loading helper reviews:', e);
    }
  };

  const loadHelperDetail = async () => {
    try {
      if (!helper) setLoading(true);
      const data = await helpersAPI.getById(helperId);
      setHelper(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    const errors={};
    if(!serviceDescription.trim())errors.service='Describe the services you need.';
    if(!Number.isFinite(Number(offeredFee)) || Number(offeredFee)<=0)errors.fee='Enter a positive offered fee.';
    setBookingErrors(errors);
    if(Object.keys(errors).length)return;
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to book a helper.');
      return;
    }
    if (!serviceDate) {
      Alert.alert('Missing Date', 'Please specify preferred date & time.');
      return;
    }

    try {
      setSubmitting(true);
      const householdLocation = user.location;
      if (!serviceDescription.trim() || !householdLocation || !Number.isFinite(Number(offeredFee)) || Number(offeredFee) <= 0) throw new Error('Describe the services, offer a positive fee, and save your address in Profile.');
      const saved = await bookingsAPI.create(await withPhoto({
        helper_id:helper.id, booking_date:bookingDate(serviceDate,serviceTime),
        service_description:serviceDescription.trim(), total_price:Number(offeredFee),
        notes:notes.trim(), address:householdLocation,
      },photoAsset));
      await addBooking();
      setCreatedBooking({...saved,id:`B-${saved.id}`,helper_name:helper.name,service:saved.service_description,amount:saved.total_price,date:serviceDate,time:serviceTime,location:saved.address});
      setBookingModal(false);
      setSuccessModal(true);
      setPhotoUri(null);
      setPhotoAsset(null);
      setSelectedSubService('');
      setNotes('');
    } catch (err) {
      Alert.alert('Booking Failed', err.message || 'Unable to place booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChat = async () => {
    try {
      if (!helper?.user_id) throw new Error('Worker account information is unavailable');
      const conversation = await messagesAPI.getOrCreate(helper.user_id);
      navigation.navigate('Main', {
        screen: 'Explore',
        params: {
          openSubTab: 'chats',
          conversationId: conversation.id,
          helperUserId: helper.user_id,
          helperProfileId: helper.id,
          helperName: helper.name,
        },
      });
    } catch (error) {
      Alert.alert('Chat Error', error.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </SafeAreaView>
    );
  }

  if (!helper || Number(helper.user_id) === Number(user?.id)) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: '#64748b' }}>Helper details not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const primaryCategory =
    helper.activeCategoryDisplay || helper.primary_category || helper.category || helper.services?.[0]?.category_name || 'Category not set';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Helper Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Helper Top Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{helper.name?.charAt(0) || 'H'}</Text>
          </View>
          <Text style={styles.name}>{helper.name}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{primaryCategory}</Text>
            </View>
            {helper.is_verified && <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#0d9488" />
              <Text style={styles.verifiedBadgeText}>Verified Worker</Text>
            </View>}
          </View>

          <TouchableOpacity style={styles.locationContainer} onPress={() => setMapModal(true)} activeOpacity={0.8}>
            <Ionicons name="location" size={15} color="#0d9488" />
            <Text style={styles.locationText} numberOfLines={1}>{helper.location || 'Dhaka, Bangladesh'}</Text>
            <View style={styles.viewMapChip}>
              <Ionicons name="map" size={12} color="#ffffff" />
              <Text style={styles.viewMapChipText}>View Map</Text>
            </View>
          </TouchableOpacity>

          {(() => {
            const prices = (helper.services || []).map((s) => Number(s.price)).filter((p) => !isNaN(p) && p > 0);
            const minPrice = prices.length ? Math.min(...prices) : Number(helper.hourly_rate || 0);
            const maxPrice = prices.length ? Math.max(...prices) : minPrice;
            const rangeStr = minPrice>0 ? (minPrice === maxPrice ? `৳${minPrice}` : `৳${minPrice} - ৳${maxPrice}`) : 'Offer a fee';

            // Helper-specific unique review count
            const uniqueReviewCount = Number(helper.total_reviews) || 0;

            return (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{rangeStr}</Text>
                  <Text style={styles.statLabel}>Service Rate</Text>
                </View>
                <View style={styles.statDivider} />
                <TouchableOpacity style={styles.statItem} onPress={() => setReviewsModal(true)} activeOpacity={0.75}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="star" size={16} color="#f59e0b" />
                    <Text style={styles.statValue}>{Number(helper.total_reviews) > 0 ? Number(helper.avg_rating).toFixed(1) : 'Not rated'}</Text>
                  </View>
                  <View style={styles.reviewsPill}>
                    <Text style={styles.reviewsPillText}>Reviews</Text>
                    <Ionicons name="chevron-forward" size={10} color="#0d9488" />
                  </View>
                </TouchableOpacity>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{helper.experience_years ?? 0} Yrs</Text>
                  <Text style={styles.statLabel}>Experience</Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Helper</Text>
          <Text style={styles.bioText}>
            {helper.bio || 'No bio provided yet.'}
          </Text>
        </View>

        {/* Contact Phone Box */}
        <View style={styles.contactCard}>
          <Ionicons name="call" size={20} color="#0d9488" />
          <View style={{ flex: 1 }}>
            <Text style={styles.contactLabel}>Direct Contact Phone</Text>
            <Text style={styles.contactValue}>{helper.phone || 'Not provided'}</Text>
          </View>
        </View>

        {/* Live Client Reviews Section */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>Client Reviews ({liveReviews.length})</Text>
            <TouchableOpacity onPress={() => setReviewsModal(true)}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0d9488' }}>See All</Text>
            </TouchableOpacity>
          </View>

          {liveReviews.length > 0 ? (
            liveReviews.map((rev, idx) => (
              <View key={idx} style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0f172a' }}>{rev.reviewer_name || rev.user_name || 'Household Client'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Ionicons name="star" size={13} color="#f59e0b" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{rev.rating}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18 }}>{rev.comment}</Text>
              </View>
            ))
          ) : (
            <TouchableOpacity style={{ backgroundColor: '#f0fdfa', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ccfbf1', alignItems: 'center' }} onPress={() => setReviewsModal(true)}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0f766e' }}>No reviews yet</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Offered Services */}
        {(() => {
          const rawSvcs = helper.services || [];
          const seenSvcs = new Set();
          const uniqueServices = rawSvcs.filter((s) => {
            const nameKey = (s.service_name || '').trim().toLowerCase();
            if (!nameKey || seenSvcs.has(nameKey)) return false;
            seenSvcs.add(nameKey);
            return true;
          });

          const prices = rawSvcs.map((s) => Number(s.price)).filter((p) => !isNaN(p) && p > 0);
          const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : Number(helper?.hourly_rate || 0);

          const servicesWithOther = uniqueServices;

          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Services Offered</Text>
              {servicesWithOther.map((s, idx) => (
                <View key={idx} style={styles.serviceItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{s.service_name}</Text>
                    <Text style={styles.serviceCatTag}>{s.category_name}</Text>
                  </View>
                  <Text style={styles.servicePrice}>৳{s.price}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {/* Action Buttons: Chat & Book */}
        <View style={styles.actionBtnRow}>
          <TouchableOpacity
            style={styles.detailChatBtn}
            onPress={handleChat}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#0d9488" />
            <Text style={styles.detailChatBtnText}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainBookBtn}
            onPress={() => setBookingModal(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#ffffff" />
            <Text style={styles.mainBookBtnText}>Book Helper</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={bookingModal} transparent animationType="slide" onRequestClose={() => setBookingModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book {helper?.name}</Text>
              <TouchableOpacity onPress={() => setBookingModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {(() => {
                // Filter helper services to match primary category or general sub-works
                const rawServices = helper?.services || [];
                const catFilteredServices = rawServices.filter((s) => {
                  if (!s.category_name) return true;
                  return s.category_name.toLowerCase().trim() === primaryCategory.toLowerCase().trim();
                });

                const sourceList = catFilteredServices.length > 0 ? catFilteredServices : rawServices;

                const seenMap = new Map(sourceList.map(s => [s.service_name, {name:s.service_name,price:s.price}]));
                const allSubWorks = Array.from(seenMap.values());

                const prices = rawServices.map((s) => Number(s.price)).filter((p) => !isNaN(p) && p > 0);
                const minPrice = prices.length ? Math.min(...prices) : Number(helper?.hourly_rate || 0);
                const maxPrice = prices.length ? Math.max(...prices) : minPrice;
                const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : minPrice;
                const rangeStr = minPrice>0 ? (minPrice === maxPrice ? `৳${minPrice}` : `৳${minPrice} - ৳${maxPrice}`) : 'Offer a fee';

                // Add 'Other' chip option
                const listWithOther = [
                  ...allSubWorks,
                  { name: 'Other', price: avgPrice, isOther: true },
                ];

                // Selected subwork item
                const selectedItem = listWithOther.find((item) => item.name === selectedSubService);
                const matchedPrice = selectedItem?.price || null;

                return (
                  <>
                    <Text style={styles.inputLabel}>Service Category</Text>
                    <Text style={styles.valueText}>{primaryCategory} ({rangeStr})</Text>

                    {/* Sub-Work Selection Chips */}
                    {listWithOther.length > 0 && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={styles.inputLabel}>Select Specific Sub-Task / Work</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                          {listWithOther.map((item, i) => {
                            const isSelected = selectedSubService === item.name;
                            const chipPriceLabel = item.price ? ` (৳${item.price})` : '';

                            return (
                              <TouchableOpacity
                                key={i}
                                style={[styles.subWorkChip, isSelected && styles.subWorkChipActive]}
                                onPress={() => { setSelectedSubService(isSelected ? '' : item.name); if (!isSelected && !item.isOther) setServiceDescription(item.name); }}
                              >
                                <Text style={[styles.subWorkChipText, isSelected && styles.subWorkChipTextActive]}>
                                  {isSelected ? '✓ ' : ''}{item.name}{chipPriceLabel}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}

                    <Text style={styles.inputLabel}>Services you need *</Text>
                    <BookingInput accessibilityLabel="Services you need" error={bookingErrors.service} style={styles.input} multiline value={serviceDescription} onChangeText={setServiceDescription} placeholder="Describe exactly what needs doing" />
                    <Text style={styles.inputLabel}>Your offered fee (৳) *</Text>
                    <BookingInput accessibilityLabel="Your offered fee" error={bookingErrors.fee} style={styles.input} keyboardType="decimal-pad" value={offeredFee} onChangeText={setOfferedFee} placeholder="Enter your offer" />
                    {/* Selected Work Total Bill Display */}
                    <View style={styles.receiptCard}>
                      <View style={styles.receiptHeaderRow}>
                        <Ionicons name="cash-outline" size={16} color="#0d9488" />
                        <Text style={styles.receiptTitle}>Your Booking Offer</Text>
                      </View>

                      <View style={styles.receiptLine}>
                        <Text style={styles.receiptItemLabel}>Selected Work</Text>
                        <Text style={styles.receiptItemVal}>{serviceDescription || 'Describe the work above'}</Text>
                      </View>

                      <View style={styles.receiptDivider} />

                      <View style={styles.receiptLineTotal}>
                        <Text style={styles.receiptTotalLabel}>
                          Your offered fee
                        </Text>
                        <Text style={styles.receiptTotalVal}>
                          {offeredFee ? `৳${offeredFee}` : 'Enter an offer'}
                        </Text>
                      </View>
                    </View>
                  </>
                );
              })()}

              {/* Separate Date & Time Boxes */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, marginBottom: 4 }}>
                    <Ionicons name="calendar" size={14} color="#0d9488" />
                    <Text style={styles.inputLabelNoMargin}>Date</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.inputIconRow}
                    onPress={() => setCalendarPickerModal(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#0d9488" />
                    <Text style={[styles.inputInner, { paddingVertical: 11 }]}>{serviceDate}</Text>
                    <Ionicons name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, marginBottom: 4 }}>
                    <Ionicons name="time" size={14} color="#0d9488" />
                    <Text style={styles.inputLabelNoMargin}>Time</Text>
                  </View>
                  <View style={styles.inputIconRow}>
                    <Ionicons name="time-outline" size={18} color="#0d9488" />
                    <TextInput
                      style={styles.inputInner}
                      placeholder="e.g. 10:00 AM"
                      value={serviceTime}
                      onChangeText={setServiceTime}
                    />
                  </View>
                </View>
              </View>

              {/* Photo Upload Attachment */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Attach Issue / Work Area Photo (Optional)</Text>
                {photoUri ? (
                  <View style={styles.photoPreviewCard}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreviewImg} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.photoSuccessText}>Photo Attached Successfully</Text>
                      <TouchableOpacity onPress={pickJobPhoto} style={{ marginTop: 4 }}>
                        <Text style={styles.changePhotoText}>Change Photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBtn} onPress={pickJobPhoto}>
                    <Ionicons name="camera-outline" size={18} color="#0d9488" />
                    <Text style={styles.uploadBtnText}>Select Image from Gallery</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Booker Household Location auto-sent info */}
              <View style={styles.autoLocationBox}>
                <Ionicons name="navigate-circle" size={16} color="#0d9488" />
                <Text style={styles.autoLocationText}>
                  Your home location ({user?.location || 'Dhaka Central'}) will be automatically shared with the worker.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Job Description / Address Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 75 }]}
                placeholder="Provide job details or specific instructions..."
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              <TouchableOpacity style={styles.confirmBtn} onPress={handleBook} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Booking Request</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Professional Booking Success Confirmation Modal */}
      <Modal visible={successModal} transparent animationType="fade" onRequestClose={() => setSuccessModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 }]}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#f0fdfa',
                borderWidth: 2,
                borderColor: '#ccfbf1',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="checkmark-sharp" size={32} color="#0d9488" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 6, textAlign: 'center' }}>
              Booking Request Submitted
            </Text>

            <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19, marginBottom: 18 }}>
              Your booking request for <Text style={{ fontWeight: '700', color: '#0f172a' }}>{createdBooking?.service}</Text> has been successfully dispatched to <Text style={{ fontWeight: '700', color: '#0f172a' }}>{createdBooking?.helper_name}</Text>.
            </Text>

            <View style={{ backgroundColor: '#f8fafc', width: '100%', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Booking Reference</Text>
                <Text style={{ fontSize: 12, color: '#0f172a', fontWeight: '800' }}>{createdBooking?.id}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Schedule</Text>
                <Text style={{ fontSize: 12, color: '#0f766e', fontWeight: '700' }}>{createdBooking?.date} at {createdBooking?.time}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Estimated Cost</Text>
                <Text style={{ fontSize: 13, color: '#0d9488', fontWeight: '900' }}>৳{createdBooking?.amount}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f1f5f9',
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={() => setSuccessModal(false)}
              >
                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>Done</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1.4,
                  backgroundColor: '#0d9488',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
                onPress={() => {
                  setSuccessModal(false);
                  navigation.navigate('Main', {
                    screen: 'Explore',
                    params: { openSubTab: 'bookings' },
                  });
                }}
              >
                <Ionicons name="calendar-outline" size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>View My Bookings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Calendar Date Picker Modal */}
      <Modal visible={calendarPickerModal} transparent animationType="fade" onRequestClose={() => setCalendarPickerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 24 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar" size={20} color="#0d9488" />
                <Text style={styles.modalTitle}>Select Preferred Date</Text>
              </View>
              <TouchableOpacity onPress={() => setCalendarPickerModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <DateInput value={serviceDate} onChangeText={setServiceDate} style={styles.input}/>
            <TouchableOpacity onPress={()=>setCalendarPickerModal(false)}><Text style={{color:"#0d9488",fontWeight:"700",textAlign:"center",padding:14}}>Done</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map View Modal */}
      <MapViewModal coordinates={helper}
        visible={mapModal}
        onClose={() => setMapModal(false)}
        locationName={helper?.location || 'Dhaka, Bangladesh'}
      />

      {/* Customer Reviews Modal */}
      {(() => {
        const totalCount = Number(helper.total_reviews) || 0;
        const displayReviews = liveReviews.map(r => ({
          name:r.reviewer_name || 'Customer', rating:r.rating,
          date:new Date(r.created_at).toLocaleDateString(), text:r.comment || '',
        }));

        return (
          <Modal visible={reviewsModal} transparent animationType="slide" onRequestClose={() => setReviewsModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '82%', paddingHorizontal: 20, paddingBottom: 24 }]}>
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccfbf1' }}>
                      <Ionicons name="star" size={16} color="#0d9488" />
                    </View>
                    <Text style={styles.modalTitle}>Reviews & Ratings</Text>
                  </View>
                  <TouchableOpacity onPress={() => setReviewsModal(false)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Rating Overview Summary Banner */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f0fdfa',
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: '#ccfbf1',
                    marginBottom: 16,
                    gap: 14,
                  }}
                >
                  <View style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d9488', borderRadius: 12, width: 56, height: 52 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#ffffff' }}>
                      {Number(helper.total_reviews) > 0 ? Number(helper.avg_rating).toFixed(1) : '—'}
                    </Text>
                    <View style={{ flexDirection: 'row', marginTop: -2 }}>
                      <Ionicons name="star" size={10} color="#fde047" />
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 2 }}>
                      Household Reviews
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 2, marginBottom: 3 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons key={s} name={s <= Math.round(Number(helper.avg_rating)) && totalCount > 0 ? "star" : "star-outline"} size={13} color="#f59e0b" />
                      ))}
                    </View>
                    <Text style={{ fontSize: 12, color: '#475569', fontWeight: '400' }}>
                      {totalCount > 0 ? `${totalCount} customer reviews` : 'No reviews yet'}
                    </Text>
                  </View>
                </View>

                {/* Reviews List */}
                <ScrollView showsVerticalScrollIndicator={false}>
                  {displayReviews.map((rev, idx) => (
                    <View
                      key={idx}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 12,
                        padding: 13,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: idx % 2 === 0 ? '#0d9488' : '#0284c7',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 10,
                          }}
                        >
                          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>{rev.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#0f172a' }}>{rev.name}</Text>
                          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '400' }}>{rev.date}</Text>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                            backgroundColor: '#fffbe8',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: '#fef08a',
                          }}
                        >
                          <Ionicons name="star" size={11} color="#d97706" />
                          <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#b45309' }}>{rev.rating}.0</Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18, fontWeight: '400' }}>
                        {rev.text}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: { padding: 4 },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    elevation: 3,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f0fdfa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0d9488',
    marginBottom: 10,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#0f766e' },
  name: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  categoryBadge: {
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  categoryBadgeText: { color: '#0d9488', fontWeight: '700', fontSize: 12 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedBadgeText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  locationText: { color: '#64748b', fontSize: 13, marginTop: 8, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, height: '80%', backgroundColor: '#e2e8f0' },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  bioText: { fontSize: 13, color: '#475569', lineHeight: 20 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdfa',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    marginBottom: 16,
  },
  contactLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  contactValue: { fontSize: 15, color: '#0f766e', fontWeight: '800', marginTop: 2 },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  serviceName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  serviceCatTag: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  servicePrice: { fontSize: 14, fontWeight: '800', color: '#0d9488' },
  backBtn: { backgroundColor: '#0d9488', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginTop: 12 },
  backBtnText: { color: '#ffffff', fontWeight: '700' },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  detailChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#0d9488',
    paddingVertical: 14,
    borderRadius: 14,
  },
  detailChatBtnText: { color: '#0d9488', fontSize: 16, fontWeight: '800' },
  mainBookBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0d9488',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3,
  },
  mainBookBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
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
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 12, marginBottom: 4 },
  valueText: { fontSize: 14, fontWeight: '700', color: '#0d9488', marginBottom: 6 },
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
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    marginTop: 8,
  },
  locationText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0f766e',
    flex: 1,
    marginRight: 8,
  },
  viewMapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0d9488',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewMapChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  reviewsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reviewsPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d9488',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  confirmBtn: {
    backgroundColor: '#0d9488',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  // Sub-work Chips
  subWorkChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  subWorkChipActive: {
    backgroundColor: '#f0fdfa',
    borderColor: '#0d9488',
  },
  subWorkChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  subWorkChipTextActive: {
    color: '#0d9488',
    fontWeight: '700',
  },

  // Bill Receipt Card Styles
  receiptCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  receiptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  receiptItemLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  receiptItemVal: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#cbd5e1',
    marginVertical: 8,
  },
  receiptLineTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
  },
  receiptTotalVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d9488',
  },

  // Upload Photo Styles
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#0d9488',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
  },
  photoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    marginTop: 4,
  },
  photoPreviewImg: { width: 44, height: 44, borderRadius: 8 },
  photoSuccessText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },
  changePhotoText: { fontSize: 11, fontWeight: '700', color: '#ef4444' },
  photoSuccessCheckBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  photoAttachedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  photoAttachedBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
  },
  photoChangeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0d9488',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },

  // Auto Location Box
  autoLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdfa',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    marginTop: 12,
  },
  autoLocationText: {
    fontSize: 11.5,
    color: '#0f766e',
    fontWeight: '600',
    flex: 1,
  },

  // Calendar Modal Styles
  calendarGridContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
  },
  calendarDayBtn: {
    width: `${100 / 7}%`,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarDayBtnActive: {
    backgroundColor: '#0d9488',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  calendarDayTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
});

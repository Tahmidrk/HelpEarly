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
  ScrollView,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { jobsAPI, helpersAPI, withPhoto } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MapViewModal from '../components/MapViewModal';
import { useNotifications } from '../context/NotificationContext';

const WORK_CATEGORIES = ['Cleaning', 'Plumbing', 'Electrical', 'Gardening', 'Babysitting', 'Moving', 'Cooking'];

export default function JobsScreen({ navigation, route }) {
  const { revision } = useNotifications();
  const { user, activeRole, updateUserProfile, saveWorkerSettings } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postModal, setPostModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'my_posts'

  // Household Client Profile Modal State
  const [selectedClientProfile, setSelectedClientProfile] = useState(null);

  // Worker First-Time Setup Modal State
  const [workerSetupModal, setWorkerSetupModal] = useState(false);
  const [workerSubWorks, setWorkerSubWorks] = useState('');
  const [workerRate, setWorkerRate] = useState('');
  const [workerLocation, setWorkerLocation] = useState('');
  const [savingWorkerSetup, setSavingWorkerSetup] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Cleaning');
  const [categoryDropdown, setCategoryDropdown] = useState(false);
  const [budget, setBudget] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [photoAsset, setPhotoAsset] = useState(null);
  const [posting, setPosting] = useState(false);

  // Map Modal
  const [mapModal, setMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState('Dhaka, Bangladesh');

  // Apply / Bargain Modal State
  const [applyModalJob, setApplyModalJob] = useState(null);
  const [bargainBudget, setBargainBudget] = useState('');
  const [appliedJobIds, setAppliedJobIds] = useState({});
  const [applicationSuccessModal, setApplicationSuccessModal] = useState(null);

  // View details modal
  const [selectedJob, setSelectedJob] = useState(null);
  useEffect(()=>{
    if(!route?.params?.jobId) return;
    jobsAPI.getOne(route.params.jobId).then(setSelectedJob).catch(error=>Alert.alert('Job unavailable',error.message));
  },[route?.params?.jobId,revision]);

  useFocusEffect(
    React.useCallback(() => {
      loadJobs();
      checkWorkerSetup();
    }, [user, activeRole])
  );

  useEffect(() => {
    loadJobs();
    checkWorkerSetup();
  }, [user, activeRole]);

  const checkWorkerSetup = async () => {
    if (activeRole === 'helper' && user?.id) {
      if (!user?.helperProfile?.services?.length) {
        setWorkerLocation(user.location || '');
        setWorkerRate(user?.helperProfile?.hourly_rate ? String(user.helperProfile.hourly_rate) : '');
        setWorkerSetupModal(true);
      }
    }
  };

  const handleSaveWorkerSetup = async () => {
    if (!workerSubWorks.trim() || !workerRate.trim()) {
      Alert.alert('Required Fields', 'Please list your sub-works and set your rate.');
      return;
    }
    if (!user?.location && !workerLocation.trim()) {
      Alert.alert('Location Required', 'Please enter your primary service location.');
      return;
    }

    try {
      setSavingWorkerSetup(true);
      const locToSave = workerLocation.trim() || user?.location;
      const rate = Number(workerRate.trim());
      if (!Number.isFinite(rate) || rate < 0) throw new Error('Enter a valid service rate');
      await updateUserProfile({ location: locToSave });
      await saveWorkerSettings({
        category: user.primary_category || user.category,
        hourly_rate: rate,
        bio: user?.helperProfile?.bio || '',
        experience_years: Number(user?.helperProfile?.experience_years || 0),
        services: workerSubWorks.split(',').map((name) => ({ service_name: name.trim(), price: rate })).filter((service) => service.service_name),
      });
      setWorkerSetupModal(false);
      Alert.alert('Profile Complete! 🎉', 'Your service rate, sub-works, and location have been configured.');
    } catch (e) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSavingWorkerSetup(false);
    }
  };

  useEffect(() => {
    // Automatically pre-fill poster location with user home address when modal opens
    if (user?.location) {
      setLocation(user.location);
    } else {
      setLocation('Dhaka, Bangladesh');
    }
  }, [user, postModal]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const [data, applicationRows] = await Promise.all([
        activeRole === 'household' ? jobsAPI.getMine() : jobsAPI.getAll(),
        activeRole === 'helper' ? jobsAPI.getApplications() : Promise.resolve([]),
      ]);
      setJobs(Array.isArray(data) ? data : []);
      setAppliedJobIds(Object.fromEntries(applicationRows.map((application) => [application.job_id, {
        status: application.status,
        offeredRate: application.proposed_price,
      }])));
    } catch (err) {
      Alert.alert('Could Not Load Jobs', err.message);
    } finally {
      setLoading(false);
    }
  };

  const pickJobPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required to upload photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoAsset(result.assets[0]);
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.log('Error picking photo:', err);
    }
  };

  const handleCreateJob = async () => {
    if (!title.trim() || !budget.trim() || !description.trim() || !preferredDate.trim()) {
      Alert.alert('Required Fields', 'Please enter a job title, budget, preferred date, and description.');
      return;
    }
    try {
      setPosting(true);
      const newJobPayload = {
        title: title.trim(),
        category,
        budget: parseFloat(budget),
        preferred_date: preferredDate.trim(),
        location: location.trim() || user?.location || 'Dhaka, Bangladesh',
        description: description.trim(),
      };

      const createdJob = await jobsAPI.create(await withPhoto(newJobPayload, photoAsset));
      const formattedCreatedJob = {
        ...createdJob,
        category_name: category,
        poster_id: user?.id,
        user_id: user?.id,
        poster_name: user?.name || 'Household User',
      };

      setJobs((prev) => [formattedCreatedJob, ...prev]);
      Alert.alert('Success', 'Your service request post has been published.');
      setPostModal(false);
      setTitle('');
      setCategory('Cleaning');
      setBudget('');
      setPreferredDate('');
      setDescription('');
      setPhotoUri(null);
      setPhotoAsset(null);
      loadJobs();
    } catch (err) {
      Alert.alert('Post Failed', err.message);
    } finally {
      setPosting(false);
    }
  };

  const openApplyModal = (job) => {
    setApplyModalJob(job);
    setBargainBudget(job.budget?.toString() || '');
  };

  const openJobDetails = async (job) => {
    try {
      setSelectedJob(await jobsAPI.getOne(job.rawId || job.id));
    } catch (error) {
      Alert.alert('Could Not Load Request', error.message);
    }
  };

  const handleApplicationAction = async (applicationId, status) => {
    try {
      await jobsAPI.updateApplication(applicationId, { status });
      if (selectedJob) setSelectedJob(await jobsAPI.getOne(selectedJob.id));
      await loadJobs();
      Alert.alert(status === 'accepted' ? 'Helper Selected' : 'Application Rejected', status === 'accepted' ? 'A confirmed booking has been created for this service request.' : 'The application was rejected.');
    } catch (error) {
      Alert.alert('Could Not Update Application', error.message);
    }
  };

  const submitApplicationWithBargain = async () => {
    if (!applyModalJob) return;
    const finalRate = Number(bargainBudget);
    if (!Number.isFinite(finalRate) || finalRate <= 0) {
      Alert.alert('Invalid Offer', 'Enter a positive amount.');
      return;
    }
    try {
      await jobsAPI.apply(applyModalJob.rawId || applyModalJob.id, { proposed_price: finalRate });
      setAppliedJobIds((prev) => ({ ...prev, [applyModalJob.id]: { status: 'pending', offeredRate: finalRate } }));

    // Set custom success modal payload
    setApplicationSuccessModal({
      jobTitle: applyModalJob.title,
      posterName: applyModalJob.poster_name || 'Household Client',
      offeredRate: finalRate,
      location: applyModalJob.location || 'Dhaka, Bangladesh',
    });

      setApplyModalJob(null);
    } catch (error) {
      Alert.alert('Application Failed', error.message);
    }
  };

  const openMapForJob = (loc) => {
    setMapLocation(loc || 'Dhaka, Bangladesh');
    setMapModal(true);
  };

  // Category Filtering for Worker Job Feed
  const workerCategory = (user?.primary_category || user?.category || '').toLowerCase();
  
  const displayedJobs = jobs.filter((job) => {
    if (activeRole !== 'helper') return true;
    if (activeTab === 'my_posts') {
      return !!appliedJobIds[job.id];
    }
    // In Available Requests: filter out already applied jobs
    if (appliedJobIds[job.id]) return false;

    const jobCat = (job.category_name || job.category || '').toLowerCase();
    return !!workerCategory && (jobCat.includes(workerCategory) || workerCategory.includes(jobCat));
  });

  return (
    <View style={styles.container}>

      {/* Post Request Action Bar (Household users) */}
      {activeRole === 'household' && (
        <View style={styles.postBarContainer}>
          <TouchableOpacity
            style={styles.postBtnFull}
            onPress={() => setPostModal(true)}
            activeOpacity={0.85}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#0d9488', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="add" size={20} color="#ffffff" />
            </View>
            <Text style={styles.postBtnFullText}>Post New Request</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Worker Job Feed Tabs (Available Requests vs My Applications) */}
      {activeRole === 'helper' && (
        <View style={styles.tabHeaderContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
            onPress={() => setActiveTab('all')}
          >
            <Ionicons name="briefcase-outline" size={16} color={activeTab === 'all' ? '#0d9488' : '#64748b'} />
            <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>Available Requests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'my_posts' && styles.tabBtnActive]}
            onPress={() => setActiveTab('my_posts')}
          >
            <Ionicons name="paper-plane-outline" size={16} color={activeTab === 'my_posts' ? '#0d9488' : '#64748b'} />
            <Text style={[styles.tabBtnText, activeTab === 'my_posts' && styles.tabBtnTextActive]}>
              My Applications ({Object.keys(appliedJobIds).length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sub Header Title */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0d9488' }}>
          {activeRole === 'household'
            ? 'Your Posted Requests'
            : activeTab === 'my_posts'
            ? 'Applied Jobs & Offered Rates'
            : 'Available Requests'}
        </Text>
      </View>

      {/* Job List */}
      {loading ? (
        <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayedJobs}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyTitle}>
                {activeRole === 'household' ? 'No Active Service Requests' : 'No Service Requests Available'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const appState = appliedJobIds[item.id];
            const isApplied = appState?.status === 'pending' || appState?.status === 'applied';
            const isAccepted = appState?.status === 'accepted';

            return (
              <View style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.jobTitle}>{item.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <Text style={styles.jobCategoryBadge}>{item.category_name || item.category || 'General'}</Text>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 }}
                        onPress={() => openMapForJob(item.location)}
                      >
                        <Ionicons name="location-sharp" size={13} color="#0d9488" />
                        <Text style={styles.jobLocationText} numberOfLines={1} ellipsizeMode="tail">
                          {item.location || 'Dhaka, Bangladesh'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.budgetBadge}>
                    <Text style={styles.budgetLabel}>Budget</Text>
                    <Text style={styles.budgetText}>
                      ৳{appState?.offeredRate || item.budget}
                    </Text>
                  </View>
                </View>

                {/* Photo indicator badge if attached */}
                {item.photo_urls?.[0] && (
                  <View>
                    <Image source={{ uri: item.photo_urls[0] }} style={{ width: '100%', height: 170, borderRadius: 12, marginTop: 10 }} resizeMode="cover" />
                    <View style={styles.photoIndicatorPill}>
                      <Ionicons name="image-outline" size={13} color="#0d9488" />
                      <Text style={styles.photoIndicatorText}>Photo Attached</Text>
                    </View>
                  </View>
                )}

                <View style={styles.jobFooter}>
                  <TouchableOpacity
                    style={{ flex: 1, marginRight: 8 }}
                    onPress={() => {
                      setSelectedClientProfile({
                        id: item.poster_id || item.user_id,
                        name: item.poster_name || 'Household Customer',
                        location: item.location || 'Dhaka, Bangladesh',
                      });
                    }}
                  >
                    <Text style={styles.postedBy} numberOfLines={1} ellipsizeMode="tail">
                      Posted by <Text style={{ color: '#0d9488', fontWeight: '700' }}>{item.poster_name || 'Household Customer'}</Text>
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.detailsBtn}
                      onPress={() => openJobDetails(item)}
                    >
                      <Ionicons name="eye-outline" size={14} color="#0d9488" />
                      <Text style={styles.detailsBtnText}>Details</Text>
                    </TouchableOpacity>

                    {activeRole === 'helper' && (
                      <>
                        {isAccepted ? (
                          <View style={{ backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                            <Text style={{ color: '#15803d', fontWeight: '800', fontSize: 11.5 }}>✓ Accepted</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles.applyBtn,
                              isApplied && { backgroundColor: '#fef3c7', borderColor: '#fde047' },
                            ]}
                            onPress={() => {
                              if (!isApplied) {
                                openApplyModal(item);
                              }
                            }}
                            disabled={isApplied}
                          >
                            <Text
                              style={[
                                styles.applyBtnText,
                                isApplied && { color: '#b45309' },
                              ]}
                            >
                              {isApplied ? 'Applied' : 'Apply Now'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Post Job Modal */}
      <Modal visible={postModal} transparent animationType="slide" onRequestClose={() => setPostModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="add-circle" size={22} color="#0d9488" />
                <Text style={styles.modalTitle}>Post Service Request</Text>
              </View>
              <TouchableOpacity onPress={() => setPostModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingBottom: 10 }}>
              <Text style={styles.label}>Job Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Need Electrician for Circuit Repair"
                value={title}
                onChangeText={setTitle}
              />

              {/* Category Dropdown Picker */}
              <Text style={styles.label}>Work Category</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setCategoryDropdown(!categoryDropdown)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownBtnText}>{category}</Text>
                <Ionicons name={categoryDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
              </TouchableOpacity>

              {categoryDropdown && (
                <View style={styles.dropdownMenu}>
                  {WORK_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.dropdownItem, category === cat && styles.dropdownItemActive]}
                      onPress={() => {
                        setCategory(cat);
                        setCategoryDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, category === cat && styles.dropdownItemTextActive]}>
                        {cat}
                      </Text>
                      {category === cat && <Ionicons name="checkmark" size={16} color="#0d9488" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Budget Range Input */}
              <Text style={styles.label}>Offered Budget Range (৳)</Text>
              <View style={styles.inputIconRow}>
                <Ionicons name="cash-outline" size={18} color="#0d9488" />
                <TextInput
                  style={styles.inputInner}
                  placeholder="e.g. 500 - 800"
                  keyboardType="default"
                  value={budget}
                  onChangeText={setBudget}
                />
              </View>

              {/* Location Input with Map Launcher */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Text style={styles.labelNoMargin}>Location / Address</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => openMapForJob(location || user?.location)}
                >
                  <Ionicons name="map-outline" size={15} color="#0d9488" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0d9488' }}>View Map</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputIconRow, { marginTop: 6 }]}>
                <Ionicons name="location-outline" size={18} color="#0d9488" />
                <TextInput
                  style={styles.inputInner}
                  placeholder="Enter your address..."
                  value={location}
                  onChangeText={setLocation}
                />
              </View>

              <Text style={styles.label}>Preferred Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-09-15"
                value={preferredDate}
                onChangeText={setPreferredDate}
              />
              <Text style={styles.label}>Job Description / Instructions</Text>
              <TextInput
                style={[styles.input, { height: 85, textAlignVertical: 'top' }]}
                placeholder="Explain the work required in detail..."
                multiline
                value={description}
                onChangeText={setDescription}
              />

              {/* Photo Upload (Optional) */}
              <Text style={styles.label}>Upload Photo (Optional)</Text>
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

              <TouchableOpacity style={styles.submitPostBtn} onPress={handleCreateJob} disabled={posting}>
                {posting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitPostBtnText}>Publish Request</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* View Job Details Modal */}
      <Modal visible={!!selectedJob} transparent animationType="slide" onRequestClose={() => setSelectedJob(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text" size={20} color="#0d9488" />
                <Text style={styles.modalTitle}>Request Details</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedJob(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: '#f0fdfa', padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#ccfbf1' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{selectedJob?.title}</Text>
                <Text style={{ fontSize: 12, color: '#0f766e', fontWeight: '700', marginTop: 4 }}>
                  Category: {selectedJob?.category_name || selectedJob?.category}
                </Text>
              </View>

              <View style={{ gap: 12, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                    onPress={() => {
                      setSelectedClientProfile({
                        id: selectedJob?.poster_id || selectedJob?.user_id,
                        name: selectedJob?.poster_name || 'Household Customer',
                        location: selectedJob?.location || 'Dhaka, Bangladesh',
                      });
                    }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#0d9488', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>
                        {selectedJob?.poster_name ? selectedJob.poster_name.charAt(0).toUpperCase() : 'C'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>Posted By</Text>
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0d9488' }}>
                        {selectedJob?.poster_name || 'Household Customer'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {activeRole === 'helper' && <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0d9488', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                    onPress={() => {
                      const clientObj = {
                        id: selectedJob?.poster_id || selectedJob?.user_id,
                        name: selectedJob?.poster_name || 'Household Customer',
                      };
                      setSelectedJob(null);
                      navigation?.navigate('Inbox', { helperUserId: clientObj.id, helperName: clientObj.name });
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={14} color="#ffffff" />
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#ffffff' }}>Chat</Text>
                  </TouchableOpacity>}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="cash" size={16} color="#0d9488" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Offered Budget</Text>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0d9488' }}>৳{selectedJob?.budget}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="location" size={16} color="#0d9488" />
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Location</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0f172a' }}>
                      {selectedJob?.location || 'Dhaka, Bangladesh'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0d9488', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                    onPress={() => openMapForJob(selectedJob?.location)}
                  >
                    <Ionicons name="map" size={14} color="#ffffff" />
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#ffffff' }}>Open Map</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Job Description</Text>
                <Text style={{ fontSize: 13, color: '#334155', lineHeight: 19 }}>{selectedJob?.description}</Text>
              </View>

              {selectedJob?.photo_urls?.[0] && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>Attached Photo</Text>
                  <Image
                    source={{ uri: selectedJob.photo_urls[0] }}
                    style={{ width: '100%', height: 180, borderRadius: 12, resizeMode: 'cover' }}
                  />
                </View>
              )}

              {activeRole === 'household' && (
                <View style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 8 }}>Applications</Text>
                  {selectedJob?.applications?.length ? selectedJob.applications.map((application) => (
                    <View key={application.id} style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>{application.helper_name}</Text>
                      <Text style={{ fontSize: 12, color: '#0d9488', fontWeight: '700', marginTop: 2 }}>Offered rate: ৳{application.proposed_price}</Text>
                      {application.cover_message ? <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{application.cover_message}</Text> : null}
                      {application.status === 'pending' ? (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity style={[styles.applyBtn, { flex: 1, alignItems: 'center' }]} onPress={() => handleApplicationAction(application.id, 'accepted')}>
                            <Text style={styles.applyBtnText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={{ flex: 1, alignItems: 'center', backgroundColor: '#fee2e2', paddingVertical: 6, borderRadius: 8 }} onPress={() => handleApplicationAction(application.id, 'rejected')}>
                            <Text style={{ color: '#b91c1c', fontWeight: '800', fontSize: 12 }}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      ) : <Text style={{ fontSize: 12, color: application.status === 'accepted' ? '#15803d' : '#64748b', fontWeight: '700', marginTop: 6 }}>{application.status}</Text>}
                    </View>
                  )) : <Text style={{ fontSize: 12, color: '#64748b' }}>No applications yet.</Text>}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.submitPostBtn, { marginTop: 10 }]} onPress={() => setSelectedJob(null)}>
              <Text style={styles.submitPostBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Household Client Profile Modal */}
      <Modal visible={!!selectedClientProfile} transparent animationType="slide" onRequestClose={() => setSelectedClientProfile(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 22 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Client Profile</Text>
              <TouchableOpacity onPress={() => setSelectedClientProfile(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#0d9488', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 26 }}>
                  {selectedClientProfile?.name ? selectedClientProfile.name.charAt(0).toUpperCase() : 'C'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>{selectedClientProfile?.name}</Text>
              </View>

              {selectedClientProfile?.joined ? <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 2 }}>{selectedClientProfile.joined}</Text> : null}
            </View>

            <View style={{ backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 10, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="location" size={16} color="#0d9488" />
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600', flex: 1 }}>{selectedClientProfile?.location}</Text>
              </View>
            </View>

            {activeRole === 'helper' && <TouchableOpacity
              style={{ width: '100%', backgroundColor: '#0d9488', paddingVertical: 13, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 }}
              onPress={() => {
                const clientObj = {
                  id: selectedClientProfile?.id,
                  name: selectedClientProfile?.name || 'Household Customer',
                };
                setSelectedClientProfile(null);
                navigation?.navigate('Inbox', { helperUserId: clientObj.id, helperName: clientObj.name });
              }}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14.5 }}>Chat Client</Text>
            </TouchableOpacity>}
          </View>
        </View>
      </Modal>

      {/* Apply / Bargain Offer Modal */}
      <Modal visible={!!applyModalJob} transparent animationType="fade" onRequestClose={() => setApplyModalJob(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 22 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="pricetag" size={22} color="#0d9488" />
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#0f172a' }}>Apply & Offer Rate</Text>
              </View>
              <TouchableOpacity onPress={() => setApplyModalJob(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#f0fdfa', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ccfbf1', marginBottom: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>{applyModalJob?.title}</Text>
              <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Client's Original Budget: <Text style={{ fontWeight: '800', color: '#0d9488' }}>৳{applyModalJob?.budget}</Text></Text>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>Your Offered Rate (৳ BDT)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0d9488', marginRight: 6 }}>৳</Text>
              <TextInput
                style={{ flex: 1, height: 46, fontSize: 16, fontWeight: '700', color: '#0f172a' }}
                placeholder="Enter rate or accept budget"
                keyboardType="numeric"
                value={bargainBudget}
                onChangeText={setBargainBudget}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#0d9488', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                onPress={submitApplicationWithBargain}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>Send Offer & Apply</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                onPress={() => setApplyModalJob(null)}
              >
                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Application Submitted Success Modal (Matching Booking Confirmation Style) */}
      <Modal visible={!!applicationSuccessModal} transparent animationType="fade" onRequestClose={() => setApplicationSuccessModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 24, alignItems: 'center' }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0d9488', marginBottom: 14 }}>
              <Ionicons name="checkmark-circle" size={40} color="#0d9488" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 6, textAlign: 'center' }}>
              Application Submitted! 🎉
            </Text>

            <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19, marginBottom: 16 }}>
              Your rate offer of <Text style={{ fontWeight: '800', color: '#0d9488' }}>৳{applicationSuccessModal?.offeredRate}</Text> has been sent to <Text style={{ fontWeight: '700', color: '#0f172a' }}>{applicationSuccessModal?.posterName}</Text> for <Text style={{ fontWeight: '700', color: '#0f172a' }}>"{applicationSuccessModal?.jobTitle}"</Text>.
            </Text>

            <View style={{ width: '100%', backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 18, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location-outline" size={16} color="#0d9488" />
                <Text style={{ fontSize: 12.5, color: '#334155', fontWeight: '600', flex: 1 }}>{applicationSuccessModal?.location}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time-outline" size={16} color="#0d9488" />
                <Text style={{ fontSize: 12.5, color: '#334155', fontWeight: '600' }}>Status: Pending Client Response</Text>
              </View>
            </View>

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                style={{ width: '100%', backgroundColor: '#0d9488', paddingVertical: 13, borderRadius: 12, alignItems: 'center' }}
                onPress={() => {
                  setApplicationSuccessModal(null);
                  setActiveTab('my_posts');
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>View My Applications</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ width: '100%', backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                onPress={() => setApplicationSuccessModal(null)}
              >
                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 13.5 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* First-Time Worker Service Profile Setup Modal */}
      <Modal visible={workerSetupModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 22 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ccfbf1' }}>
                <Ionicons name="construct" size={20} color="#0d9488" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Worker Profile Setup</Text>
            </View>

            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 18 }}>
              Welcome to Helper Mode! Setting your service rate is mandatory so households can estimate job costs.
            </Text>

            {/* Service Rate Input (MANDATORY) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a' }}>
                Service Rate (৳ BDT)
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#ef4444' }}>*REQUIRED</Text>
            </View>
            <View style={[styles.inputIconRow, { marginBottom: 12 }]}>
              <Ionicons name="cash" size={18} color="#0d9488" />
              <TextInput
                style={styles.inputInner}
                placeholder="e.g. 400 (Required)"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={workerRate}
                onChangeText={setWorkerRate}
              />
            </View>

            {/* Sub Works Input (Optional with Auto-Preset) */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Sub-Works / Specializations</Text>
            <TextInput
              style={[styles.input, { height: 65, marginBottom: 12 }]}
              placeholder="List your own services (e.g. Circuit repair, Fan installation)"
              placeholderTextColor="#94a3b8"
              multiline
              value={workerSubWorks}
              onChangeText={setWorkerSubWorks}
            />

            {/* Service Location */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
              Primary Service Location
            </Text>
            <View style={[styles.inputIconRow, { marginBottom: 16 }]}>
              <Ionicons name="location-outline" size={18} color="#0d9488" />
              <TextInput
                style={styles.inputInner}
                placeholder="e.g. Dhanmondi, Dhaka"
                placeholderTextColor="#94a3b8"
                value={workerLocation}
                onChangeText={setWorkerLocation}
              />
            </View>

            <TouchableOpacity
              style={styles.submitPostBtn}
              onPress={handleSaveWorkerSetup}
              disabled={savingWorkerSetup}
            >
              {savingWorkerSetup ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitPostBtnText}>Save & Activate Worker Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map View Modal */}
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
  tabHeaderContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 4,
  },
  tabBtnActive: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabBtnTextActive: { color: '#0d9488', fontWeight: '800' },

  postBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  postBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#0d9488',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  postBtnFullText: { color: '#0d9488', fontWeight: '800', fontSize: 15 },
  jobCard: {
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
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  jobTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  jobCategoryBadge: { fontSize: 11, fontWeight: '700', color: '#0d9488', backgroundColor: '#f0fdfa', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  jobLocationText: { fontSize: 12, color: '#64748b', fontWeight: '600', flexShrink: 1 },
  budgetBadge: { backgroundColor: '#f0fdfa', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#ccfbf1', alignItems: 'center' },
  budgetLabel: { fontSize: 10, fontWeight: '700', color: '#0f766e' },
  budgetText: { color: '#0d9488', fontWeight: '900', fontSize: 14 },
  jobDesc: { fontSize: 13, color: '#334155', marginVertical: 10, lineHeight: 18 },
  photoIndicatorPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdfa', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  photoIndicatorText: { fontSize: 11, fontWeight: '700', color: '#0d9488' },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  postedBy: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#0d9488' },
  detailsBtnText: { color: '#0d9488', fontWeight: '700', fontSize: 11.5 },
  applyBtn: { backgroundColor: '#0d9488', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  applyBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 15, color: '#64748b', marginTop: 10, fontWeight: '700' },
  emptySub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 10, marginBottom: 4 },
  labelNoMargin: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
  },
  dropdownBtn: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownBtnText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  dropdownMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    marginTop: 4,
    elevation: 3,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: { backgroundColor: '#f0fdfa' },
  dropdownItemText: { fontSize: 13.5, color: '#334155', fontWeight: '500' },
  dropdownItemTextActive: { color: '#0d9488', fontWeight: '800' },
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
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  uploadBtnText: { color: '#0d9488', fontWeight: '700', fontSize: 13 },
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
  submitPostBtn: {
    backgroundColor: '#0d9488',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  submitPostBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});

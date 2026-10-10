import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import MapViewModal from '../components/MapViewModal';

export default function ProfileScreen({ navigation }) {
  const { user, logout, activeRole, switchMode, updateUserProfile, saveWorkerSettings } = useAuth();
  
  // Mandatory Location Modal for new/unconfigured accounts
  const [mandatoryLocModal, setMandatoryLocModal] = useState(false);
  const [mandatoryLocation, setMandatoryLocation] = useState('');

  // Separate edit mode toggles for distinct cards
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [location, setLocation] = useState(user?.location || '');

  // Map Modal
  const [mapModal, setMapModal] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
      setLocation(user.location || '');

      if (!user.location || user.location.trim() === '') {
        setMandatoryLocModal(true);
      }
    }
  }, [user]);

  const handleSaveMandatoryLocation = async () => {
    if (!mandatoryLocation.trim()) {
      Alert.alert('Required', 'Please enter your primary home/service location.');
      return;
    }
    const loc = mandatoryLocation.trim();
    try {
      await updateUserProfile({ location: loc });
      setLocation(loc);
      setMandatoryLocModal(false);
      Alert.alert('Location Saved', 'Your primary location has been updated successfully.');
    } catch (error) {
      Alert.alert('Save Failed', error.message);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Validation Error', 'Location address is required.');
      return;
    }
    try {
      await updateUserProfile({ name: name.trim(), phone: phone.trim(), location: location.trim() });
      Alert.alert('Success', 'Profile information updated successfully!');
      return true;
    } catch (error) {
      Alert.alert('Save Failed', error.message);
      return false;
    }
  };

  // Worker Mode editable state (Itemized services with prices)
  const [workerCategory, setWorkerCategory] = useState(user?.primary_category || user?.category || '');
  const [workerServicesList, setWorkerServicesList] = useState(user?.helperProfile?.services || []);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [workerBio, setWorkerBio] = useState(user?.helperProfile?.bio || '');
  const [workerRate, setWorkerRate] = useState(user?.helperProfile?.hourly_rate ? String(user.helperProfile.hourly_rate) : '0');
  const [workerExp, setWorkerExp] = useState(user?.helperProfile?.experience_years ? String(user.helperProfile.experience_years) : '0');

  useEffect(() => {
    const profile = user?.helperProfile;
    if (!profile) return;
    setWorkerCategory(user.primary_category || user.category || '');
    setWorkerServicesList(profile.services || []);
    setWorkerBio(profile.bio || '');
    setWorkerRate(String(profile.hourly_rate || 0));
    setWorkerExp(String(profile.experience_years || 0));
  }, [user]);

  const handleSaveWorkerSettings = async () => {
    try {
      await saveWorkerSettings({
        category: workerCategory.trim(),
        services: workerServicesList.map(({ id, service_name, price }) => ({ id, service_name, price: Number(price) })),
        bio: workerBio.trim(),
        hourly_rate: Number(workerRate),
        experience_years: Number(workerExp),
      });
      Alert.alert('Success', 'Worker profile and services saved.');
      return true;
    } catch (error) {
      Alert.alert('Save Failed', error.message);
      return false;
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.profileCard} onPress={() => navigation.navigate('Notifications')}><Text style={{ color: '#0d9488', fontWeight: '800' }}>Notifications</Text></TouchableOpacity>
        {user?.role!=='admin' && <TouchableOpacity style={styles.profileCard} onPress={()=>navigation.navigate('Complaints')}><Text style={{color:'#0d9488',fontWeight:'800'}}>My complaints</Text></TouchableOpacity>}
        {user?.role !== 'admin' && <TouchableOpacity style={styles.profileCard} onPress={() => navigation.navigate('Emergency')}><Text style={{ color: '#991b1b', fontWeight: '800' }}>Emergency requests</Text></TouchableOpacity>}
        
        {/* If activeRole is 'helper', render exact Helper Detail profile view from household mode */}
        {activeRole === 'helper' ? (
          <View style={[styles.profileCard, { marginBottom: 16 }]}>
            <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -10 }}>
              <TouchableOpacity
                style={styles.editToggleBtn}
                onPress={() => {
                  if (isEditingProfile) {
                    handleSaveWorkerSettings().then((saved) => saved && setIsEditingProfile(false));
                  } else {
                    setIsEditingProfile(true);
                  }
                }}
              >
                <Ionicons name={isEditingProfile ? 'checkmark-circle' : 'create-outline'} size={15} color="#0d9488" />
                <Text style={styles.editToggleBtnText}>{isEditingProfile ? 'Save Profile' : 'Edit Profile'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>{user?.name?.charAt(0) || 'W'}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={styles.userName}>{user?.name || 'Service Partner'}</Text>
            </View>

            {/* Category & Verified Badges */}
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <View style={{ backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                {isEditingProfile ? (
                  <TextInput
                    style={{ fontSize: 12, fontWeight: '800', color: '#0d9488', padding: 0 }}
                    value={workerCategory}
                    onChangeText={setWorkerCategory}
                  />
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#0d9488' }}>{workerCategory}</Text>
                )}
              </View>

              {user?.helperProfile?.is_verified && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Ionicons name="checkmark-circle" size={14} color="#0d9488" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0d9488' }}>Verified Partner</Text>
              </View>}
            </View>

            {/* Location Pill with View Map */}
            <TouchableOpacity style={{ width: '100%', backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 6 }} onPress={() => setMapModal(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <Ionicons name="location" size={15} color="#0d9488" style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: '#334155', lineHeight: 18 }}>
                  {user?.location || location}
                </Text>
                <View style={{ backgroundColor: '#0d9488', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, color: '#ffffff', fontWeight: '800' }}>View Map</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Stats Row: Service Rate (estimated), Star Rating, Experience */}
            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 14, paddingVertical: 12, marginVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <View style={{ alignItems: 'center' }}>
                {isEditingProfile ? (
                  <TextInput style={{ fontSize: 14, fontWeight: '800', color: '#0d9488', borderBottomWidth: 1, borderBottomColor: '#0d9488', textAlign: 'center', width: 60 }} value={workerRate} onChangeText={setWorkerRate} keyboardType="numeric" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0d9488' }}>৳{workerRate}</Text>
                )}
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>estimated</Text>
              </View>

              <View style={{ width: 1, height: 28, backgroundColor: '#cbd5e1' }} />

              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="star" size={15} color="#f59e0b" />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>{Number(user?.helperProfile?.total_reviews) > 0 ? Number(user.helperProfile.avg_rating).toFixed(1) : 'Not rated'}</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Rating</Text>
              </View>

              <View style={{ width: 1, height: 28, backgroundColor: '#cbd5e1' }} />

              <View style={{ alignItems: 'center' }}>
                {isEditingProfile ? (
                  <TextInput style={{ fontSize: 14, fontWeight: '800', color: '#0d9488', borderBottomWidth: 1, borderBottomColor: '#0d9488', textAlign: 'center', width: 40 }} value={workerExp} onChangeText={setWorkerExp} keyboardType="numeric" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>{workerExp} Yrs</Text>
                )}
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Experience</Text>
              </View>
            </View>

            {/* About Helper Bio Section */}
            <View style={{ width: '100%', alignItems: 'flex-start', marginTop: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 4 }}>About Helper</Text>
              {isEditingProfile ? (
                <TextInput style={[styles.infoInput, { width: '100%', height: 75 }]} multiline value={workerBio} onChangeText={setWorkerBio} />
              ) : (
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18, textAlign: 'left' }}>{workerBio}</Text>
              )}
            </View>

            <TouchableOpacity style={[styles.logoutBtn, { marginTop: 14 }]} onPress={logout}>
              <Ionicons name="log-out-outline" size={16} color="#ef4444" />
              <Text style={styles.logoutBtnText}>Logout Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Household Standard Profile Header */
          <View style={styles.profileCard}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>{user?.name?.charAt(0) || 'U'}</Text>
            </View>

            <Text style={styles.userName}>{user?.name || 'Household User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@helpearly.com'}</Text>

            <View style={styles.nidBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#0d9488" />
              <Text style={styles.nidBadgeText}>{user?.role==='admin'?'Admin account':'Household account'}</Text>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={16} color="#ef4444" />
              <Text style={styles.logoutBtnText}>Logout Account</Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Account Profile Type */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Account Profile Type</Text>
        {user?.role === 'both' ? (
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, activeRole === 'household' && styles.modeChipActive]}
              onPress={() => switchMode('household')}
            >
              <Ionicons name="home-outline" size={16} color={activeRole === 'household' ? '#ffffff' : '#0f766e'} />
              <Text style={[styles.modeChipText, activeRole === 'household' && styles.modeChipTextActive]}>
                Household Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeChip, activeRole === 'helper' && styles.modeChipActive]}
              onPress={() => switchMode('helper')}
            >
              <Ionicons name="construct-outline" size={16} color={activeRole === 'helper' ? '#ffffff' : '#0f766e'} />
              <Text style={[styles.modeChipText, activeRole === 'helper' && styles.modeChipTextActive]}>
                Worker Mode
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.singleRoleBadge}>
            <Ionicons
              name={user?.role === 'admin' ? 'shield-checkmark' : user?.role === 'helper' ? 'construct' : 'home'}
              size={16}
              color="#0d9488"
            />
            <Text style={styles.singleRoleText}>
              Role: {user?.role === 'admin' ? 'System Administrator' : user?.role === 'helper' ? 'Service Worker' : 'Household User'}
            </Text>
          </View>
        )}
      </View>

      {/* Dedicated Worker Services & Rates Customization Card (Worker Mode Only) */}
      {activeRole === 'helper' && (
        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 160 }}>
              <Ionicons name="construct" size={18} color="#0d9488" />
              <Text style={[styles.sectionTitleNoMargin, { flexShrink: 1 }]} numberOfLines={1}>Services & Rates</Text>
            </View>

            <TouchableOpacity
              style={styles.editToggleBtn}
              onPress={() => {
                if (isEditingServices) {
                  handleSaveWorkerSettings().then((saved) => saved && setIsEditingServices(false));
                } else {
                  setIsEditingServices(true);
                }
              }}
            >
              <Ionicons name={isEditingServices ? 'checkmark-circle' : 'create-outline'} size={16} color="#0d9488" />
              <Text style={styles.editToggleBtnText}>{isEditingServices ? 'Save Settings' : 'Edit Services'}</Text>
            </TouchableOpacity>
          </View>

          {/* Itemized Sub-Works with Individual Pricing */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
              Offered Sub-Works & Individual Pricing
            </Text>

            {workerServicesList.map((svc, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdfa', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#ccfbf1', marginBottom: 6 }}>
                {isEditingServices ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <TextInput
                      style={[styles.infoInput, { flex: 1, marginTop: 0, paddingVertical: 4 }]}
                      value={svc.service_name}
                      onChangeText={(val) => {
                        const updated = [...workerServicesList];
                        updated[idx].service_name = val;
                        setWorkerServicesList(updated);
                      }}
                      placeholder="Sub-work name"
                    />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0d9488' }}>৳</Text>
                    <TextInput
                      style={[styles.infoInput, { width: 65, marginTop: 0, paddingVertical: 4, fontWeight: '800', color: '#0d9488' }]}
                      value={svc.price}
                      keyboardType="numeric"
                      onChangeText={(val) => {
                        const updated = [...workerServicesList];
                        updated[idx].price = val;
                        setWorkerServicesList(updated);
                      }}
                      placeholder="Price"
                    />
                    <TouchableOpacity onPress={() => {
                      setWorkerServicesList(workerServicesList.filter((_, i) => i !== idx));
                    }}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Ionicons name="checkmark-circle-outline" size={15} color="#0d9488" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>{svc.service_name}</Text>
                    </View>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0d9488' }}>৳{svc.price}</Text>
                  </>
                )}
              </View>
            ))}

            {/* Add New Sub-Work Row (When in Edit Mode) */}
            {isEditingServices && (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <TextInput
                  style={[styles.infoInput, { flex: 1, marginTop: 0, paddingVertical: 5 }]}
                  placeholder="New sub-service name..."
                  value={newServiceName}
                  onChangeText={setNewServiceName}
                />
                <TextInput
                  style={[styles.infoInput, { width: 70, marginTop: 0, paddingVertical: 5 }]}
                  placeholder="Price (৳)"
                  keyboardType="numeric"
                  value={newServicePrice}
                  onChangeText={setNewServicePrice}
                />
                <TouchableOpacity
                  style={{ backgroundColor: '#0d9488', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                  onPress={() => {
                    if (newServiceName.trim() && newServicePrice.trim()) {
                      setWorkerServicesList([
                        ...workerServicesList,
                        { service_name: newServiceName.trim(), price: newServicePrice.trim() },
                      ]);
                      setNewServiceName('');
                      setNewServicePrice('');
                    }
                  }}
                >
                  <Ionicons name="add" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Account Personal Details (Username, Phone, Email, Address) */}
      <View style={styles.sectionCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionTitleNoMargin}>Personal Details & Address</Text>
          <TouchableOpacity
            style={styles.editToggleBtn}
            onPress={() => {
              if (isEditingPersonal) {
                handleSaveProfile();
                setIsEditingPersonal(false);
              } else {
                setIsEditingPersonal(true);
              }
            }}
          >
            <Ionicons name={isEditingPersonal ? 'checkmark-circle' : 'create-outline'} size={16} color="#0d9488" />
            <Text style={styles.editToggleBtnText}>{isEditingPersonal ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {/* Username */}
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={18} color="#0d9488" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Full Name</Text>
            {isEditingPersonal ? (
              <TextInput style={styles.infoInput} value={name} onChangeText={setName} />
            ) : (
              <Text style={styles.infoVal}>{user?.name || 'Customer'}</Text>
            )}
          </View>
        </View>

        {/* Phone Number */}
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={18} color="#0d9488" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            {isEditingPersonal ? (
              <TextInput style={styles.infoInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            ) : (
              <Text style={styles.infoVal}>{phone}</Text>
            )}
          </View>
        </View>

        {/* Email */}
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color="#0d9488" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Email Address</Text>
            {isEditingPersonal ? (
              <TextInput style={styles.infoInput} value={email} onChangeText={setEmail} keyboardType="email-address" />
            ) : (
              <Text style={styles.infoVal}>{user?.email || 'N/A'}</Text>
            )}
          </View>
        </View>

        {/* Address Location with View in Map */}
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Ionicons name="location-outline" size={18} color="#0d9488" />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.infoLabel}>Primary Service Location</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                onPress={() => setMapModal(true)}
              >
                <Ionicons name="map-outline" size={14} color="#0d9488" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0d9488' }}>View in Map</Text>
              </TouchableOpacity>
            </View>
            {isEditingPersonal ? (
              <TextInput style={styles.infoInput} value={location} onChangeText={setLocation} />
            ) : (
              <Text style={styles.infoVal}>{user?.location || location}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Mandatory Location Setup Modal for Fresh Registrations */}
      <Modal visible={mandatoryLocModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 22, alignItems: 'center' }]}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="location" size={28} color="#0d9488" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>Set Primary Location</Text>
            <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, marginBottom: 16, lineHeight: 18 }}>
              Welcome to At Your Service! Please add your home location address to operate and book verified workers in your area.
            </Text>

            <TextInput
              style={styles.mandatoryInput}
              placeholder="e.g. House 42, Road 7, Dhanmondi, Dhaka"
              value={mandatoryLocation}
              onChangeText={setMandatoryLocation}
            />

            <TouchableOpacity style={styles.saveLocBtn} onPress={handleSaveMandatoryLocation}>
              <Text style={styles.saveLocBtnText}>Save Location & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map View Modal */}
      <MapViewModal
        visible={mapModal}
        onClose={() => setMapModal(false)}
        locationName={user?.location || location}
      />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
  },
  content: { padding: 16, paddingBottom: 30 },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarTextLarge: { fontSize: 32, fontWeight: '800', color: '#ffffff' },
  userName: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  userEmail: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 10 },
  nidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    marginBottom: 14,
  },
  nidBadgeText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },

  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  sectionTitleNoMargin: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modeChipActive: { backgroundColor: '#0d9488' },
  modeChipText: { fontSize: 13, fontWeight: '600', color: '#0f766e' },
  modeChipTextActive: { color: '#ffffff', fontWeight: '700' },
  singleRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdfa',
    padding: 10,
    borderRadius: 10,
  },
  singleRoleText: { fontSize: 13, color: '#0d9488', fontWeight: '700' },

  editToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  editToggleBtnText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  infoVal: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  infoInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13.5,
    color: '#0f172a',
    marginTop: 4,
    fontWeight: '600',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 20, width: '100%' },
  mandatoryInput: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 16,
  },
  saveLocBtn: {
    width: '100%',
    backgroundColor: '#0d9488',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveLocBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
});

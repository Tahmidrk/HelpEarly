import { FormScrollView as ScrollView } from '../components/FormLayout';
import { Alert } from '../components/Feedback';
import useMarketplaceCategories from '../utils/useMarketplaceCategories';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();

  // User Sub-Role: 'household', 'helper' (worker), or 'both'
  const [userRole, setUserRole] = useState('household');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nidNumber, setNidNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Real website categories list (excl. Painting, Tutoring, Handyman)
  const websiteCategories = useMarketplaceCategories();

  // Selected Worker Skill Category
  const [category, setCategory] = useState('');

  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    if (!name || !cleanEmail || !password || !nidNumber) {
      Alert.alert('Required Fields', 'Please fill in Name, Email, Password, and NID Number.');
      return;
    }

    const finalRole = userRole;

    const isWorkerOrBoth = finalRole === 'helper' || finalRole === 'both';
    if (isWorkerOrBoth && !category) return Alert.alert('Category required', 'Select the trade you provide.');

    try {
      setLoading(true);
      await register({
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        password,
        role: finalRole,
        nid_number: nidNumber.trim(),
        category: isWorkerOrBoth ? category : undefined,
      });
      Alert.alert('Registration Successful! 🎉', 'Your account has been created successfully.');
    } catch (err) {
      Alert.alert('Registration Failed', err.message || 'Error creating account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        enabled={Platform.OS === 'ios'} behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Top Branding Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="home" size={28} color="#ffffff" />
            </View>
            <Text style={styles.title}>Join At Your Service</Text>
            <Text style={styles.subtitle}>Create your profile to get started in Bangladesh</Text>
          </View>

          <View style={styles.roleCard}>
              <Text style={styles.roleLabel}>Select your User Profile Type:</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleChip, userRole === 'household' && styles.roleChipActive]}
                  onPress={() => setUserRole('household')}
                >
                  <Ionicons name="home-outline" size={14} color={userRole === 'household' ? '#ffffff' : '#0f766e'} />
                  <Text style={[styles.roleChipText, userRole === 'household' && styles.roleChipTextActive]}>
                    Household
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleChip, userRole === 'helper' && styles.roleChipActive]}
                  onPress={() => setUserRole('helper')}
                >
                  <FontAwesome5 name="tools" size={12} color={userRole === 'helper' ? '#ffffff' : '#0f766e'} />
                  <Text style={[styles.roleChipText, userRole === 'helper' && styles.roleChipTextActive]}>
                    Worker
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleChip, userRole === 'both' && styles.roleChipActive]}
                  onPress={() => setUserRole('both')}
                >
                  <Ionicons name="sync" size={14} color={userRole === 'both' ? '#ffffff' : '#0f766e'} />
                  <Text style={[styles.roleChipText, userRole === 'both' && styles.roleChipTextActive]}>
                    Both (Dual)
                  </Text>
                </TouchableOpacity>
              </View>
              {userRole === 'both' && (
                <Text style={styles.roleHint}>
                  💡 Dual mode: You will have a toggle button to switch between Household and Worker views anytime!
                </Text>
              )}
          </View>

          {/* Card Form */}
          <View style={styles.card}>
            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#0d9488" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Sumaiya Hossain"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <Text style={styles.label}>Email Address *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#0d9488" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={18} color="#0d9488" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="+880 1700000000"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <Text style={styles.label}>National ID (NID Card #) *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="card-outline" size={18} color="#0d9488" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="10, 13, or 17 digit NID number"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={nidNumber}
                onChangeText={setNidNumber}
              />
            </View>

            {/* Worker or Dual Role Specific Category Dropdown Grid */}
            {(userRole === 'helper' || userRole === 'both') && (
              <View style={styles.catSection}>
                <Text style={styles.label}>Select Primary Service Category *</Text>
                <View style={styles.catGrid}>
                  {websiteCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catOption, category === cat && styles.catOptionActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.catOptionText, category === cat && styles.catOptionTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#0d9488" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0fdfa' },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 100, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
  },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 3, textAlign: 'center' },

  accountTypeWrapper: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  accountTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  accountTypeBtnActive: { backgroundColor: '#ffffff', elevation: 2 },
  accountTypeText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  accountTypeTextActive: { color: '#0f766e', fontWeight: '800' },

  roleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  roleLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 6 },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f0fdfa',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  roleChipActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  roleChipText: { color: '#0f766e', fontWeight: '700', fontSize: 12 },
  roleChipTextActive: { color: '#ffffff' },
  roleHint: { fontSize: 11, color: '#0d9488', marginTop: 8, fontStyle: 'italic' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    elevation: 3,
    marginBottom: 10,
  },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 10, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 14, color: '#0f172a' },

  catSection: { marginTop: 6, marginBottom: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catOption: {
    width: '31%',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catOptionActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  catOptionText: { color: '#475569', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  catOptionTextActive: { color: '#ffffff' },

  submitBtn: {
    backgroundColor: '#0d9488',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 22,
  },
  submitBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { color: '#64748b', fontSize: 13 },
  loginLink: { color: '#0d9488', fontWeight: '800', fontSize: 13 },
});

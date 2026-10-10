import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { File } from 'expo-file-system';

// Dynamically determine backend host IP for physical phone (Expo Go), web, or emulator
const getApiBase = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '').replace(/\/api$/, '') + '/api';
  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }

  // Extract host IP address when running via Expo Go on physical device
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.developer?.tool ||
    Constants.experienceUrl;

  if (hostUri && typeof hostUri === 'string') {
    const cleanUri = hostUri.replace('exp://', '').replace('http://', '');
    const hostIp = cleanUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:5000/api`;
    }
  }

  // Explicit Wi-Fi LAN IP fallback for physical phone
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
};

export const API_BASE = getApiBase();
const SERVER_BASE = API_BASE.replace(/\/api\/?$/, '');

export const getMediaUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (/^(https?:|data:|blob:|file:)/i.test(value)) return value;
  return `${SERVER_BASE}/${value.replace(/^\/+/, '')}`;
};

export const getMediaUrls = (value) => {
  if (!value) return [];
  let paths = value;
  if (typeof value === 'string') {
    try { paths = JSON.parse(value); } catch { paths = [value]; }
  }
  return (Array.isArray(paths) ? paths : [paths]).map(getMediaUrl).filter(Boolean);
};

const withMedia = (record) => record ? { ...record, photo_urls: getMediaUrls(record.photos) } : record;

export const apiRequest = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem('token');
  const activeRole = await AsyncStorage.getItem('activeRole');
  const headers = {
    ...(activeRole ? { 'X-Active-Role': activeRole } : {}),
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (options.body instanceof FormData) delete headers['Content-Type'];
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    if (!response.ok) {
      throw new Error(`API Error (${response.status})`);
    }
    throw new Error('Server returned an invalid response');
  }

  if (!response.ok) {
    const error = new Error(data.message || data.error || 'API request failed');
    error.status = response.status;
    throw error;
  }
  return data;
};

export const authAPI = {
  revisions: () => apiRequest('/sync'),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => apiRequest('/auth/me'),
  updateProfile: (data) => apiRequest('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

export const helpersAPI = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest(`/helpers${query}`);
  },
  getMe: () => apiRequest('/helpers/me'),
  saveSettings: (data) => apiRequest('/helpers/settings', { method: 'PUT', body: JSON.stringify(data) }),
  update: (data) => apiRequest('/helpers/me', { method: 'PUT', body: JSON.stringify(data) }),
  getById: (id) => apiRequest(`/helpers/${id}`),
};

export const bookingsAPI = {
  create: async (data) => withMedia(await apiRequest('/bookings', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) })),
  getMyBookings: async () => (await apiRequest('/bookings?limit=1000')).map(withMedia),
  update: (id, data) => apiRequest(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id, status) => apiRequest(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

export const jobsAPI = {
  getAll: async () => (await apiRequest('/jobs?limit=1000')).map(withMedia),
  getMine: async () => (await apiRequest('/jobs/my')).map(withMedia),
  getOne: async (id) => withMedia(await apiRequest(`/jobs/${id}`)),
  getApplications: () => apiRequest('/jobs/applications'),
  create: async (data) => withMedia(await apiRequest('/jobs', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) })),
  apply: (jobId, data) => apiRequest(`/jobs/${jobId}/apply`, { method: 'POST', body: JSON.stringify(data || {}) }),
  updateApplication: (id, data) => apiRequest(`/jobs/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const emergencyAPI = {
  broadcast: (data) => apiRequest('/emergency/notify', { method: 'POST', body: JSON.stringify(data) }),
  list: () => apiRequest('/emergency'),
  accept: (id) => apiRequest(`/emergency/${id}/accept`, { method: 'POST' }),
  decline: (id) => apiRequest(`/emergency/${id}/decline`, { method: 'POST' }),
  cancel: (id) => apiRequest(`/emergency/${id}/cancel`, { method: 'POST' }),
};

export const chatbotAPI = {
  history: () => apiRequest('/chatbot'),
  sendMessage: (message) => apiRequest('/chatbot', { method: 'POST', body: JSON.stringify({ message }) }),
};

export const notificationsAPI = {
  list: () => apiRequest('/notifications'),
  read: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),
  register: (data) => apiRequest('/notifications/devices', { method: 'POST', body: JSON.stringify(data) }),
  removeDevice: (id) => apiRequest(`/notifications/devices/${id}`, { method: 'DELETE' }),
};

export const reviewsAPI = {
  create: (data) => apiRequest('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getByHelper: (helperId) => apiRequest(`/reviews/helper/${helperId}`),
};

export const complaintsAPI = {
  create: (data) => apiRequest('/complaints', { method: 'POST', body: JSON.stringify(data) }),
  getMine: () => apiRequest('/complaints/mine'),
};

export const messagesAPI = {
  conversations: () => apiRequest('/messages/conversations'),
  messages: (id) => apiRequest(`/messages/${id}?limit=1000`),
  getOrCreate: (userId) => apiRequest(`/messages/conversation/${userId}`),
  send: (recipient_id, content) => apiRequest('/messages', { method: 'POST', body: JSON.stringify({recipient_id,content}) }),
};

export async function withPhoto(data, selectedAsset) {
  if (!selectedAsset) return data;
  const asset = typeof selectedAsset === 'string' ? { uri: selectedAsset } : selectedAsset;
  if (!asset.uri) return data;
  const form = new FormData();
  Object.entries(data).forEach(([key,value]) => { if (value != null) form.append(key, String(value)); });
  if (Platform.OS === 'web') {
    const blob = asset.file || await (await fetch(asset.uri)).blob();
    form.append('photos', blob, asset.fileName || `photo-${Date.now()}.${(asset.mimeType || blob.type || 'image/jpeg').split('/')[1] || 'jpg'}`);
  } else {
    form.append('photos', new File(asset.uri), asset.fileName || `photo-${Date.now()}.jpg`);
  }
  return form;
}

export function bookingDate(date, time) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) throw new Error('Use HH:MM or HH:MM AM/PM for time');
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > (match[3] ? 12 : 23) || (match[3] && hour < 1)) throw new Error('Invalid time');
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  const value = new Date(`${date}T${String(hour).padStart(2,'0')}:${match[2]}:00`);
  if (Number.isNaN(value.getTime())) throw new Error('Invalid date');
  return value.toISOString();
}

const rawApiUrl = import.meta.env.VITE_API_URL || '';
const normalizedApiUrl = rawApiUrl.replace(/\/$/, '');
export const API_BASE = normalizedApiUrl
  ? `${normalizedApiUrl.replace(/\/api$/, '')}/api`
  : '/api';
const apiOrigin = normalizedApiUrl.replace(/\/api$/, '');
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || apiOrigin).replace(/\/api\/?$/, '').replace(/\/$/, '') || undefined;
export const getMediaUrl = value => !value || /^(https?:|data:|blob:)/i.test(value) ? value : `${apiOrigin}/${value.replace(/^\/+/, '')}`;

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'X-Active-Role': localStorage.getItem('activeRole') || '',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  // Handle FormData (file uploads)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  let data;
  try {data=await res.json();}
  catch {throw new Error('API returned an invalid response. Check backend deployment and VITE_API_URL.');}

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

// Auth
export const authAPI = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  changePassword: (data) => request('/auth/change-password', { method: 'PUT', body: JSON.stringify(data) }),
  updateProfile: (data) => {
    if (data instanceof FormData) {
      return request('/auth/profile', { method: 'PUT', body: data });
    }
    return request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) });
  },
};

export const chatbotAPI = {
  history: () => request('/chatbot'),
  send: message => request('/chatbot', {method:'POST',body:JSON.stringify({message})}),
};

// Helpers
export const helpersAPI = {
  getAll: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/helpers?${query}`);
  },
  getOne: (id) => request(`/helpers/${id}`),
  getMyProfile: () => request('/helpers/me'),
  update: (data) => request('/helpers/me', { method: 'PUT', body: JSON.stringify(data) }),
  addService: (data) => request('/helpers/services', { method: 'POST', body: JSON.stringify(data) }),
  deleteService: (id) => request(`/helpers/services/${id}`, { method: 'DELETE' }),
};

// Categories
export const categoriesAPI = {
  getAll: () => request('/categories'),
  getOne: (id) => request(`/categories/${id}`),
};

// Bookings
export const bookingsAPI = {
  create: (data) => {
    if (data instanceof FormData) {
      return request('/bookings', { method: 'POST', body: data });
    }
    return request('/bookings', { method: 'POST', body: JSON.stringify(data) });
  },
  getAll: (params) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    return request(`/bookings?${query}`);
  },
  update: (id, data) => request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),
};

// Reviews
export const reviewsAPI = {
  create: (data) => request('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getForHelper: (id, params) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    return request(`/reviews/helper/${id}?${query}`);
  },
};

// Messages
export const messagesAPI = {
  getConversations: () => request('/messages/conversations'),
  getMessages: (conversationId) => request(`/messages/${conversationId}`),
  send: (data) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
  getOrCreateConversation: (userId) => request(`/messages/conversation/${userId}`),
};

// Users
export const usersAPI = {
  getOne: (id) => request(`/users/${id}`),
};

// Complaints
export const complaintsAPI = {
  getContacts: () => request('/complaints/contacts'),
  getMine: () => request('/complaints/mine'),
  create: (data) => request('/complaints', { method: 'POST', body: JSON.stringify(data) }),
  getAll: (params) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    return request(`/complaints?${query}`);
  },
  update: (id, data) => request(`/complaints/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Jobs
export const jobsAPI = {
  create: (data) => {
    if (data instanceof FormData) {
      return request('/jobs', { method: 'POST', body: data });
    }
    return request('/jobs', { method: 'POST', body: JSON.stringify(data) });
  },
  getAll: (params) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    return request(`/jobs?${query}`);
  },
  getOne: (id) => request(`/jobs/${id}`),
  getMyJobs: (params) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    return request(`/jobs/my?${query}`);
  },
  getForHelper: (params) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    return request(`/jobs/for-helper?${query}`);
  },
  apply: (id, data) => request(`/jobs/${id}/apply`, { method: 'POST', body: JSON.stringify(data) }),
  getMyApplications: () => request('/jobs/applications'),
  updateApplication: (id, data) => request(`/jobs/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Admin
export const adminAPI = {
  getStats: () => request('/admin/stats'),
  getUsers: (params) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    return request(`/admin/users?${query}`);
  },
  updateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  verifyHelper: (id, isVerified = true) => request(`/admin/helpers/${id}/verify`, { method: 'PUT', body: JSON.stringify({ is_verified: isVerified }) }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  deleteJob: (id) => request(`/admin/jobs/${id}`, { method: 'DELETE' }),
  deleteReview: (id) => request(`/admin/reviews/${id}`, { method: 'DELETE' }),
};

// Emergency Broadcast
export const emergencyAPI = {
  notify: (data) => request('/emergency/notify', { method: 'POST', body: JSON.stringify(data) }),
  accept: (id) => request(`/emergency/${id}/accept`, { method: 'POST' }),
};

const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs/promises');
const path = require('path');

const baseUrl = process.env.TEST_API_URL || 'http://localhost:5000/api';
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emails = [];
const uploadedFiles = [];

async function request(path, { token, role, method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(role ? { 'X-Active-Role': role } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: expected ${expected}, got ${response.status} (${data.message || 'no message'})`);
  }
  return data;
}

async function multipartRequest(path, { token, fields, file, expected = 201 }) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  if (file) form.append('photos', file, 'mvp-photo.png');
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status !== expected) throw new Error(`POST ${path}: expected ${expected}, got ${response.status} (${data.message || 'no message'})`);
  return data;
}

async function register(role, suffix, categoryId) {
  const email = `mvp-${suffix}-${stamp}@example.test`;
  emails.push(email);
  return request('/auth/register', {
    method: 'POST',
    expected: 201,
    body: {
      name: `MVP ${suffix}`,
      email,
      password: 'testpass123',
      phone: '01700000000',
      nid_number: `NID-${suffix}-${stamp}`,
      role,
      location: 'Dhaka',
      ...(categoryId ? { selectedCategories: [categoryId] } : {}),
    },
  });
}

async function createTestAdmin() {
  const email = `mvp-admin-${stamp}@example.test`;
  emails.push(email);
  const password = 'testpass123';
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, nid_number, role, is_active)
     VALUES ($1, $2, $3, $4, 'admin', true)`,
    ['MVP Admin', email, passwordHash, `NID-admin-${stamp}`]
  );
  return request('/auth/login', { method: 'POST', body: { email, password } });
}

async function main() {
  const categories = await request('/categories');
  const electrical = categories.find((category) => category.name === 'Electrical');
  if (!electrical) throw new Error('Electrical category is missing');

  const household = await register('household', 'household', null);
  const secondHousehold = await register('household', 'household2', null);
  const helper = await register('helper', 'helper', electrical.id);
  const secondHelper = await register('helper', 'helper2', electrical.id);
  if (helper.user.helperProfile.primary_category !== 'Electrical' || helper.user.helperProfile.services.length !== 0) {
    throw new Error('Worker registration assigned the wrong category or default services');
  }

  await request('/auth/login', { method: 'POST', body: { email: household.user.email, password: 'testpass123' } });
  await request('/auth/login', { method: 'POST', body: { email: helper.user.email, password: 'testpass123' } });
  await request('/auth/login', { method: 'POST', body: { email: household.user.email, password: 'incorrect' }, expected: 400 });
  await request('/auth/register', { method: 'POST', expected: 400, body: { name: 'Public Admin', email: `blocked-admin-${stamp}@example.test`, password: 'testpass123', nid_number: `BLOCK-${stamp}`, role: 'admin' } });
  const admin = await createTestAdmin();
  await request(`/admin/helpers/${helper.user.helperProfile.id}/verify`, { token: admin.token, method: 'PUT', body: { is_verified: true } });
  await request('/admin/stats', { token: admin.token });
  const adminUsers = await request('/admin/users?limit=100', { token: admin.token });
  if (!adminUsers.users.some((item) => item.id === helper.user.id)) throw new Error('Admin user listing is incomplete');
  const discovered = await request(`/helpers?category=${electrical.id}`, { token: household.token });
  if (!discovered.helpers.some((item) => item.id === helper.user.helperProfile.id)) throw new Error('Verified helper was not discoverable');

  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const bookingBody = {
    helper_id: helper.user.helperProfile.id,
    booking_date: start.toISOString(),
    end_date: end.toISOString(),
    service_description: 'Repair the main circuit breaker',
    total_price: 1200,
    address: 'Dhaka',
  };
  const booking = await request('/bookings', { token: household.token, method: 'POST', body: bookingBody, expected: 201 });
  await request('/bookings', { token: secondHousehold.token, method: 'POST', body: bookingBody, expected: 409 });
  await request(`/bookings/${booking.id}`, { token: helper.token, role: 'helper', method: 'PUT', body: { status: 'confirmed' } });
  await request(`/bookings/${booking.id}`, { token: helper.token, role: 'helper', method: 'PUT', body: { status: 'in_progress' } });
  await request(`/bookings/${booking.id}`, { token: helper.token, role: 'helper', method: 'PUT', body: { status: 'completed' } });

  const reviewBody = { helper_id: helper.user.helperProfile.id, booking_id: booking.id, rating: 5, comment: 'Excellent work' };
  await request('/reviews', { token: household.token, method: 'POST', body: reviewBody, expected: 201 });
  await request('/reviews', { token: household.token, method: 'POST', body: reviewBody, expected: 409 });

  const complaint = await request('/complaints', { token: household.token, method: 'POST', expected: 201, body: { accused_id: helper.user.id, subject: 'MVP workflow issue', description: 'Test complaint for the completed booking' } });
  await request(`/complaints/${complaint.id}`, { token: admin.token, method: 'PUT', body: { status: 'resolved', admin_notes: 'Verified in automated flow' } });
  const myComplaints = await request('/complaints/mine', { token: household.token });
  if (!myComplaints.some((item) => item.id === complaint.id && item.status === 'resolved')) throw new Error('Complaint status did not persist');
  await request('/complaints', { token: secondHousehold.token, method: 'POST', expected: 403, body: { accused_id: helper.user.id, subject: 'Invalid complaint', description: 'No service relationship' } });

  const conversation = await request(`/messages/conversation/${helper.user.id}`, { token: household.token });
  await request('/messages', { token: household.token, method: 'POST', body: { recipient_id: helper.user.id, content: 'Hello from the MVP test' }, expected: 201 });
  const messages = await request(`/messages/${conversation.id}`, { token: helper.token });
  if (!messages.some((message) => message.content === 'Hello from the MVP test')) throw new Error('Chat message did not persist');

  const jobDate = new Date(start.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const job = await request('/jobs', {
    token: secondHousehold.token,
    method: 'POST',
    expected: 201,
    body: { category_id: electrical.id, title: 'Install a ceiling fan', description: 'Install one ceiling fan safely', budget: 1500, location: 'Dhaka', preferred_date: jobDate },
  });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const jobWithPhoto = await multipartRequest('/jobs', {
    token: household.token,
    fields: { category_id: electrical.id, title: 'Photo evidence job', description: 'A job with a persisted image', budget: 900, location: 'Dhaka', preferred_date: jobDate },
    file: new Blob([png], { type: 'image/png' }),
  });
  const storedPhotoJob = await request(`/jobs/${jobWithPhoto.id}`, { token: household.token });
  if (!storedPhotoJob.photos || !String(storedPhotoJob.photos).includes('/uploads/')) throw new Error('Uploaded job photo path did not persist');
  const storedPaths = typeof storedPhotoJob.photos === 'string' ? JSON.parse(storedPhotoJob.photos) : storedPhotoJob.photos;
  uploadedFiles.push(...storedPaths.map((value) => path.join(__dirname, '..', value.replace(/^\/+/, ''))));
  const firstProposal = await request(`/jobs/${job.id}/apply`, { token: helper.token, role: 'helper', method: 'POST', expected: 201, body: { proposed_price: 1400, cover_message: 'Available' } });
  const secondProposal = await request(`/jobs/${job.id}/apply`, { token: secondHelper.token, role: 'helper', method: 'POST', expected: 201, body: { proposed_price: 1450, cover_message: 'Also available' } });
  const accepted = await request(`/jobs/applications/${firstProposal.id}`, { token: secondHousehold.token, method: 'PUT', body: { status: 'accepted' } });
  if (!accepted.booking || accepted.booking.status !== 'confirmed') throw new Error('Accepted proposal did not create a confirmed booking');
  const jobDetails = await request(`/jobs/${job.id}`, { token: secondHousehold.token });
  const statuses = Object.fromEntries(jobDetails.applications.map((application) => [application.id, application.status]));
  if (statuses[firstProposal.id] !== 'accepted' || statuses[secondProposal.id] !== 'rejected') throw new Error('Proposal statuses were not closed consistently');

  const emergency = await request('/emergency/notify', { token: household.token, method: 'POST', body: { category_name: 'Electrical', location: 'Dhaka', contact_phone: '01700000000' } });
  if (!Number.isInteger(emergency.helpersNotified) || !emergency.alertDetails?.id) throw new Error('Emergency response is invalid');
  const acceptedEmergency = await request(`/emergency/${emergency.alertDetails.id}/accept`, { token: secondHelper.token, role: 'helper', method: 'POST' });
  if (acceptedEmergency.booking?.status !== 'confirmed') throw new Error('Accepted emergency did not create a confirmed booking');

  const persisted = await pool.query('SELECT COUNT(*)::int AS count FROM bookings WHERE id = ANY($1::int[])', [[booking.id, accepted.booking.id]]);
  if (persisted.rows[0].count !== 2) throw new Error('Bookings were not persisted in PostgreSQL');

  console.log(JSON.stringify({
    authentication: 'PASS',
    adminAuthorization: 'PASS',
    helperDiscovery: 'PASS',
    workerCategoryWithoutDefaults: 'PASS',
    directBookingLifecycle: 'PASS',
    overlapConflict: 'PASS',
    reviews: 'PASS',
    complaints: 'PASS',
    photoUploadPersistence: 'PASS',
    chatPersistence: 'PASS',
    proposalToBooking: 'PASS',
    proposalClosure: 'PASS',
    emergencyLifecycle: 'PASS',
    databasePersistence: 'PASS',
  }));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (emails.length) {
      await pool.query("DELETE FROM notifications WHERE type LIKE 'emergency_%' AND data->>'request_id' IN (SELECT e.id::text FROM emergency_requests e JOIN users u ON u.id=e.household_id WHERE u.email=ANY($1::text[]))",[emails]);
      await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);
    }
    await Promise.all(uploadedFiles.map((file) => fs.unlink(file).catch(() => {})));
    await pool.end();
  });

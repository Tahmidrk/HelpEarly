const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../config/db');
const { chat } = require('../controllers/aiAssistant');
const base = process.env.TEST_API_URL;
const results = {};
function pass(name) { results[name] = 'PASS'; console.log('PASS ' + name); }
async function loadClients() {
  const root = path.resolve(__dirname, '../..');
  const esbuild = require('../../client/node_modules/esbuild');
  const compile = async (file, options) => {
    const output = await esbuild.build({ entryPoints: [path.join(root, file)], bundle: true, write: false, platform: 'node', format: 'esm', ...options });
    return import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  };
  const web = await compile('client/src/utils/api.js', { define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: base }) } });
  const mobile = await compile('mobile/src/api/client.js', {
    define: { 'process.env.EXPO_PUBLIC_API_URL': JSON.stringify(base) },
    plugins: [{ name: 'native-protocol-bindings', setup(build) {
      build.onResolve({ filter: /^(react-native|@react-native-async-storage\/async-storage|expo-constants|expo-file-system)$/ }, args => ({ path: args.path, namespace: 'native-protocol' }));
      build.onLoad({ filter: /.*/, namespace: 'native-protocol' }, args => ({ loader: 'js', contents:
        args.path === 'react-native' ? "export const Platform={OS:'android'};" :
        args.path.includes('async-storage') ? "export default {getItem:async key=>globalThis.__nextMobile[key]||null};" :
        args.path === 'expo-file-system' ? 'export class File {}' : 'export default {};' }));
    } }],
  });
  return { web, mobile };
}
async function main() {
  assert(/^http:\/\/127\.0\.0\.1:\d+\/api$/.test(base || ''), 'Next-phase tests refuse remote API');
  assert(/^helpearly_free_test_\d+$/.test(pool.options.database), 'Next-phase tests require suite-owned isolated database');
  let webSession;
  global.localStorage = { getItem: key => webSession?.[key] || null };
  global.__nextMobile = {};
  const { web, mobile } = await loadClients();
  const home = await web.authAPI.login({ email: 'home@fixture.test', password: 'fixture-password' });
  const worker = await web.authAPI.login({ email: 'worker@fixture.test', password: 'fixture-password' });
  const helper = worker.user.helperProfile.id;
  const W = (a, role = a.user.role) => { webSession = { token: a.token, activeRole: role }; };
  const M = (a, role = a.user.role) => { global.__nextMobile = { token: a.token, activeRole: role }; };
  W(home); M(home);
  await web.authAPI.updateProfile({ name: 'Next phase Web profile' });
  assert.equal((await mobile.authAPI.getMe()).name, 'Next phase Web profile');
  await mobile.authAPI.updateProfile({ name: 'Next phase Android profile' });
  assert.equal((await web.authAPI.getMe()).name, 'Next phase Android profile');
  pass('Two-way profiles through actual Web and Android API modules');
  const categories = await web.categoriesAPI.getAll(), category = categories.find(c => c.name === 'Electrical').id;
  const date = new Date(Date.now() + 30 * 86400000).toISOString();
  const job = await web.jobsAPI.create({ category_id: category, title: 'Next phase proposal', description: 'Test fixture only', budget: 500, location: 'Dhaka', preferred_date: date });
  M(worker);
  const proposal = await mobile.jobsAPI.apply(job.id, { proposed_price: 450, cover_message: 'Next phase mobile proposal' });
  assert((await web.jobsAPI.getOne(job.id)).applications.some(a => a.id === proposal.id));
  const accepted = await web.jobsAPI.updateApplication(proposal.id, { status: 'accepted' });
  assert((await mobile.bookingsAPI.getMyBookings()).some(b => b.id === accepted.booking.id));
  await mobile.bookingsAPI.updateStatus(accepted.booking.id, 'completed');
  assert.equal((await web.jobsAPI.getOne(job.id)).status, 'completed');
  M(home);
  await mobile.reviewsAPI.create({ helper_id: helper, booking_id: accepted.booking.id, rating: 4, comment: 'Next phase mobile review' });
  assert((await web.reviewsAPI.getForHelper(helper)).reviews.some(r => r.booking_id === accepted.booking.id));
  pass('Web job → Android proposal → Web acceptance → Android completion/review → Web state');
  const booking = await mobile.bookingsAPI.create({ helper_id: helper, booking_date: new Date(Date.now() + 35 * 86400000).toISOString(), service_description: 'Next phase booking', total_price: 600, address: 'Dhaka' });
  W(worker);
  assert((await web.bookingsAPI.getAll()).some(b => b.id === booking.id));
  await web.bookingsAPI.update(booking.id, { status: 'confirmed' });
  assert.equal((await mobile.bookingsAPI.getMyBookings()).find(b => b.id === booking.id).status, 'confirmed');
  await web.bookingsAPI.update(booking.id, { status: 'completed' });
  W(home);
  await web.reviewsAPI.create({ helper_id: helper, booking_id: booking.id, rating: 5, comment: 'Next phase Web review' });
  assert((await mobile.reviewsAPI.getByHelper(helper)).reviews.some(r => r.booking_id === booking.id));
  pass('Android booking → Web lifecycle → Android state; Web review → Android');
  const conversation = await web.messagesAPI.getOrCreateConversation(worker.user.id);
  await web.messagesAPI.send({ recipient_id: worker.user.id, content: 'Next phase Web chat' });
  M(worker);
  assert((await mobile.messagesAPI.messages(conversation.id)).some(m => m.content === 'Next phase Web chat'));
  await mobile.messagesAPI.send(home.user.id, 'Next phase Android chat');
  assert((await web.messagesAPI.getMessages(conversation.id)).some(m => m.content === 'Next phase Android chat'));
  pass('Two-way saved chat through actual client modules');
  M(home);
  const complaint = await mobile.complaintsAPI.create({ accused_id: worker.user.id, subject: 'Next phase Android complaint', description: 'Fixture only' });
  assert((await web.complaintsAPI.getMine()).some(c => c.id === complaint.id));
  const second = await web.complaintsAPI.create({ accused_id: worker.user.id, subject: 'Next phase Web complaint', description: 'Fixture only' });
  assert((await mobile.complaintsAPI.getMine()).some(c => c.id === second.id));
  pass('Two-way complaint records');
  const emergencyBody = { category_name: 'Electrical', description: 'Isolated next phase fixture', location: 'Dhaka', contact_phone: '01700000000' };
  const emergency = (await mobile.emergencyAPI.broadcast(emergencyBody)).alertDetails;
  W(worker);
  assert((await web.emergencyAPI.list()).some(e => e.id === emergency.id));
  await web.emergencyAPI.accept(emergency.id);
  assert.equal((await mobile.emergencyAPI.list()).find(e => e.id === emergency.id).status, 'accepted');
  W(home);
  const cancelled = (await web.emergencyAPI.notify(emergencyBody)).alertDetails;
  M(worker);
  assert((await mobile.emergencyAPI.list()).some(e => e.id === cancelled.id));
  M(home); await mobile.emergencyAPI.cancel(cancelled.id);
  assert.equal((await web.emergencyAPI.list()).find(e => e.id === cancelled.id).status, 'cancelled');
  pass('Two-way emergency state in isolation; no alerts sent to real users');
  const inbox = await web.notificationsAPI.list(); assert(inbox.length > 1);
  await mobile.notificationsAPI.read(inbox[0].id);
  assert((await web.notificationsAPI.list()).find(n => n.id === inbox[0].id).read_at);
  await web.notificationsAPI.read(inbox[1].id);
  assert((await mobile.notificationsAPI.list()).find(n => n.id === inbox[1].id).read_at);
  pass('Two-way durable notification read state; not real FCM delivery');
  const originalFetch = global.fetch, key = process.env.GEMINI_API_KEY;
  const before = Number((await pool.query('SELECT count(*) n FROM ai_messages')).rows[0].n);
  process.env.GEMINI_API_KEY = 'isolated-provider-fixture';
  let captured;
  const invoke = async (user, question) => {
    let status = 200, body;
    await chat({ user: user.user, body: { message: question } }, { status(code) { status = code; return this; }, json(data) { body = data; } });
    return { status, body };
  };
  try {
    global.fetch = async (url, options) => { captured = JSON.parse(options.body); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Isolated AI provider answer; not a real Gemini response.' }] } }] }) }; };
    assert.equal((await invoke(home, 'Explain my bookings')).status, 200);
    const context = JSON.parse(captured.systemInstruction.parts[0].text.split('Current database context:\n')[1]);
    assert(context.my_bookings.every(b => b.user_id === home.user.id));
    assert(!JSON.stringify(context).includes('password_hash'));
    global.fetch = originalFetch;
    assert.deepEqual(await web.chatbotAPI.history(), await mobile.chatbotAPI.history());
    W(worker); M(worker); assert.deepEqual(await web.chatbotAPI.history(), []); assert.deepEqual(await mobile.chatbotAPI.history(), []);
    assert.equal((await fetch(base + '/chatbot')).status, 401);
    global.fetch = async (url, options) => { captured = JSON.parse(options.body); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Isolated worker AI answer.' }] } }] }) }; };
    assert.equal((await invoke(worker, 'Explain my worker bookings')).status, 200);
    const workerContext = JSON.parse(captured.systemInstruction.parts[0].text.split('Current database context:\n')[1]);
    assert(workerContext.my_bookings.every(b => b.helper_id === helper));
    assert.deepEqual(workerContext.my_complaints, []);
    global.fetch = originalFetch;
    assert.deepEqual(await web.chatbotAPI.history(), await mobile.chatbotAPI.history());
    assert((await web.chatbotAPI.history()).every(row => !row.content.includes('Explain my bookings')));
    for (const providerStatus of [400, 401, 403, 429, 500, 503]) {
      global.fetch = async () => ({ ok: false, status: providerStatus });
      const failed = await invoke(home, 'Failure fixture'); assert.equal(failed.status, 503);
      assert(!JSON.stringify(failed.body).includes('isolated-provider-fixture'));
      if (providerStatus === 429) assert(failed.body.message.includes('usage limit'));
    }
    global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [] }) }); assert.equal((await invoke(home, 'Empty answer')).status, 503);
    global.fetch = async () => { throw Object.assign(new Error('Fixture timeout'), { name: 'TimeoutError' }); }; assert.equal((await invoke(home, 'Timeout fixture')).status, 503);
    assert.equal(Number((await pool.query('SELECT count(*) n FROM ai_messages')).rows[0].n), before + 4);
    assert.equal((await invoke(home, '')).status, 400);
    pass('AI authenticated owner/role history isolation, real SQL persistence and sanitized provider failures with mocked provider');
  } finally { global.fetch = originalFetch; if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key; }
  W(home); M(home);
  const relogin = await mobile.authAPI.login({ email: home.user.email, password: 'fixture-password' }); M(relogin);
  assert((await mobile.bookingsAPI.getMyBookings()).some(b => b.id === booking.id));
  pass('Android protocol relogin retains records');
  await fs.writeFile(path.resolve(__dirname, '../../docs/test-results/next-phase-protocol.json'), JSON.stringify({ executedAt: new Date().toISOString(), scope: 'Disposable local PostgreSQL + real Web/Android API modules; native Platform/AsyncStorage bindings simulated', results, liveGemini: 'NOT RUN in this isolated suite; see production checkpoint evidence', realDevice: 'NOT RUN', nativeFCM: 'NOT RUN' }, null, 2) + '\n');
}
main().catch(error => { console.log('Next-phase test failed: ' + error.message); process.exitCode = 1; }).finally(() => pool.end());

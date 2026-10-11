const router = require('express').Router();
const { getConversations, getMessages, sendMessage, getOrCreateConversation, getContacts } = require('../controllers/messageController');
const { auth } = require('../middleware/auth');

router.get('/conversations', auth, getConversations);
router.get('/contacts', auth, getContacts);
router.get('/conversation/:userId', auth, getOrCreateConversation);
router.get('/:conversationId', auth, getMessages);
router.post('/', auth, sendMessage);

module.exports = router;

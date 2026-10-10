const express = require('express');
const router = express.Router();
const { chat, history } = require('../controllers/aiAssistant');
const { auth } = require('../middleware/auth');

// POST /api/chatbot  — send a message, get AI reply
router.get('/', auth, history);
router.post('/', auth, chat);

module.exports = router;

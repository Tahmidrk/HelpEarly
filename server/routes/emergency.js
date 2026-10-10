const router = require('express').Router();
const { triggerEmergencyAlert, acceptEmergencyAlert, getEmergencyRequests, declineEmergency, cancelEmergency } = require('../controllers/emergencyController');
const { auth, requireRole } = require('../middleware/auth');

router.post('/notify', auth, requireRole('household'), triggerEmergencyAlert);
router.get('/', auth, requireRole('household','helper'), getEmergencyRequests);
router.post('/:id/accept', auth, requireRole('helper'), acceptEmergencyAlert);
router.post('/:id/decline', auth, requireRole('helper'), declineEmergency);
router.post('/:id/cancel', auth, requireRole('household'), cancelEmergency);

module.exports = router;

const router = require('express').Router();
const { getHelpers, getHelper, updateHelper, addService, deleteService, getMyHelperProfile } = require('../controllers/helperController');
const { auth, optionalAuth, requireRole } = require('../middleware/auth');

router.get('/', optionalAuth, getHelpers);
router.put('/settings', auth, requireRole('helper'), require('../controllers/workerSettings'));
router.get('/me', auth, requireRole('helper'), getMyHelperProfile);
router.get('/:id', optionalAuth, getHelper);
router.put('/me', auth, requireRole('helper'), updateHelper);
router.post('/services', auth, requireRole('helper'), addService);
router.delete('/services/:serviceId', auth, requireRole('helper'), deleteService);

module.exports = router;

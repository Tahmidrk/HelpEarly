const router = require('express').Router();
const { getStats, getUsers, updateUser, verifyHelper, deleteUser, deleteJob, deleteReview, monitor, updateHelper, saveCategory, moderateJob, moderateReview, updateComplaint } = require('../controllers/centralAdminController');
const { auth } = require('../middleware/auth');

router.use(auth, require('../utils/admin').adminAccess);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.put('/helpers/:id/verify', verifyHelper);
router.delete('/users/:id', deleteUser);
router.delete('/jobs/:id', deleteJob);
router.delete('/reviews/:id', deleteReview);
router.get('/monitor/:resource', monitor);
router.put('/helpers/:id', updateHelper);
router.post('/categories', saveCategory);
router.put('/categories/:id', saveCategory);
router.put('/jobs/:id', moderateJob);
router.put('/reviews/:id', moderateReview);
router.put('/services/:id', require('../controllers/centralAdminController').updateService);
router.put('/complaints/:id', updateComplaint);

module.exports = router;

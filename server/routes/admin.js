const router = require('express').Router();
const { getStats, getUsers, updateUser, verifyHelper, deleteUser, deleteJob, deleteReview } = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth, requireRole('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.put('/helpers/:id/verify', verifyHelper);
router.delete('/users/:id', deleteUser);
router.delete('/jobs/:id', deleteJob);
router.delete('/reviews/:id', deleteReview);

module.exports = router;

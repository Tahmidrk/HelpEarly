const router = require('express').Router();
const {
  getComplaintContacts,
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  updateComplaint,
} = require('../controllers/complaintController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/contacts', auth, getComplaintContacts);
router.get('/mine', auth, getMyComplaints);
router.post('/', auth, createComplaint);
router.get('/', auth, requireRole('admin'), getAllComplaints);
router.put('/:id', auth, require('../utils/admin').adminAccess, require('../controllers/centralAdminController').updateComplaint);

module.exports = router;

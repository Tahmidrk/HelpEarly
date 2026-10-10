const router = require('express').Router();
const { createJob, getJobs, getJob, getMyJobs, getJobsForHelper, applyForJob, updateApplication, getMyApplications } = require('../controllers/jobController');
const { auth, optionalAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, requireRole('household'), upload.array('photos', 3), createJob);
router.get('/', optionalAuth, getJobs);
router.get('/my', auth, requireRole('household'), getMyJobs);
router.get('/for-helper', auth, requireRole('helper'), getJobsForHelper);
router.get('/applications', auth, requireRole('helper'), getMyApplications);
router.get('/:id', optionalAuth, getJob);
router.post('/:id/apply', auth, requireRole('helper'), applyForJob);
router.put('/applications/:applicationId', auth, requireRole('household'), updateApplication);

module.exports = router;

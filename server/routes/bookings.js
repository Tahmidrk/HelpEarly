const router = require('express').Router();
const { createBooking, getBookings, updateBooking, cancelBooking } = require('../controllers/bookingController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, upload.array('photos', 3), createBooking);
router.get('/', auth, getBookings);
router.get('/my-bookings', auth, getBookings);
router.put('/:id', auth, updateBooking);
router.delete('/:id', auth, cancelBooking);

module.exports = router;

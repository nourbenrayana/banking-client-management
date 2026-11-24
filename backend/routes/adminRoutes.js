const express = require('express');
const { getAllUsers, login , getDashboardStats,getBankStats} = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/allUsers', protectAdmin, getAllUsers);
router.get('/dashboardStats', protectAdmin, getDashboardStats);
router.get('/bankStats', protectAdmin, getBankStats);
router.post('/login', login);

module.exports = router;

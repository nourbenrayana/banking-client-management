const express = require('express');
const router = express.Router();
const reclamationController = require('../controllers/reclamationController');

// Create a new reclamation
router.post('/', reclamationController.createReclamation);

// Get all reclamations (for admin purposes)
router.get('/', reclamationController.getReclamations);

// Get reclamations by user ID
router.get('/user/:userId', reclamationController.getReclamationsByUser);

//UpdateReclamation
router.post('/update',reclamationController.updateReclamationStatus);

module.exports = router;
const express = require('express');
const router = express.Router();
const cardRequestController = require('../controllers/cardRequestController');

// Route pour soumettre une demande de carte
router.post('/submit_card_request', cardRequestController.submitCardRequest);

// Route pour obtenir toutes les demandes de carte
router.get('/get_card_requests', cardRequestController.getAllCardRequests);

// Route pour répondre à une demande (accepter ou refuser)
router.post('/respond_card_request', cardRequestController.respondToCardRequest);

module.exports = router;

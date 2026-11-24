const express = require('express');
const router = express.Router();
const factureController = require('../controllers/FactureController');

// Créer une facture
router.post("/", factureController.creerFacture); 

// Demander OTP
router.post("/factures/:numeroFacture/otp", factureController.demanderOTP);
router.post("/qr/otp", factureController.demanderOTPParQR);
// Vérifier OTP et payer
router.post("/factures/:numeroFacture/payer", factureController.verifierEtPayerFacture);

// Payer via QR Code
router.post("/payer/qr", factureController.verifierEtPayerFactureParQR);
// Endpoint pour récupérer les factures d'un utilisateur
router.get('/utilisateur/:utilisateurId', factureController.getFacturesPayeesByUtilisateur);
// Route pour créer une notification
router.post('/', factureController.creerNotification);

// Route pour récupérer les notifications d'un utilisateur
router.get('/:userId', factureController.getNotificationsByUser);

// Route pour marquer une notification comme lue
router.put('/:id/lire', factureController.marquerCommeLue);

// Route pour supprimer une notification
router.delete('/:id', factureController.supprimerNotification);


module.exports = router;

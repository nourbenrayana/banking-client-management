const express = require("express");
const router = express.Router();
const TransactionController = require("../controllers/TransactionController");

// Effectuer un virement
router.post("/virement", TransactionController.effectuerVirement);

// Récupérer une transaction par ID
router.get("/:id", TransactionController.getTransactionById);

// Récupérer les transactions associées à un compte
router.get("/compte/:compteId", TransactionController.getTransactionsByCompte);

// Récupérer les notifications d’un utilisateur
router.get("/notifications/:userId", TransactionController.getUserNotifications);

// Récupérer le nombre de notifications non lues
router.get("/notifications/unread/count/:userId", TransactionController.getUnreadNotificationsCount);

// Marquer une notification comme lue
router.put("/notifications/read/:id", TransactionController.markNotificationAsRead);

//supprimer notification
router.delete("/notifications/:id",TransactionController.deleteNotification);

// Supprimer toutes les notifications d'un utilisateur
router.delete("/notifications/all/:userId", TransactionController.deleteAllNotifications);

// Annuler une transaction
router.post("/cancel/:id", TransactionController.cancelTransaction);

module.exports = router;

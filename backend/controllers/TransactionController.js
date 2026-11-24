const store = require('../config/db'); // Connexion à RavenDB
const { sendNotificationToUser } = require('../sockets/socketManager');
const { v4: uuidv4 } = require('uuid');

// Modifiez la fonction effectuerVirement pour sauvegarder les notifications
exports.effectuerVirement = async (req, res) => {
    try {
        const session = store.openSession();
        const { montant, compteExpediteur, numeroCompteDestinataire } = req.body;

        if (!montant || !compteExpediteur || !numeroCompteDestinataire) {
            return res.status(400).json({ message: "Données manquantes" });
        }

        const compteExp = await session.load(compteExpediteur);
        const comptesDest = await session
            .query({ collection: "comptes" })
            .whereEquals("numeroCompte", numeroCompteDestinataire)
            .all();

        if (!compteExp || comptesDest.length === 0) {
            return res.status(404).json({ message: "Compte non trouvé" });
        }

        const compteDest = comptesDest[0];

        if (compteExp.solde < montant) {
            return res.status(400).json({ message: "Solde insuffisant" });
        }

        // Débit / Crédit
        compteExp.solde -= montant;
        compteExp.soldeActuel = compteExp.solde;
        compteDest.solde += montant;
        compteDest.soldeActuel = compteDest.solde;

        // Enregistrer la transaction
        const transactionId = `transactions/${uuidv4()}`;
        const transaction = {
            id: transactionId,
            montant,
            date: new Date().toISOString(),
            typeTransaction: "Virement",
            compteExpediteur,
            compteDestinataire: compteDest.id,
            statut: "Effectué",
            "@metadata": { "@collection": "transactions" }
        };

        // Fonction pour créer et sauvegarder une notification
        const createNotification = async (userId, title, message, data) => {
            if (!userId) return;
            
            const notificationId = `notifications/${uuidv4()}`;
            const notification = {
                id: notificationId,
                userId: userId.replace('users/', ''),
                title,
                message,
                data,
                date: new Date().toISOString(),
                read: false,
                "@metadata": { "@collection": "notifications" }
            };
            
            await session.store(notification);
            return notification;
        };

        // Sauvegarder les entités
        await session.store(compteExp);
        await session.store(compteDest);
        await session.store(transaction);

        // Créer et sauvegarder les notifications
        let notificationExp, notificationDest;
        const getUserFullName = async (userId, fallback, session) => {
        if (!userId) return fallback;
            const user = await session.load(userId);
            return (user && user.fullName) ? user.fullName.trim() : fallback;
        };

        if (compteExp.userId) {
            const rawUserId = compteExp.userId.replace('users/', '');
            const destinataireNom = await getUserFullName(compteDest.userId, compteDest.numeroCompte, session);

            notificationExp = await createNotification(
                compteExp.userId,
                "Virement effectué",
                `Vous avez envoyé ${montant} ${compteExp.devise} à ${destinataireNom}.`,
                {
                    transactionId,
                    montant,
                    devise: compteExp.devise,
                    destinataire: destinataireNom,
                }
            );
            
            sendNotificationToUser(rawUserId, notificationExp);
        }

        if (compteDest.userId) {
            const rawUserId = compteDest.userId.replace('users/', '');
            const expediteurNom = await getUserFullName(compteExp.userId, compteExp.numeroCompte, session);
            
            notificationDest = await createNotification(
                compteDest.userId,
                "Virement reçu",
                `Vous avez reçu ${montant} ${compteExp.devise} de ${expediteurNom}.`,
                {
                    transactionId,
                    montant,
                    devise: compteExp.devise,
                    expediteur: expediteurNom,
                }
            );
            
            sendNotificationToUser(rawUserId, notificationDest);
        }

        await session.saveChanges();

        res.status(201).json({ 
            message: "Virement effectué avec succès", 
            transaction,
            notifications: {
                sender: notificationExp,
                receiver: notificationDest
            }
        });

    } catch (error) {
        console.error("Erreur lors du virement :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

// Ajoutez une nouvelle fonction pour récupérer les notifications d'un utilisateur
exports.getUserNotifications = async (req, res) => {
    try {
        const session = store.openSession();
        const userId = req.params.userId;

        if (!userId) {
            return res.status(400).json({ message: "ID utilisateur manquant" });
        }

        const notifications = await session
            .query({ collection: "notifications" })
            .whereEquals("userId", userId)
            .orderByDescending("date")
            .all();

        res.status(200).json(notifications);
    } catch (error) {
        console.error("Erreur lors de la récupération des notifications :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
};
// Ajoutez une fonction pour marquer une notification non lue
exports.getUnreadNotificationsCount = async (req, res) => {
    try {
        const session = store.openSession();
        const userId = req.params.userId;

        if (!userId) {
            return res.status(400).json({ message: "ID utilisateur manquant" });
        }

        const count = await session
            .query({ collection: "notifications" })
            .whereEquals("userId", userId)
            .whereEquals("read", false)
            .count();

        res.status(200).json({ count });
    } catch (error) {
        console.error("Erreur lors de la récupération des notifications non lues :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

// Ajoutez une fonction pour marquer une notification comme lue
exports.markNotificationAsRead = async (req, res) => {
    try {
        const session = store.openSession();
        const notificationId = `notifications/${req.params.id}`;

        const notification = await session.load(notificationId);
        if (!notification) {
            return res.status(404).json({ message: "Notification non trouvée" });
        }

        notification.read = true;
        await session.store(notification);
        await session.saveChanges();

        res.status(200).json({ message: "Notification marquée comme lue", notification });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la notification :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
};
//Supprimer notification
exports.deleteNotification = async (req, res) => {
    const { id } = req.params;
    
    // Validation de l'ID
    if (!id) {
        return res.status(400).json({ error: "L'ID de la notification est requis." });
    }

    const session = store.openSession();
    try {
        // Formatage correct de l'ID
        const fullId = id.startsWith("notifications/") ? id : `notifications/${id}`;
        
        // Vérification que la notification existe avant suppression
        const notification = await session.load(fullId);
        if (!notification) {
            return res.status(404).json({ error: "Notification non trouvée." });
        }

        // Suppression définitive
        await session.delete(fullId);
        await session.saveChanges();
        
        res.status(200).json({ 
            success: true,
            message: "Notification supprimée définitivement avec succès.",
            deletedId: fullId
        });
        
    } catch (error) {
        console.error("Erreur lors de la suppression :", error);
        res.status(500).json({ 
            success: false,
            error: "Erreur lors de la suppression définitive de la notification.",
            details: error.message 
        });
    } finally {
        // Fermeture de la session
        session.dispose();
    }
};
// Supprimer toutes les notifications d'un utilisateur
exports.deleteAllNotifications = async (req, res) => {
    try {
        const session = store.openSession();
        const userId = req.params.userId;

        if (!userId) {
            return res.status(400).json({ message: "ID utilisateur manquant" });
        }

        const notifications = await session
            .query({ collection: "notifications" })
            .whereEquals("userId", userId)
            .all();

        notifications.forEach(notification => {
            session.delete(notification.id);
        });

        await session.saveChanges();
        res.status(200).json({ message: "Toutes les notifications ont été supprimées", count: notifications.length });
    } catch (error) {
        console.error("Erreur lors de la suppression des notifications :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
};
// Récupérer une transaction par ID
exports.getTransactionById = async (req, res) => {
    try {
        const session = store.openSession();
        const transactionId = `transactions/${req.params.id}`;

        const transaction = await session.load(transactionId);

        if (!transaction) {
            return res.status(404).json({ message: "Transaction non trouvée" });
        }

        res.json(transaction);
    } catch (error) {
        console.error("Erreur lors de la récupération de la transaction :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

// Récupérer les transactions d'un utilisateur
exports.getTransactionsByCompte = async (req, res) => {
    try {
        const { compteId } = req.params;

        if (!compteId) {
            return res.status(400).json({ message: "ID du compte manquant dans l'URL." });
        }

        const fullCompteId = compteId.startsWith("comptes/") ? compteId : `comptes/${compteId}`;
        const session = store.openSession();

        const transactions = await session
            .query({ collection: "transactions" })
            .whereEquals("compteExpediteur", fullCompteId)
            .orElse()
            .whereEquals("compteDestinataire", fullCompteId)
            .orderByDescending("date")
            .all();

        const compteDestIds = [
            ...new Set(transactions.map(tx => tx.compteDestinataire).filter(Boolean))
        ];
        const comptesMap = await session.load(compteDestIds);

        const userIds = Object.values(comptesMap)
            .map(compte => compte?.userId)
            .filter(Boolean);

        const utilisateursMap = await session.load(userIds);

        const enrichedTransactions = transactions.map(tx => {
            const compte = comptesMap[tx.compteDestinataire];
            const utilisateur = compte ? utilisateursMap[compte.userId] : null;
            const destinataireNom = utilisateur?.nom || tx.compteDestinataire;

            return {
                ...tx,
                destinataireNom
            };
        });

        res.status(200).json(enrichedTransactions);

    } catch (error) {
        console.error("Erreur lors de la récupération des transactions :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

// Annuler une transaction
exports.cancelTransaction = async (req, res) => {
    try {
        const session = store.openSession();
        const transactionId = `transactions/${req.params.id}`;

        const transaction = await session.load(transactionId);
        if (!transaction) {
            return res.status(404).json({ message: "Transaction non trouvée" });
        }

        if (transaction.statut !== "Effectué") {
            return res.status(400).json({ message: "La transaction ne peut pas être annulée" });
        }

        const compteExp = await session.load(transaction.compteExpediteur);
        const compteDest = await session.load(transaction.compteDestinataire);

        if (!compteExp || !compteDest) {
            return res.status(404).json({ message: "Compte associé non trouvé" });
        }

        // Remboursement
        compteExp.solde += transaction.montant;
        compteDest.solde -= transaction.montant;
        transaction.statut = "Annulé";

        await session.store(compteExp);
        await session.store(compteDest);
        await session.store(transaction);
        await session.saveChanges();

        // WebSocket notifications pour l'expéditeur et le destinataire
        if (compteExp.userId) {
            sendNotificationToUser(compteExp.userId, {
                title: "Virement annulé",
                message: `Votre virement de ${transaction.montant} € vers ${compteDest.numeroCompte} a été annulé.`,
                data: { transactionId }
            });
        }

        if (compteDest.userId) {
            sendNotificationToUser(compteDest.userId, {
                title: "Virement annulé",
                message: `Un virement reçu de ${transaction.montant} € depuis ${compteExp.numeroCompte} a été annulé.`,
                data: { transactionId }
            });
        }

        res.json({ message: "Transaction annulée avec succès", transaction });

    } catch (error) {
        console.error("Erreur lors de l'annulation de la transaction :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
};

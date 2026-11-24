const store = require('../config/db');
const Facture = require("../models/Facture");
const { sendNotificationToUser } = require('../sockets/socketManager');

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Créer une facture sans la payer
exports.creerFacture = async (req, res) => {
    try {
        console.log("📥 Données reçues :", req.body);

        const session = store.openSession();
        const { numeroFacture, montant, dateEcheance, utilisateurId, qrCode } = req.body;

        if (!numeroFacture || !montant || !utilisateurId) {
            console.log("❌ Données manquantes :", req.body);
            return res.status(400).json({ message: "Données manquantes" });
        }

        const factureExistante = await session
            .query({ collection: "Factures" })
            .whereEquals("numeroFacture", numeroFacture)
            .firstOrNull();

        if (factureExistante) {
            console.log("⚠️ Facture déjà existante :", numeroFacture);
            return res.status(400).json({ message: "Cette facture existe déjà" });
        }

        const nouvelleFacture = new Facture(
            null,
            numeroFacture,
            montant,
            dateEcheance || new Date(),
            "en attente",
            utilisateurId,
            qrCode || null,
            null,
            null
        );

        await session.store(nouvelleFacture);
        await session.saveChanges();

        console.log("✅ Facture créée :", nouvelleFacture);
        res.status(201).json({ 
            message: "Facture créée avec succès",
            facture: nouvelleFacture
        });

    } catch (error) {
        console.error("🔥 Erreur lors de la création de la facture :", error);
        res.status(500).json({ error: error.message });
    }
};

// Demander un OTP pour une facture existante
exports.demanderOTP = async (req, res) => {
    try {
        const session = store.openSession();
        const { numeroFacture } = req.params;//écupères la valeur de numeroFacture à partir des paramètres d’URL de la requête HTTP.

        const facture = await session
            .query({ collection: "Factures" })
            .whereEquals("numeroFacture", numeroFacture)
            .firstOrNull();

        if (!facture) {
            return res.status(404).json({ message: "Facture non trouvée" });
        }

        if (facture.statut === "payée") {
            return res.status(400).json({ message: "Facture déjà payée" });
        }

        // Générer l'OTP
        facture.otp = generateOTP();
        console.log("🔑 OTP généré :", facture.otp);  // Ajout du log

        facture.otpExpiration = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        console.log("⏳ OTP expirera le :", facture.otpExpiration);  // Ajout du log pour l'expiration de l'OTP

        await session.saveChanges();

        console.log("✅ OTP généré et enregistré dans la base de données");
        res.status(200).json({ message: "OTP généré avec succès", otp: facture.otp });
    } catch (error) {
        console.error("🔥 Erreur lors de la génération de l'OTP :", error);
        res.status(500).json({ error: error.message });
    }
};

// Vérifier l’OTP et payer la facture
exports.verifierEtPayerFacture = async (req, res) => {
    try {
        const session = store.openSession();
        const { numeroFacture } = req.params;
        const { otp } = req.body;//depuis le corps (body) de la requête HTTP.

        const facture = await session
            .query({ collection: "Factures" })
            .whereEquals("numeroFacture", numeroFacture)
            .firstOrNull();

        if (!facture) {
            return res.status(404).json({ message: "Facture non trouvée" });
        }

        if (facture.statut === "payée") {
            return res.status(400).json({ message: "Cette facture est déjà payée" });
        }

        if (!facture.otp) {
            return res.status(400).json({ message: "Aucun OTP généré" });
        }

        if (facture.otp !== otp) {
            return res.status(400).json({ message: "OTP incorrect" });
        }

        if (new Date() > new Date(facture.otpExpiration)) {
            return res.status(400).json({ message: "OTP expiré" });
        }

        // Récupérer le compte bancaire de l'utilisateur
        const compte = await session
            .query({ collection: "comptes" })
            .whereEquals("userId", facture.utilisateurId)
            .firstOrNull();

        if (!compte) {
            return res.status(404).json({ message: "Compte bancaire introuvable" });
        }

        //  Vérifier si le solde est suffisant
        if (compte.soldeActuel < facture.montant) {
            return res.status(400).json({ message: "Solde insuffisant" });
        }

        const ancienSolde = compte.soldeActuel;
        compte.soldeActuel = parseFloat((ancienSolde - parseFloat(facture.montant)).toFixed(2));

        // Ajoutez un log pour le débogage
        console.log(`💰 Mise à jour du solde: ${ancienSolde} -> ${compte.soldeActuel}`);

        // Payer la facture
        facture.statut = "payée";
        facture.datePaiement = new Date();
        facture.otp = null;
        facture.otpExpiration = null;

        const facturePayee = {
            statut: "payée",
            datePaiement: facture.datePaiement,
            montant: facture.montant,
            utilisateurId: facture.utilisateurId,
            factureOriginaleId: facture.id,
            "@metadata": { "@collection": "facturesPayees" }
        };

        //Enregistrer la transaction
        const transaction = {
            type: "Paiement",
            montant: facture.montant,
            date: new Date(),
            utilisateurId: facture.utilisateurId,
            compteId: compte.id,
            description: `Paiement de la facture ${facture.numeroFacture}`,
            "@metadata": { "@collection": "transactions" }
        };

        await session.store(facturePayee);
        await session.store(transaction);

        // Créer et sauvegarder la notification
        const notification = {
            userId: facture.utilisateurId.replace('users/', ''), // Normaliser l'ID utilisateur
            title: "Paiement confirmé",
            message: `Votre paiement de ${facture.montant} pour la facture ${facture.numeroFacture} a été effectué avec succès.`,
            type: "success",
            date: new Date().toISOString(),
            read: false,
            data: {
                type: "payment_confirmation",
                amount: facture.montant,
                billNumber: facture.numeroFacture,
                newBalance: compte.soldeActuel
            },
            "@metadata": { "@collection": "notifications" }
        };

        await session.store(notification);
        await session.saveChanges();

        // Envoyer une notification de confirmation via WebSocket
        sendNotificationToUser(facture.utilisateurId, {
            title: "Paiement confirmé",
            message: `Votre paiement de R$ ${facture.montant} pour la facture ${facture.numeroFacture} a été effectué avec succès.`,
            data: {
                type: "payment_confirmation",
                amount: facture.montant,
                billNumber: facture.numeroFacture,
                newBalance: compte.soldeActuel
            }
        });

        console.log("✅ Facture payée et solde mis à jour :", facture);
        res.status(200).json({ 
            message: "Facture payée avec succès", 
            facture,
            compteMisAJour: compte,
            reçu: facturePayee
        });
    } catch (error) {
        console.error("🔥 Erreur lors du paiement de la facture :", error);
        res.status(500).json({ error: error.message });
    }
};

// Demander un OTP pour une facture via QR Code
exports.demanderOTPParQR = async (req, res) => {
    try {
        const session = store.openSession();
        const { qrCode, userId, amount, company } = req.body;

        // Validation des données requises
        if (!qrCode || !userId || !amount) {
            return res.status(400).json({ message: "QR code, user ID et montant sont requis" });
        }

        // Vérifier si le montant est valide
        if (isNaN(amount)) {
            return res.status(400).json({ message: "Montant invalide" });
        }

        // Créer une nouvelle facture
        const nouvelleFacture = new Facture(
            null, // ID généré automatiquement
            `QRPAY-${Date.now()}`, // Numéro de facture généré
            parseFloat(amount), // Montant
            new Date(), // Date d'échéance (aujourd'hui)
            "en attente", // Statut
            userId, // ID utilisateur
            qrCode, // QR code
            null, // OTP (sera généré ensuite)
            null  // Date expiration OTP
        );

        // Ajouter le nom de la société si fourni
        if (company) {
            nouvelleFacture.societe = company;
        }

        // Générer l'OTP
        nouvelleFacture.otp = generateOTP();
        nouvelleFacture.otpExpiration = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Sauvegarder la facture
        await session.store(nouvelleFacture);
        await session.saveChanges();

        res.status(200).json({ 
            message: "Facture créée et OTP généré avec succès", 
            otp: nouvelleFacture.otp,
            factureId: nouvelleFacture.id,
            montant: nouvelleFacture.montant,
            societe: nouvelleFacture.societe || 'Fournisseur par QR'
        });

    } catch (error) {
        console.error("🔥 Erreur lors de la création de la facture QR :", error);
        res.status(500).json({ error: error.message });
    }
};
//récupérer les factures payées par user 
exports.getFacturesPayeesByUtilisateur = async (req, res) => {
    let { utilisateurId } = req.params;

    if (!utilisateurId) {
        return res.status(400).json({ message: "L'ID utilisateur est requis." });
    }

    // Ajoute le préfixe 'users/' si absent
    if (!utilisateurId.startsWith('users/')) {
        utilisateurId = `users/${utilisateurId}`;
    }

    try {
        const session = store.openSession();

        const facturesPayees = await session
            .query({ collection: 'facturesPayees' })
            .whereEquals('utilisateurId', utilisateurId)
            .all();

        res.status(200).json(facturesPayees);
    } catch (error) {
        console.error("Erreur lors de la récupération des factures payées:", error);
        res.status(500).json({ error: error.message });
    }
};


// Payer via QR Code
exports.verifierEtPayerFactureParQR = async (req, res) => {
    try {
        const session = store.openSession();
        const { qrCode, otp } = req.body;

        // Trouver la facture par QR code
        const facture = await session
            .query({ collection: "Factures" })
            .whereEquals("qrCode", qrCode)
            .firstOrNull();

        if (!facture) {
            return res.status(404).json({ message: "Facture non trouvée" });
        }

        // Vérifications standard
        if (facture.statut === "payée") {
            return res.status(400).json({ message: "Facture déjà payée" });
        }

        if (!facture.otp || facture.otp !== otp) {
            return res.status(400).json({ message: "OTP incorrect" });
        }

        if (new Date() > new Date(facture.otpExpiration)) {
            return res.status(400).json({ message: "OTP expiré" });
        }

        // Récupérer le compte utilisateur
        const compte = await session
            .query({ collection: "comptes" })
            .whereEquals("userId", facture.utilisateurId)
            .firstOrNull();

        if (!compte) {
            return res.status(404).json({ message: "Compte bancaire introuvable" });
        }

        // Vérifier le solde
        if (compte.soldeActuel < facture.montant) {
            return res.status(400).json({ message: "Solde insuffisant" });
        }

        // Enregistrer l'ancien solde pour le log
        const ancienSolde = compte.soldeActuel;
        
        // Effectuer le paiement
        compte.soldeActuel = parseFloat((compte.soldeActuel - parseFloat(facture.montant)).toFixed(2));
        facture.statut = "payée";
        facture.datePaiement = new Date();
        facture.otp = null;
        facture.otpExpiration = null;

        // Log de mise à jour du solde
        console.log(` Mise à jour du solde: ${ancienSolde} -> ${compte.soldeActuel}`);

        // Enregistrer la facture payée
        const facturePayee = {
            statut: "payée",
            datePaiement: facture.datePaiement,
            montant: facture.montant,
            utilisateurId: facture.utilisateurId,
            factureOriginaleId: facture.id,
            "@metadata": { "@collection": "facturesPayees" }
        };

        // Enregistrer la transaction
        const transaction = {
            type: "Paiement QR",
            montant: facture.montant,
            date: new Date(),
            utilisateurId: facture.utilisateurId,
            compteId: compte.id,
            description: `Paiement par QR Code ${facture.qrCode}`,
            "@metadata": { "@collection": "transactions" }
        };

        // Créer et sauvegarder la notification
        const notification = {
            userId: facture.utilisateurId.replace('users/', ''),
            title: "Paiement QR confirmé",
            message: `Votre paiement de ${facture.montant} via QR code a été effectué avec succès.`,
            type: "success",
            date: new Date().toISOString(),
            read: false,
            data: {
                type: "qr_payment_confirmation",
                amount: facture.montant,
                newBalance: compte.soldeActuel
            },
            "@metadata": { "@collection": "notifications" }
        };

        await session.store(facturePayee);
        await session.store(transaction);
        await session.store(notification);
        await session.saveChanges();

        // Envoyer une notification via WebSocket
        sendNotificationToUser(facture.utilisateurId, {
            title: "Paiement QR confirmé",
            message: `Votre paiement de R$ ${facture.montant} via QR code a été effectué. Nouveau solde: R$ ${compte.soldeActuel}`,
            data: {
                type: "qr_payment_confirmation",
                amount: facture.montant,
                newBalance: compte.soldeActuel
            }
        });

        res.status(200).json({
            message: "Paiement effectué avec succès",
            facture,
            compteMisAJour: compte,
            reçu: facturePayee,
            nouveauSolde: compte.soldeActuel
        });

    } catch (error) {
        console.error("Erreur lors du paiement QR :", error);
        res.status(500).json({ error: error.message });
    }
};

// Supprimer une facture
exports.supprimerFacture = async (req, res) => {
    try {
        const session = store.openSession();
        const { numeroFacture } = req.params;

        const facture = await session
            .query({ collection: "Factures" })
            .whereEquals("numeroFacture", numeroFacture)
            .firstOrNull();

        if (!facture) {
            return res.status(404).json({ message: "Facture non trouvée" });
        }

        await session.delete(facture);
        await session.saveChanges();

        console.log(" Facture supprimée :", facture);
        res.status(200).json({ message: "Facture supprimée avec succès" });
    } catch (error) {
        console.error(" Erreur lors de la suppression de la facture :", error);
        res.status(500).json({ error: error.message });
    }
};

// Récupérer une facture par ID
exports.getFactureById = async (req, res) => {
    try {
        const session = store.openSession();
        const facture = await session.load(`factures/${req.params.id}`);

        if (!facture) {
            return res.status(404).json({ message: "Facture non trouvée" });
        }

        res.status(200).json(facture);
    } catch (error) {
        console.error("Erreur lors de la récupération de la facture par ID :", error);
        res.status(500).json({ error: error.message });
    }
};

// Lister toutes les factures d’un utilisateur
exports.getFacturesByUtilisateur = async (req, res) => {
    try {
        const session = store.openSession();
        const factures = await session
            .query({ collection: "Factures" })
            .whereEquals("utilisateurId", req.params.utilisateurId)
            .all();

        console.log(" Factures de l'utilisateur récupérées :", factures);
        res.status(200).json(factures);
    } catch (error) {
        console.error(" Erreur lors de la récupération des factures de l'utilisateur :", error);
        res.status(500).json({ error: error.message });
    }
};

// Mettre à jour une facture
exports.mettreAJourFacture = async (req, res) => {
    try {
        const session = store.openSession();
        const facture = await session.load(`factures/${req.params.id}`);

        if (!facture) {
            return res.status(404).json({ message: "Facture non trouvée" });
        }

        const { numeroFacture, montant, dateEcheance, statut } = req.body;
        if (numeroFacture) facture.numeroFacture = numeroFacture;
        if (montant) facture.montant = montant;
        if (dateEcheance) facture.dateEcheance = dateEcheance;
        if (statut) facture.statut = statut;

        await session.saveChanges();

        console.log("Facture mise à jour :", facture);
        res.status(200).json({ message: "Facture mise à jour avec succès", facture });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la facture :", error);
        res.status(500).json({ error: error.message });
    }
};
// Créer une nouvelle notification
exports.creerNotification = async (req, res) => {
    try {
        const session = store.openSession();
        const { userId, title, message, type } = req.body;

        if (!userId || !title || !message) {
            return res.status(400).json({ message: "Données manquantes" });
        }

        const notification = {
            userId,
            title,
            message,
            type: type || "info",
            date: new Date(),
            read: false,
            "@metadata": { "@collection": "notifications" }
        };

        await session.store(notification);
        await session.saveChanges();

        console.log(" Notification créée:", notification);
        res.status(201).json(notification);
    } catch (error) {
        console.error("Erreur lors de la création de la notification:", error);
        res.status(500).json({ error: error.message });
    }
};

// Récupérer les notifications d'un utilisateur
exports.getNotificationsByUser = async (req, res) => {
    try {
        const session = store.openSession();
        let { userId } = req.params;

        // Normaliser l'ID utilisateur
        if (!userId.startsWith('users/')) {
            userId = `users/${userId}`;
        }

        const notifications = await session
            .query({ collection: "notifications" })
            .whereEquals("userId", userId)
            .orderByDescending("date")
            .all();

        res.status(200).json(notifications);
    } catch (error) {
        console.error("🔥 Erreur lors de la récupération des notifications:", error);
        res.status(500).json({ error: error.message });
    }
};

// Marquer une notification comme lue
exports.marquerCommeLue = async (req, res) => {
    try {
        const session = store.openSession();
        const notification = await session.load(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: "Notification non trouvée" });
        }

        notification.read = true;
        await session.saveChanges();

        res.status(200).json({ message: "Notification marquée comme lue", notification });
    } catch (error) {
        console.error("🔥 Erreur lors du marquage de la notification comme lue:", error);
        res.status(500).json({ error: error.message });
    }
};

// Supprimer une notification
exports.supprimerNotification = async (req, res) => {
    try {
        const session = store.openSession();
        await session.delete(req.params.id);
        await session.saveChanges();

        res.status(200).json({ message: "Notification supprimée avec succès" });
    } catch (error) {
        console.error("🔥 Erreur lors de la suppression de la notification:", error);
        res.status(500).json({ error: error.message });
    }
};
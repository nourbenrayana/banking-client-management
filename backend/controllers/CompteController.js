const store = require('../config/db'); // Connexion à RavenDB
const { v4: uuidv4 } = require('uuid');

// Création d'un compte bancaire
// Génère un numéro IBAN fictif brésilien aléatoire
function generateBrazilianIBAN() {
    const bankCode = "00360305"; // Exemple de code banque fictif
    const branchCode = "00001";
    const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10 chiffres
    const suffix = "C1"; // Clé de contrôle fictive

    return `BR18${bankCode}${branchCode}${accountNumber}${suffix}`;
}

// Création d'un compte bancaire avec IBAN auto-généré
exports.createCompte = async (req, res) => {
    try {
        const session = store.openSession();
        const { typeCompte, solde, userId, devise } = req.body;

        if (solde < 0) {
            return res.status(400).json({ error: "Le solde ne peut pas être négatif" });
        }

        const user = await session.load(userId.startsWith("users/") ? userId : `users/${userId}`);
        if (!user) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        // Générer un IBAN unique
        let numeroCompte;
        let existing;
        do {
            numeroCompte = generateBrazilianIBAN();
            existing = await session.query({ collection: "comptes" })
                                    .whereEquals("numeroCompte", numeroCompte)
                                    .firstOrNull();
        } while (existing);

        const compteId = `comptes/${uuidv4()}`;
        const newCompte = {
            id: compteId,
            typeCompte,
            solde,
            dateOuverture: new Date(),
            userId,
            numeroCompte,
            devise,
            soldeActuel: solde,
            statutCompte: "actif",
            "@metadata": {
                "@collection": "comptes"
            }
        };

        await session.store(newCompte);
        await session.saveChanges();

        res.status(201).json({
            message: "Compte créé avec succès",
            compte: newCompte
        });
    } catch (error) {
        console.error("Erreur lors de la création du compte:", error);
        res.status(500).json({ error: "Erreur lors de la création du compte" });
    }
};


exports.getAccountTypeStats = async (req, res) => {
    try {
      const session = store.openSession();
      const allAccounts = await session.query({ collection: "comptes" }).all();
      
      const typeStats = {};
      
      allAccounts.forEach(account => {
        const type = account.typeCompte || 'Non spécifié';
        typeStats[type] = (typeStats[type] || 0) + 1;
      });
      
      const totalAccounts = allAccounts.length;
      const formattedStats = Object.entries(typeStats).map(([type, count]) => ({
        name: type,
        value: totalAccounts > 0 ? Math.round((count / totalAccounts) * 100) : 0
      }));
      
      res.status(200).json(formattedStats);
    } catch (error) {
      console.error("Erreur lors de la récupération des stats par type:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  };
// Récupérer un compte par ID
exports.getCompteById = async (req, res) => {
    try {
        const session = store.openSession();
        const compteId = `comptes/${req.params.id}`;
        const compte = await session.load(compteId);

        if (!compte) {
            return res.status(404).json({ error: "Compte non trouvé" });
        }

        res.json(compte);
    } catch (error) {
        console.error("Erreur lors de la récupération du compte:", error);
        res.status(500).json({ error: "Erreur lors de la récupération du compte" });
    }
};

// Récupérer tous les comptes bancaires d’un utilisateur
exports.getComptesByUserId = async (req, res) => {
    try {
        const session = store.openSession();
        const userId = req.params.userId.startsWith("users/")
            ? req.params.userId
            : `users/${req.params.userId}`;

        // Vérifie que l'utilisateur existe
        const user = await session.load(userId);
        if (!user) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        // Recherche des comptes associés à cet utilisateur
        const comptes = await session.query({ collection: "comptes" })
            .whereEquals("userId", userId)
            .all();

        res.json(comptes);
    } catch (error) {
        console.error("Erreur lors de la récupération des comptes utilisateur:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des comptes utilisateur" });
    }
};


// Mise à jour des informations d'un compte
exports.updateCompte = async (req, res) => {
    try {
        const session = store.openSession();
        const compte = await session.load(`comptes/${req.params.id}`);

        if (!compte) {
            return res.status(404).json({ error: "Compte non trouvé" });
        }

        // Empêcher la modification du userId
        if (req.body.userId && req.body.userId !== compte.userId) {
            return res.status(400).json({ error: "Impossible de modifier l'utilisateur associé au compte" });
        }

        Object.assign(compte, req.body);
        await session.saveChanges();
        res.json({ message: "Compte mis à jour avec succès", compte });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du compte:", error);
        res.status(500).json({ error: "Erreur lors de la mise à jour du compte" });
    }
};

// Suppression d'un compte
exports.deleteCompte = async (req, res) => {
    try {
        const session = store.openSession();
        await session.delete(`comptes/${req.params.id}`);
        await session.saveChanges();

        res.json({ message: "Compte supprimé avec succès" });
    } catch (error) {
        console.error("Erreur lors de la suppression du compte:", error);
        res.status(500).json({ error: "Erreur lors de la suppression du compte" });
    }
};
// Récupérer les informations du compte et de l'utilisateur
exports.getUserAccountInfo = async (req, res) => {
    try {
        const session = store.openSession();
        let userId = decodeURIComponent(req.params.userId);

        console.log('Received User ID:', userId); // Debug log

        // Essayer plusieurs formats d'ID
        const possibleFormats = [
            userId, // Format original
            userId.startsWith("users/") ? userId : `users/${userId}`, // Avec préfixe
            userId.replace(/^users\//, '') // Sans préfixe
        ];

        let user = null;
        let usedFormat = null;

        // Tester tous les formats possibles
        for (const format of possibleFormats) {
            try {
                user = await session.load(format);
                if (user) {
                    usedFormat = format;
                    break;
                }
            } catch (e) {
                console.log(`Tried format "${format}" - not found`);
            }
        }

        if (!user) {
            return res.status(404).json({ 
                error: 'Utilisateur introuvable',
                details: {
                    receivedId: req.params.userId,
                    decodedId: userId,
                    triedFormats: possibleFormats
                }
            });
        }

        console.log(`Found user with format: ${usedFormat}`); // Debug log

        // Récupérer les comptes avec le format qui a fonctionné
        const comptes = await session.query({ collection: 'comptes' })
                                   .whereEquals('userId', usedFormat)
                                   .all();

        const response = {
            user: {
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                birthDate: user.birthDate,
                idNumber: user.idNumber,
                userId: user.id // Retourne l'ID complet
            },
            accounts: comptes.map(compte => ({
                accountId: compte.id,
                accountNumber: compte.numeroCompte,
                accountType: compte.typeCompte,
                currency: compte.devise,
                balance: compte.soldeActuel,
                status: compte.statutCompte,
                cardNumber: compte.cardNumber || '',
                expiryDate: compte.expiryDate || '',
                cardType: compte.cardType || 'VISA',
                creditLimit: compte.creditLimit || 0
            }))
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Detailed error:', {
            message: error.message,
            stack: error.stack,
            receivedUserId: req.params.userId
        });
        res.status(500).json({ 
            error: "Erreur serveur",
            details: error.message 
        });
    }
};

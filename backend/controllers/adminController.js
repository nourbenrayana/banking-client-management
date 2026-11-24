const store = require('../config/db');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'devSecret'; 


// Récupérer tous les utilisateurs
const getAllUsers = async (req, res) => {
  const session = store.openSession();

  try {
    const users = await session.query({ collection: 'users' }).all();

    const formattedUsers = users.map(user => {
      const metadata = user['@metadata'] || {};
      const id = metadata['@id'] || '';
      const rawDate = user.birthDate;

      // Simplifier le formatage de la date
      let formattedDate = 'Non disponible';
      if (rawDate) {
        // Si la date est au format "DD/MM/YYYY"
        if (typeof rawDate === 'string' && rawDate.includes('/')) {
          const [day, month, year] = rawDate.split('/');
          formattedDate = `${day} ${getMonthName(month)} ${year}`;
        }
        // Si c'est un objet Date ou un timestamp
        else if (!isNaN(new Date(rawDate).getTime())) {
          const date = new Date(rawDate);
          formattedDate = `${date.getDate()} ${getMonthName(date.getMonth() + 1)} ${date.getFullYear()}`;
        }
      }

      return {
        id: id.replace(/^users\//, ''),
        name: user.name || user.fullName || 'Non spécifié',
        email: user.email || 'Non disponible',
        birthDate: formattedDate,
        phone: user.phone || '',
        isAdmin: user.isAdmin || false
      };
    });

    res.json(formattedUsers);
  } catch (err) {
    console.error('🚨 Erreur serveur (admin):', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Helper function pour obtenir le nom du mois
function getMonthName(monthNumber) {
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return months[parseInt(monthNumber, 10) - 1];
}
const getDashboardStats = async (req, res) => {
  try {
    const session = store.openSession();

    // Get all users
    const users = await session.query({ collection: "users" }).all();

    const monthlySignups = {};
    const activityData = [];

    const now = new Date();

    // Init 6 months window
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
      monthlySignups[key] = 0;
      activityData.push({ name: key, new: 0, active: 0 });
    }

    users.forEach((user) => {
      const modified = new Date(user['@metadata']['@last-modified']);
      const key = `${modified.getMonth() + 1}/${modified.getFullYear()}`;
      if (monthlySignups[key] !== undefined) {
        monthlySignups[key]++;
        const monthEntry = activityData.find(entry => entry.name === key);
        if (monthEntry) {
          monthEntry.new++;
          // Simuler activité pour l'exemple : on considère qu'un utilisateur est actif si email contient 'gmail'
          if (user.email.includes("gmail")) monthEntry.active++;
        }
      }
    });

    const formattedMonthlySignups = Object.entries(monthlySignups).map(
      ([name, count]) => ({ name, count })
    );

    return res.status(200).json({
      monthlySignups: formattedMonthlySignups,
      activityData,
      statusData: [
        { name: "Actifs", value: users.filter(u => u.email.includes("gmail")).length },
        { name: "Inactifs", value: users.filter(u => !u.email.includes("gmail")).length }
      ]
    });
  } catch (error) {
    console.error("DashboardStats Error:", error);
    return res.status(500).json({ message: "Erreur lors du chargement des statistiques" });
  }
};


const getBankStats = async (req, res) => {
  try {
    const session = store.openSession();

    const comptes = await session.query({ collection: "comptes" }).all();

    let totalBalance = 0;
    const transactionData = [];
    const accountTypeStats = {};

    comptes.forEach((compte) => {
      totalBalance += compte.soldeActuel || 0;

      // Stats par type de compte
      const type = compte.typeCompte || 'Non spécifié';
      accountTypeStats[type] = (accountTypeStats[type] || 0) + 1;

      // Regrouper les montants par mois pour transactions simulées
      const date = new Date(compte.dateOuverture);
      const key = `${date.getDate()}/${date.getMonth() + 1}`;

      const existing = transactionData.find((t) => t.date === key);
      if (existing) {
        existing.amount += compte.soldeActuel || 0;
      } else {
        transactionData.push({ date: key, amount: compte.soldeActuel || 0 });
      }
    });

    // Calcul des pourcentages par type
    const totalAccounts = comptes.length;
    const formattedTypeStats = Object.entries(accountTypeStats).map(([name, value]) => ({
      name,
      value: totalAccounts > 0 ? Math.round((value / totalAccounts) * 100) : 0
    }));

    return res.status(200).json({
      totalBalance,
      transactionData,
      accountTypeStats: formattedTypeStats
    });
  } catch (error) {
    console.error("BankStats Error:", error);
    return res.status(500).json({ message: "Erreur lors du chargement des statistiques bancaires" });
  }
};


// Endpoint de connexion
const login = async (req, res) => {
  const session = store.openSession();
  const { email, pin } = req.body;

  if (!email || !pin) {
    return res.status(400).json({ error: 'Email et PIN sont requis.' });
  }

  try {
    // Recherche insensible à la casse pour l'email
    const user = await session.query({ collection: 'Users' })
      .whereEquals('email', email.toLowerCase().trim())
      .firstOrNull();

    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    // Vérification du PIN (en tant que chaîne de caractères)
    if (user.pin.toString() !== pin.toString()) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    // Vérification du statut admin
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }

    const token = jwt.sign(
      {
        id: user['@metadata']['@id'],
        isAdmin: true // Force le statut admin
      },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Erreur de connexion:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
  }
};
  
module.exports = { getAllUsers, login, getDashboardStats, getBankStats };

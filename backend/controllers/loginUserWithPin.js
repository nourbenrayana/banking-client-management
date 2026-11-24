const bcrypt = require('bcrypt');

const loginUserWithPin = (session) => async (req, res) => {
  const { email, pin } = req.body;

  if (!email || !pin) {
    return res.status(400).json({ message: 'Email et PIN requis.' });
  }

  try {
    const user = await session.query({ collection: 'users' })
      .whereEquals('email', email)
      .firstOrNull();

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    if (!user.pin) {
      return res.status(400).json({ message: 'Aucun PIN enregistré pour cet utilisateur.' });
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(401).json({ message: 'PIN incorrect.' });
    }

    // Recherche du compte lié à l'utilisateur
    const comptes = await session.query({ collection: 'comptes' })
  .whereEquals('userId', user.id)
  .firstOrNull();

if (!comptes) {
  return res.status(404).json({ message: 'Compte introuvable' });
}

res.status(200).json({
  message: 'Connexion réussie',
  user: {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    birthDate: user.birthDate,
    idNumber: user.idNumber,
    userId: user.id
  },
  account: {
    accountId: comptes['@metadata']['@id'],
    creditLimit: 0, // à ajuster si nécessaire
    accountNumber: comptes.numeroCompte,
    accountType: comptes.typeCompte,
    currency: comptes.devise,
    balance: comptes.soldeActuel,
    cardNumber: '', // à compléter si tu as cette donnée
    expiryDate: '', // à compléter
    cardType: '',   // à compléter
    status: comptes.statutCompte
  }
});


  } catch (error) {
    console.error('Erreur login :', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

module.exports = { loginUserWithPin };

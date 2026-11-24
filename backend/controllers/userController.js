const Joi = require('joi');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const store = require('../config/db');

const userSchema = Joi.object({
  fullName: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\d{8,15}$/).required(),
  birthDate: Joi.string().pattern(/^\d{2}\/\d{2}\/\d{4}$/).required(),
  idNumber: Joi.string().min(5).required(),
  pin: Joi.string().length(6).pattern(/^\d{6}$/).required() 
});
const updateUserSchema = Joi.object({
  fullName: Joi.string().min(3),
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^\d{8,15}$/),
  birthDate: Joi.string().pattern(/^\d{2}\/\d{2}\/\d{4}$/)
});


async function findUserByEmail(session, email) {
  return await session.query({ collection: 'users' })
    .whereEquals('email', email)
    .firstOrNull();
}

const registerUser = async (req, res) => {
  const session = store.openSession();
  const { error } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { fullName, email, phone, birthDate, idNumber, pin } = req.body;

  try {
    const existingUser = await findUserByEmail(session, email);
    if (existingUser) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }

    // Hash du PIN
    const hashedPin = await bcrypt.hash(pin, 10);
    const userId = `users/${uuidv4()}`;
    const user = {
      id: userId,
      fullName,
      email,
      phone,
      birthDate,
      idNumber,
      pin: hashedPin,
      isAdmin: false,
      "@metadata": { "@collection": "users" }
    };

    await session.store(user);
    await session.saveChanges();

    res.status(201).json({
      message: 'Inscription réussie',
      userId,
      user: { ...user, pin: undefined }, // ne jamais retourner le PIN
    });

  } catch (err) {
    console.error('🚨 Erreur serveur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
const deleteUser = async (req, res) => {
  const session = store.openSession();
  const { id } = req.params;

  try {
    // 1. Vérifiez que l'ID est correctement reçu
    console.log("ID reçu pour suppression:", id);

    // 2. Chargez l'utilisateur pour vérifier son existence
    const user = await session.load(`users/${id}`);
    if (!user) {
      console.log("Utilisateur non trouvé avec ID:", id);
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    // 3. Journalisation avant suppression
    console.log("Suppression de l'utilisateur:", {
      id: user.id,
      email: user.email
    });

    // 4. Suppression effective
    await session.delete(`users/${id}`);
    await session.saveChanges();

    console.log("Suppression réussie pour l'ID:", id);
    res.status(200).json({ 
      message: "Utilisateur supprimé avec succès.",
      deletedId: id // Renvoyez l'ID supprimé pour vérification
    });

  } catch (error) {
    console.error("Erreur complète lors de la suppression:", error);
    res.status(500).json({ 
      error: "Erreur serveur lors de la suppression.",
      details: error.message 
    });
  }
};

module.exports = { registerUser, deleteUser };



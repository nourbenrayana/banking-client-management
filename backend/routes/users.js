const express = require('express');
const router = express.Router();
const store = require('../config/db');

// GET /api/users/:id
router.get('/:id', async (req, res) => {
    const rawId = req.params.id;
    const userId = rawId.startsWith('users/') ? rawId : `users/${rawId}`;
  
    try {
      const session = store.openSession();
      const user = await session.load(userId);
  
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
  
      res.json(user);
    } catch (err) {
      console.error('Erreur lors de la récupération du user:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  
  module.exports = router;

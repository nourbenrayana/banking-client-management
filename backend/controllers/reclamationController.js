const store = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function createReclamation(req, res) {
  try {
    const { message, userId, type } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const session = store.openSession();

    const newReclamation = {
      message,
      userId,
      type: type || 'general', // Valeur par défaut si non spécifiée
      createdAt: new Date(),
      status: 'new',
      '@metadata': {
        '@collection': 'Reclamations'
      }
    };

    await session.store(newReclamation, `reclamations/${uuidv4()}`);
    await session.saveChanges();

    res.status(201).json({
      message: 'Reclamation submitted successfully',
      id: session.advanced.getDocumentId(newReclamation)
    });
  } catch (error) {
    console.error('Error creating reclamation:', error);
    res.status(500).json({ message: 'Error submitting reclamation' });
  }
}
async function getReclamations(req, res) {
  try {
    console.log('📥 Requête reçue pour /api/reclamations');
    const session = store.openSession();
    
    // Récupère les réclamations avec les informations de l'utilisateur
    const reclamations = await session.query({ collection: 'Reclamations' })
      .include('userId') // Ceci charge les utilisateurs associés en une seule requête
      .orderByDescending('createdAt')
      .all();

    // Pour chaque réclamation, récupère le nom de l'utilisateur
    const reclamationsWithUserNames = await Promise.all(reclamations.map(async (reclamation) => {
      const user = await session.load(reclamation.userId);
      return {
        ...reclamation,
        userName: user ? `${user.fullName} ` : 'Utilisateur inconnu'
      };
    }));

    console.log('📦 Réclamations récupérées :', reclamationsWithUserNames);
    res.json(reclamationsWithUserNames || []);
  } catch (error) {
    console.error('❌ Erreur getReclamations :', error);
    res.status(500).json({ message: 'Error fetching reclamations' });
  }
}


async function getReclamationsByUser(req, res) {
  try {
    const { userId } = req.params;

    const session = store.openSession();
    const reclamations = await session.query({ collection: 'Reclamations' })
      .whereEquals('userId', userId)
      .orderByDescending('createdAt')
      .all();

    res.json(reclamations);
  } catch (error) {
    console.error('Error fetching user reclamations:', error);
    res.status(500).json({ message: 'Error fetching user reclamations' });
  }
}
async function updateReclamationStatus(req, res) {
  try {
    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ message: 'ID and status are required' });
    }

    const session = store.openSession();
    const reclamation = await session.load(id);

    if (!reclamation) {
      return res.status(404).json({ message: 'Reclamation not found' });
    }

    reclamation.status = status;
    await session.saveChanges();

    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Error updating status' });
  }
}


module.exports = {
  createReclamation,
  getReclamations,
  getReclamationsByUser,
  updateReclamationStatus

};

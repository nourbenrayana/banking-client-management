// controllers/cardController.js
const store = require('../config/db');
const socketManager = require('../sockets/socketManager');
const generateCPF = require('../services/cpfGenerator'); 


const submitCardRequest = async (req, res) => {
  try {
let {
  cardType,
  firstName,
  lastName,
  cpf, 
  birthDate,
  address,
  city,
  zipCode,
  phone,
  email,
  reasonForCard,
  userId
} = req.body;

if (!firstName || !cardType) {
  return res.status(400).json({
    message: 'First name and card type are required.'
  });
}

// Générer CPF si non fourni
if (!cpf) {
  cpf = generateCPF();
}


    const session = store.openSession();

    // Nettoyage du userId (suppression de tous les préfixes "users/")
    const cleanUserId = userId?.replace(/^(users\/)+/, '').trim();

    const newRequest = {
      cardType,
      firstName,
      lastName,
      cpf,
      birthDate,
      address,
      city,
      zipCode,
      phone,
      email,
      reasonForCard,
      userId: `users/${cleanUserId}`,  // Reconstruction propre
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await session.store(newRequest);

    const metadata = session.advanced.getMetadataFor(newRequest);
    metadata['@collection'] = 'CardRequests';

    await session.saveChanges();

    // Émettre une notification via Socket.io
    socketManager.emitNewCardRequest(newRequest);

    res.status(201).json({ 
      message: 'Card request submitted successfully.',
      requestId: newRequest.id
    });
  } catch (error) {
    console.error('Error submitting card request:', error);
    res.status(500).json({ 
      message: 'Internal server error.',
      error: error.message 
    });
  }
};

const getAllCardRequests = async (req, res) => {
  try {
    const session = store.openSession();
    const cardRequests = await session
      .query({ collection: 'CardRequests' })
      .orderByDescending('createdAt')
      .all();

    res.status(200).json(cardRequests);
  } catch (error) {
    console.error('Error fetching card requests:', error);
    res.status(500).json({ 
      message: 'Internal server error.',
      error: error.message 
    });
  }
};

const respondToCardRequest = async (req, res) => {
  try {
    const { requestId, status, adminNotes } = req.body;

    if (!requestId || (status !== 'accepted' && status !== 'rejected')) {
      return res.status(400).json({ 
        message: 'Invalid request ID or status.' 
      });
    }

    const session = store.openSession();
    const cardRequest = await session.load(requestId);

    if (!cardRequest) {
      return res.status(404).json({ 
        message: 'Card request not found.' 
      });
    }

    cardRequest.status = status;
    cardRequest.adminNotes = adminNotes || '';
    cardRequest.updatedAt = new Date();
    
    await session.saveChanges();

    // Envoyer une notification à l'utilisateur
    const notification = {
      title: `Demande de carte ${status === 'accepted' ? 'acceptée' : 'refusée'}`,
      message: status === 'accepted' 
        ? 'Votre demande de carte a été acceptée.' 
        : `Votre demande de carte a été refusée. Raison: ${adminNotes || 'non spécifiée'}`,
      data: {
        requestId: cardRequest.id,
        status: status
      }
    };
let userIdToNotify = cardRequest.userId;

if (!userIdToNotify.startsWith('users/')) {
  userIdToNotify = `users/${userIdToNotify}`;
}
console.log("Envoi de notification à :", userIdToNotify); // pour vérification
socketManager.sendNotificationToUser(userIdToNotify, notification);


    res.status(200).json({ 
      message: `Card request ${status} successfully.`,
      request: cardRequest
    });
  } catch (error) {
    console.error('Error responding to card request:', error);
    res.status(500).json({ 
      message: 'Internal server error.',
      error: error.message 
    });
  }
};

module.exports = {
  submitCardRequest,
  getAllCardRequests,
  respondToCardRequest
};
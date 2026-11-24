// sockets/socketManager.js
let io;
const connectedUsers = {}; // Pour suivre les utilisateurs connectés

exports.init = (ioInstance) => {
  io = ioInstance;

  io.on('connection', (socket) => {
    console.log('New client connected');

    // Écouter l'authentification de l'utilisateur
    socket.on('authenticate', (userId) => {
      // Nettoyer les anciennes connexions du même utilisateur
      for (const [key, value] of Object.entries(connectedUsers)) {
        if (key === userId || value === socket.id) {
          delete connectedUsers[key];
        }
      }
      // Ajouter la nouvelle connexion
      connectedUsers[userId] = socket.id;
      console.log("🔗 Connexions actives:", connectedUsers); // Debug
    });
  
    socket.on('disconnect', () => {
      // Nettoyer les utilisateurs déconnectés
      for (const userId in connectedUsers) {
        if (connectedUsers[userId] === socket.id) {
          delete connectedUsers[userId];
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });
  });

  return io;
};

// Fonction existante pour les demandes de carte (à conserver)
exports.emitNewCardRequest = (request) => {
  if (io) {
    io.emit('new_card_request', {
      id: request.id,
      firstName: request.firstName,
      lastName: request.lastName,
      cardType: request.cardType,
      createdAt: request.createdAt
    });
  }
};


// Nouvelle fonction pour les notifications de virement
exports.sendNotificationToUser = (userId, notification) => {
  console.log("🔔 Attempting to send notification to:", userId);
  console.log("Current connected users:", Object.keys(connectedUsers));

  if (io && connectedUsers[userId]) {
    console.log("✅ User is connected, sending notification");
    io.to(connectedUsers[userId]).emit("notification", {
      type: "notification",
      payload: {
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
      },
    });
    return true;
  }

  console.warn(`❌ User ${userId} not connected or WebSocket not initialized`);
  return false;
};

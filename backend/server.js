require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const store = require('./config/db');
const SECRET_KEY = process.env.SECRET_KEY || 'devSecret';
const socketManager = require('./sockets/socketManager');

const connectedUsers = {};

// Routes
const compteRoutes = require('./routes/compteRoutes');
const factureRoutes = require('./routes/factureRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const userRoutes = require('./routes/userRoutes');
const usersExtraRoutes = require('./routes/users');
const adminRoutes = require('./routes/adminRoutes');
const cardRequestRoutes = require('./routes/cardRequestRoutes');
const reclamationRoutes = require('./routes/reclamationRoutes');


// WebSocket Notifier
const {
  initSocketIO,
  registerUser,
  removeUserBySocket,
  sendNotificationToUser
} = require('./services/websocketNotifier');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

initSocketIO(io);

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

// RavenDB health check
app.get('/api/health', async (req, res) => {
  try {
    const session = store.openSession();
    const stats = await session.advanced.documentStore.maintenance.server.send(
      new store.operations.GetStatisticsOperation()
    );
    res.json({ message: "✅ Connexion réussie à RavenDB", database: stats.Database });
  } catch (error) {
    console.error("❌ Erreur de connexion à RavenDB:", error);
    res.status(500).json({ error: "Impossible de se connecter à la base de données." });
  }
});

// Routes
app.use('/api/comptes', compteRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes(store.openSession()));
app.use('/api/users', usersExtraRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', cardRequestRoutes);
app.use('/api/reclamations', reclamationRoutes);


module.exports = { app, server };

// Start server
const PORT = 3000;
const HOST = '0.0.0.0'; // <- écoute sur toutes les IP

server.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur + WebSocket en écoute sur http://${HOST}:${PORT}`);
});
// Initialiser Socket.io
socketManager.init(io);

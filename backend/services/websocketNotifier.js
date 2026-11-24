// websocketNotifier.js
const socketManager = require('../sockets/socketManager');

function initSocketIO(io) {
  return socketManager.init(io);
}

function registerUser(userId, socket) {
  return socketManager.registerUser(userId, socket);
}

function removeUserBySocket(socketId) {
  return socketManager.removeUserBySocket(socketId);
}

function sendNotificationToUser(userId, notification) {
  return socketManager.sendNotificationToUser(userId, notification);
}

module.exports = {
  initSocketIO,
  registerUser,
  removeUserBySocket,
  sendNotificationToUser
};

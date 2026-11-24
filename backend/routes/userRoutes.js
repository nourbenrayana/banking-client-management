const express = require('express');
const { registerUser, deleteUser } = require('../controllers/userController');
const { loginUserWithPin } = require('../controllers/loginUserWithPin');

const userRoutes = (session) => {
  const router = express.Router();
  
  // Routes sous /api/users
  router.post('/register', (req, res) => registerUser(req, res));
  router.post('/login-pin', (req, res) => loginUserWithPin(session)(req, res));
  router.delete('/:id', (req, res) => deleteUser(req, res));

  return router;
};

module.exports = userRoutes;
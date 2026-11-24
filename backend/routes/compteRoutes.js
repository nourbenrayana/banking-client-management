const express = require('express');
const router = express.Router();
const { createCompte, getCompteById, getComptesByUserId,updateCompte, deleteCompte, getUserAccountInfo } = require('../controllers/CompteController');

// 🔹 Définition des routes
router.post('/', createCompte);
router.get('/:id', getCompteById);
router.get('/user/:userId', getComptesByUserId);


router.put('/:id', updateCompte);
router.delete('/:id', deleteCompte);

router.get('/user-info/:userId', getUserAccountInfo);

module.exports = router;

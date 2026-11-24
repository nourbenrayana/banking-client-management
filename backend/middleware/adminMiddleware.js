const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'devSecret'; 
const protectAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    console.log('Aucun token fourni');
    return res.status(401).json({ message: 'Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    
    if (!decoded.isAdmin) {
      console.log('Tentative d\'accès non admin');
      return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.log('Erreur de vérification du token:', err.message);
    return res.status(403).json({ message: 'Token invalide ou expiré.' });
  }
};
module.exports = { protectAdmin };

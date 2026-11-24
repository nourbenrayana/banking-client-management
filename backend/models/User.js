
const { v4: uuidv4 } = require('uuid');

class User {
  constructor(name, email) {
    this.id = uuidv4(); // Générer un ID unique
    this.name = name;
    this.email = email;
    this.createdAt = new Date();
  }

  static async findByEmail(session, email) {
    return await session
      .query({ collection: 'Users' })
      .whereEquals('email', email)
      .firstOrNull();
  }

  static async create(session, name, email) {
    const user = new User(name, email);
    await session.store(user); // Enregistrer l'utilisateur dans la base de données
    await session.saveChanges(); // Sauvegarder les modifications dans la session
    return user;
  }
}

module.exports = User;

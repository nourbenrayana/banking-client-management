class Reclamation {
  constructor({
    userId,
    fullName,
    email,
    message,
    status = 'pending',
    createdAt = new Date()
  }) {
    this.userId = userId;
    this.fullName = fullName;
    this.email = email;
    this.message = message;
    this.status = status;
    this.createdAt = createdAt;
    this['@metadata'] = {
      '@collection': 'Reclamations' 
    };
  }
}

module.exports = Reclamation;
class Compte {
    constructor(id, typeCompte, solde, userId, accountNumber, currency) {
      this.id = id; // e.g., "comptes/UUID"
      this.typeCompte = typeCompte; // Ex: "courant", "épargne", etc.
      this.solde = solde; // Solde initial
      this.dateOuverture = new Date(); // Date actuelle
      this.statut = "actif"; // Pour usage en français
      this.status = "active"; // Pour usage en anglais ou dans la logique front
      this.userId = userId; // ID RavenDB de l'utilisateur
      this.accountNumber = accountNumber; // Numéro unique du compte
      this.currency = currency; // Ex: "EUR", "USD", "TND"
      this.balance = solde; // Redondant mais utile si des libs ou APIs attendent ce champ
  
      this["@metadata"] = {
        "@collection": "comptes"
      };
    }
  }
  
  module.exports = Compte;
  
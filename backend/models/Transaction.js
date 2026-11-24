class Transaction {
    constructor(id, montant, date, typeTransaction, compteExpediteur, compteDestinataire, statut) {
        this.id = id; // L'ID sera généré automatiquement par RavenDB
        this.montant = montant;
        this.date = date || new Date().toISOString();
        this.typeTransaction = typeTransaction;
        this.compteExpediteur = compteExpediteur;
        this.compteDestinataire = compteDestinataire;
        this.statut = statut || "en attente"; // Par défaut, la transaction est en attente
    }
}

module.exports = Transaction;

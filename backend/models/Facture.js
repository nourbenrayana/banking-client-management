class Facture {
    constructor(id, numeroFacture, montant, dateEcheance, statut, utilisateurId, qrCode) {
        this.id = id; // L'ID sera généré automatiquement par RavenDB
        this.numeroFacture = numeroFacture;
        this.montant = montant;
        this.dateEcheance = dateEcheance;
        this.statut = statut || "en attente"; // Par défaut, la facture est en attente
        this.utilisateurId = utilisateurId;
        this.qrCode = qrCode || null; // Le QR code est optionnel
        this.datePaiement = null; // La date de paiement sera ajoutée lors du paiement
    }
}

module.exports = Facture;

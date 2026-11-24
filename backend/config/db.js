const fs = require('fs');
const { DocumentStore } = require('ravendb');
require('dotenv').config();

const RAVENDB_URL = process.env.RAVENDB_URL;
const RAVENDB_DATABASE = process.env.RAVENDB_DATABASE;
const RAVENDB_CERT_PATH = process.env.RAVENDB_CERT_PATH;

if (!RAVENDB_URL || !RAVENDB_DATABASE || !RAVENDB_CERT_PATH) {
    console.error(" Erreur: Vérifiez votre fichier .env !");
    process.exit(1);
}

const authOptions = {
    certificate: fs.readFileSync(RAVENDB_CERT_PATH),
    type: "pfx",
};

const store = new DocumentStore(RAVENDB_URL, RAVENDB_DATABASE, authOptions);
store.initialize();

console.log(` Connecté à RavenDB: ${RAVENDB_DATABASE} à ${RAVENDB_URL}`);

module.exports = store;

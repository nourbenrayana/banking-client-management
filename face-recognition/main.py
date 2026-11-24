from flask import Flask
from flask_cors import CORS
import os

# Initialisation de l'application Flask
app = Flask(__name__)
CORS(app)

# Configuration pour permettre les requêtes cross-origin
app.config['CORS_HEADERS'] = 'Content-Type'

# Import des routes depuis les autres fichiers
from chatbot import app as chatbot_app
from server import app as server_app
from compareface import app as compareface_app  # Changed variable name to match Blueprint

# Enregistrement des blueprints avec des préfixes
app.register_blueprint(chatbot_app)
app.register_blueprint(server_app)
app.register_blueprint(compareface_app)  

# Route principale pour vérifier que le serveur fonctionne
@app.route('/')
def hello():
    return "Serveur principal en fonctionnement"

# Configuration et lancement du serveur
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
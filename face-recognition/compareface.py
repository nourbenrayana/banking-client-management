from flask import Flask, request, jsonify,Blueprint
import cv2
import numpy as np
import base64
import requests_pkcs12
from deepface import DeepFace
from deepface.modules.verification import find_distance
import os
import time
import logging
from typing import Dict, List, Optional

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Blueprint('compareface', __name__)

# Configuration RavenDB
RAVEN_URL = "https://a.free.test001.ravendb.cloud"
DATABASE_NAME = "pfe-app"
CERT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "certificates")
CERT_PATH = os.path.join(CERT_DIR, "free.test001.client.certificate.pfx")
FACES_COLLECTION = "faces"

# Vérification du certificat
if not os.path.exists(CERT_PATH):
    logger.error(f"Certificat introuvable à l'emplacement : {CERT_PATH}")
    raise FileNotFoundError(f"Certificat PKCS12 introuvable dans {CERT_DIR}")

class RavenDBConnector:
    @staticmethod
    def query_database(query: Dict) -> Optional[Dict]:
        """Exécute une requête sur RavenDB"""
        try:
            url = f"{RAVEN_URL}/databases/{DATABASE_NAME}/queries"
            response = requests_pkcs12.post(
                url,
                json=query,
                pkcs12_filename=CERT_PATH,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            return response.json() if response.status_code == 200 else None
        except Exception as e:
            logger.error(f"Erreur de connexion à RavenDB: {str(e)}")
            return None

class FaceProcessor:
    @staticmethod
    def base64_to_image(image_base64: str) -> Optional[np.ndarray]:
        """Convertit une chaîne base64 en image OpenCV"""
        try:
            if 'base64,' in image_base64:
                image_base64 = image_base64.split('base64,')[1]
            img_bytes = base64.b64decode(image_base64)
            return cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        except Exception as e:
            logger.error(f"Erreur de conversion base64 vers image: {str(e)}")
            return None

    @staticmethod
    def get_face_embedding(image: np.ndarray) -> Optional[List[float]]:
        """Extrait l'embedding facial d'une image"""
        try:
            resized_img = cv2.resize(image, (160, 160))
            return DeepFace.represent(
                resized_img,
                model_name="Facenet512",
                enforce_detection=False,
                detector_backend="skip"
            )[0]["embedding"]
        except Exception as e:
            logger.error(f"Erreur d'extraction d'embedding: {str(e)}")
            return None

@app.route('/api/compare_with_database', methods=['POST'])
@app.route('/api/compare_with_database', methods=['POST'])
def compare_with_database():
    """Endpoint pour comparer une image avec la base de données"""
    try:
        start_time = time.time()
        
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json", "success": False}), 400
        
        data = request.get_json()
        if not data or 'image_base64' not in data:
            return jsonify({"error": "image_base64 is required", "success": False}), 400

        input_image = FaceProcessor.base64_to_image(data['image_base64'])
        if input_image is None:
            return jsonify({"error": "Invalid image data", "success": False}), 400

        input_embedding = FaceProcessor.get_face_embedding(input_image)
        if input_embedding is None:
            return jsonify({"error": "Face embedding extraction failed", "success": False}), 400

        query = {"Query": f"from {FACES_COLLECTION} select id, name, image_base64, timestamp, userId"}
        faces_data = RavenDBConnector.query_database(query)
        
        if not faces_data or not faces_data.get('Results'):
            return jsonify({"error": "No faces found in database", "success": False}), 404

        matches = []
        for face in faces_data['Results']:
            try:
                if not face.get('image_base64'):
                    continue
                    
                db_image = FaceProcessor.base64_to_image(face['image_base64'])
                if db_image is None:
                    continue
                    
                db_embedding = FaceProcessor.get_face_embedding(db_image)
                if db_embedding is None:
                    continue
                    
                distance = find_distance(input_embedding, db_embedding, "euclidean_l2")
                
                matches.append({
                    "face_id": str(face.get('id', 'unknown')),
                    "name": str(face.get('name', 'unknown')),
                    "timestamp": str(face.get('timestamp', 'unknown')),
                    "user_id": str(face.get('userId', 'unknown')),
                    "distance": float(distance),
                    "match": bool(distance < 0.78)
                })
                
            except Exception as e:
                logger.error(f"Erreur traitement visage: {str(e)}")
                continue

        if not matches:
            return jsonify({
                "error": "No valid matches found",
                "success": False,
                "details": "No faces matched the threshold or no faces in database"
            }), 404

        # Trier les correspondances par distance
        matches.sort(key=lambda x: x['distance'])
        best_match = matches[0]

        response = {
            "best_match": {
                **best_match,
                "raw_user_id": best_match["user_id"].split('/')[-1]
            },
            "all_matches": matches,
            "match_found": best_match['match'],
            "processing_time": round(time.time() - start_time, 2),
            "success": True
        }

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Erreur globale: {str(e)}")
        return jsonify({"error": "Internal server error", "success": False}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint de vérification de santé"""
    try:
        test_query = {"Query": f"from {FACES_COLLECTION} select count()"}
        return jsonify({
            "status": "healthy",
            "ravendb_connected": bool(RavenDBConnector.query_database(test_query)),
            "success": True
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "success": False
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


from flask import Flask, request, jsonify, make_response,Blueprint
from flask_cors import CORS
import cv2
import numpy as np
import os
import time
import pickle
import base64
import uuid
import easyocr
import requests_pkcs12
import re
import json
import requests
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple
from deepface import DeepFace
from deepface.modules.verification import find_distance

# Initialisation Flask
app = Blueprint('server', __name__)
CORS(app)

# Répertoires
base_dir = os.path.dirname(os.path.abspath(__file__))
embeddings_dir = os.path.join(base_dir, 'embeddings')
detected_faces_dir = os.path.join(base_dir, 'detected_faces')
detected_text_dir = os.path.join(base_dir, 'detected_text')
registered_faces_dir = os.path.join(base_dir, 'registered_faces')
os.makedirs(registered_faces_dir, exist_ok=True)
os.makedirs(embeddings_dir, exist_ok=True)
os.makedirs(detected_faces_dir, exist_ok=True)
os.makedirs(detected_text_dir, exist_ok=True)

# Embeddings path
embeddings_path = os.path.join(embeddings_dir, "embs_facenet512.pkl")
if os.path.exists(embeddings_path):
    with open(embeddings_path, "rb") as file:
        embs = pickle.load(file)
        print("✅ Existing embeddings loaded.")
else:
    embs = {}
    print("⚠️ No embeddings found. Creating a new file.")

def save_embeddings():
    with open(embeddings_path, "wb") as file:
        pickle.dump(embs, file)
        print("💾 Embeddings saved.")

# Configuration RavenDB
RAVEN_URL = "https://a.free.test001.ravendb.cloud"
DATABASE_NAME = "pfe-app"
CERT_PATH = os.path.join(base_dir, "certificates", "free.test001.client.certificate.pfx")

def save_to_ravendb(document):
    try:
        doc_id = document["id"]
        url = f"{RAVEN_URL}/databases/{DATABASE_NAME}/docs?id={doc_id}"

        response = requests_pkcs12.put(
            url,
            json=document,
            pkcs12_filename=CERT_PATH,
        )

        if response.status_code in [200, 201, 204]:
            print("✅ Document saved to RavenDB.")
            return True
        else:
            print(f"❌ Failed to save document: {response.status_code}, {response.text}")
            return False
    except Exception as e:
        print(f"❌ Exception saving to RavenDB: {e}")
        return False

class AdvancedInfoDetector:
    def __init__(self, similarity_threshold: float = 0.75):
        self.similarity_threshold = similarity_threshold
        self.patterns = {
            'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'phone': r'(\+\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}',
            'date': r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b',
            'name': r'\b([A-ZÉÈÊËÀÂÇÔÏÜ][a-zéèêëàâçôïü]+(\s[A-ZÉÈÊËÀÂÇÔÏÜ][a-zéèêëàâçôïü]+)+)\b',
            'id': r'\b[A-Za-z0-9\-_]{5,}\b'
        }

    def preprocess(self, text: str) -> str:
        text = text.lower()
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'[^\w\s@./-]', '', text)
        return text.strip()

    def similarity_score(self, a: str, b: str) -> float:
        return SequenceMatcher(None, a, b).ratio()

    def find_matches(self, field: str, expected: str, text: str) -> Tuple[Dict, float]:
        clean_text = self.preprocess(text)
        clean_expected = self.preprocess(expected)

        result = {
            'field': field,
            'expected': expected,
            'exact_match': False,
            'similar_matches': [],
            'pattern_matches': [],
            'field_confidence': 0
        }

        if clean_expected in clean_text:
            result['exact_match'] = True
            result['field_confidence'] = 1.0

        words = clean_text.split()
        max_similarity = result['field_confidence']

        for i in range(len(words)):
            for j in range(i, min(i+4, len(words))):
                phrase = ' '.join(words[i:j+1])
                similarity = self.similarity_score(clean_expected, phrase)

                if similarity >= self.similarity_threshold:
                    if phrase not in [m['match'] for m in result['similar_matches']]:
                        result['similar_matches'].append({
                            'match': phrase,
                            'similarity': round(similarity, 2)
                        })
                    max_similarity = max(max_similarity, similarity)

        for pattern_type, pattern in self.patterns.items():
            if pattern_type in field.lower():
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    matched_text = match.group()
                    similarity = self.similarity_score(expected, matched_text)

                    if matched_text not in [m['match'] for m in result['pattern_matches']]:
                        result['pattern_matches'].append({
                            'match': matched_text,
                            'similarity': round(similarity, 2)
                        })
                        max_similarity = max(max_similarity, similarity)

        result['field_confidence'] = round(max_similarity, 2)
        return result, max_similarity

detector = AdvancedInfoDetector()
@app.route('/api/get_user_face', methods=['GET'])
def get_user_face():
    try:
        user_id = request.args.get('userId')
        if not user_id:
            return jsonify({"error": "userId parameter is required"}), 400

        # Add 'users/' prefix if missing
        if not user_id.startswith('users/'):
            user_id = f'users/{user_id}'

        url = f"{RAVEN_URL}/databases/{DATABASE_NAME}/queries"
        query = {
            "Query": f"from faces where userId = '{user_id}' order by timestamp desc"
        }

        response = requests_pkcs12.post(
            url,
            json=query,
            pkcs12_filename=CERT_PATH,
        )

        if response.status_code == 200:
            faces = response.json().get("Results", [])
            if faces:
                return jsonify(faces[0]), 200
            # Return empty response instead of 404
            return jsonify({"image_base64": None, "message": "No face found"}), 200
        return jsonify({"error": f"Failed to query RavenDB: {response.text}"}), 500

    except Exception as e:
        print(f"Error getting user face: {e}")
        return jsonify({"error": str(e)}), 500

#Comparaison des visages 


@app.route('/api/compare_faces', methods=['POST'])
def relay_to_facematcher():
    try:
        data = request.get_json()
        if not data or not data.get('search_image') or not data.get('candidate_image'):
            return jsonify({'error': 'search_image et candidate_image requis'}), 400
        
        # Validation du type
        if not isinstance(data['search_image'], str) or not isinstance(data['candidate_image'], str):
            return jsonify({'error': 'Invalid image data format'}), 400

        # Nettoyage base64
        search_image = data['search_image']
        candidate_image = data['candidate_image']
        if 'base64,' in search_image:
            search_image = search_image.split('base64,')[1]
        if 'base64,' in candidate_image:
            candidate_image = candidate_image.split('base64,')[1]

        # Validation base64
        try:
            base64.b64decode(search_image, validate=True)
            base64.b64decode(candidate_image, validate=True)
        except:
            return jsonify({'error': 'Invalid base64 data'}), 400

        payload = {
            'search_image': search_image,
            'candidate_image': candidate_image
        }

        response = requests.post(
            'https://137.184.100.1:9557/prsonface/comparefaces_64',
            json=payload,
            headers={'Content-Type': 'application/json'},
            verify=False,
            timeout=30
        )

        print("compare_faces status:", response.status_code)
        print("compare_faces body:", response.text)

        if response.status_code == 200:
            try:
                return jsonify(response.json()), 200
            except ValueError:
                return jsonify({'error': 'Invalid JSON response from server'}), 500
        else:
            error_message = response.text or f"Server returned status code {response.status_code}"
            return jsonify({'error': error_message}), response.status_code

    except requests.exceptions.Timeout:
        return jsonify({'error': 'Face comparison service timeout'}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Face comparison service error: {str(e)}'}), 502
    except Exception as e:
        print(f"General exception: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/get_last_registered_face', methods=['GET'])
def get_last_registered_face():
    try:
        files = [f for f in os.listdir(registered_faces_dir) if f.endswith('.jpg')]
        if not files:
            return jsonify({"error": "No registered faces found"}), 404
            
        files.sort(key=lambda x: os.path.getmtime(os.path.join(registered_faces_dir, x)), reverse=True)
        
        latest_file = os.path.join(registered_faces_dir, files[0])
        
        # Retourner l'image en base64
        with open(latest_file, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        
        return jsonify({
            "path": latest_file,
            "image_base64": encoded_string
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/get_document_faces', methods=['GET'])
def get_document_faces():
    try:
        files = [f for f in os.listdir(detected_faces_dir) if f.endswith('.png')]
        if not files:
            return jsonify({"error": "No document faces found"}), 404
            
        first_file = os.path.join(detected_faces_dir, files[0])
        with open(first_file, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        
        return jsonify({
            "image_base64": encoded_string,
            "content_type": "image/png"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/detect', methods=['POST'])
def detect_info():
    try:
        data = request.get_json()
        form_data = data.get('form_data', {})
        text = data.get('text', '')

        if not form_data or not text:
            return jsonify({'error': 'form_data and text are required'}), 400

        allowed_fields = {'name', 'date', 'id'}
        form_data = {k: v for k, v in form_data.items() if k in allowed_fields}

        results = {}
        confidence_scores = []

        field_weights = {
            'id': 0.5,
            'name': 0.3,
            'date': 0.2
        }

        for field, expected in form_data.items():
            if not expected:
                continue

            field_result, confidence = detector.find_matches(field, expected, text)
            results[field] = field_result
            confidence_scores.append((field, confidence))

        weighted_scores = []
        total_weight = 0

        for field, confidence in confidence_scores:
            weight = field_weights.get(field, 0.1)
            weighted_scores.append(confidence * weight)
            total_weight += weight

        global_confidence = round(sum(weighted_scores) / total_weight, 2) if total_weight > 0 else 0

        if global_confidence >= 0.85:
            recommendation = 'data_trusted'
        elif global_confidence >= 0.7:
            recommendation = 'review_required'
        else:
            recommendation = 'likely_incorrect'

        detection_summary = {
            'fields_found': sum(1 for r in results.values() if r['field_confidence'] >= 0.8),
            'fields_partial': sum(1 for r in results.values() if 0.5 <= r['field_confidence'] < 0.8),
            'fields_missing': sum(1 for r in results.values() if r['field_confidence'] < 0.5),
            'global_confidence': global_confidence,
            'recommendation': recommendation
        }

        response = {
            'results': results,
            'detection_summary': detection_summary,
            'success': True
        }

        return jsonify(response), 200

    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/api/detect_face', methods=['POST'])
def detect_face():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No file part"}), 400

        user_id = request.form.get("userId")
        if not user_id:
            return jsonify({"error": "Missing userId"}), 400

        image_file = request.files['image']
        nparr = np.frombuffer(image_file.read(), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        results = DeepFace.extract_faces(frame, detector_backend="opencv", enforce_detection=False)
        if not results:
            return jsonify({"error": "No face detected"}), 404

        result = results[0]
        facial_area = result.get("facial_area", {})
        x = facial_area.get("x", 0)
        y = facial_area.get("y", 0)
        w = facial_area.get("w", 0)
        h = facial_area.get("h", 0)

        cropped_face = frame[y:y+h, x:x+w]
        cropped_face_resized = cv2.resize(cropped_face, (224, 224))

        try:
            emb = DeepFace.represent(
                cropped_face_resized,
                model_name="Facenet512",
                enforce_detection=False,
                detector_backend="skip"
            )[0]["embedding"]
        except Exception as e:
            return jsonify({"error": f"Embedding failed: {str(e)}"}), 500

        min_dist = float("inf")
        match_name = None

        for name, emb2 in embs.items():
            dst = find_distance(emb, emb2, "euclidean_l2")
            if dst < min_dist:
                min_dist = dst
                match_name = name

        if min_dist >= 0.78:
            new_face_id = f"Unknown_{int(time.time())}"
            embs[new_face_id] = emb
            save_embeddings()
        else:
            new_face_id = match_name

        filename = os.path.join(registered_faces_dir, f"face_{int(time.time())}.jpg")
        cv2.imwrite(filename, cropped_face_resized)
        print(f"🖼️ Face saved locally: {filename}")

        _, buffer = cv2.imencode('.jpg', cropped_face_resized)
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        face_doc = {
            "@metadata": {
                "@collection": "faces"
            },
            "id": f"faces/{int(time.time())}",
            "userId": user_id,
            "name": new_face_id,
            "distance": min_dist,
            "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
            "image_base64": img_base64
        }

        if not save_to_ravendb(face_doc):
            time.sleep(1)
            if not save_to_ravendb(face_doc):
                return jsonify({"error": "Failed to save to RavenDB"}), 500

        return jsonify({
            "message": "Face detected and saved successfully.",
            "userId": user_id,
            "faceId": new_face_id,
            "distance": min_dist,
            "image_base64": img_base64
        }), 200

    except Exception as e:
        print(f"❌ Server error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/process', methods=['POST'])
def process_uploaded_image():
    if 'image' not in request.files:
        return jsonify({"error": "No file sent with the 'image' field"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No filename"}), 400

    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if image is None:
        return jsonify({"error": "Could not read the sent image"}), 400
    
    height, width = image.shape[:2]
    max_width = 800
    if width > max_width:
        scaling_factor = max_width / width
        new_height = int(height * scaling_factor)
        image = cv2.resize(image, (max_width, new_height))

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)

    extracted_faces = []
    for (x, y, w, h) in faces:
        face_image = image[y:y+h, x:x+w]
        face_id = str(uuid.uuid4())
        face_filename = os.path.join(detected_faces_dir, f"extracted_face_{face_id}.png")
        cv2.imwrite(face_filename, face_image)
        extracted_faces.append(face_filename)

    reader = easyocr.Reader(['en', 'pt'], gpu=False)
    result = reader.readtext(image)
    
    extracted_text = [detection[1] for detection in result]
    full_text = ' '.join(extracted_text)
    
    text_output_path = os.path.join(detected_text_dir, "detected_text.txt")
    with open(text_output_path, 'w', encoding='utf-8') as f:
        f.write(full_text)

    return jsonify({
        "message": "Image processed successfully",
        "faces_saved": extracted_faces,
        "extracted_text": full_text,
        "text_file": text_output_path
    })

@app.route('/api/verify_document', methods=['POST'])
def verify_document():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
            
        file = request.files['image']
        form_data = request.form.get('form_data')
        
        if not form_data:
            return jsonify({"error": "No form data provided"}), 400
            
        try:
            form_data = json.loads(form_data)
        except:
            return jsonify({"error": "Invalid form data format"}), 400

        file_bytes = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({"error": "Could not read the image"}), 400

        reader = easyocr.Reader(['en', 'pt'], gpu=False)
        result = reader.readtext(image)
        extracted_text = [detection[1] for detection in result]
        full_text = ' '.join(extracted_text)

        # Initialize text verification results
        text_verification_results = {}
        confidence_scores = []
        
        # Define field weights for confidence calculation
        field_weights = {
            'id': 0.5,
            'name': 0.3,
            'date': 0.2
        }
        
        # Process each field in form_data
        for field, expected in form_data.items():
            if not expected:
                continue
                
            field_result, confidence = detector.find_matches(field, expected, full_text)
            text_verification_results[field] = field_result
            confidence_scores.append((field, confidence))
        
        # Calculate global confidence
        weighted_scores = []
        total_weight = 0
        for field, confidence in confidence_scores:
            weight = field_weights.get(field, 0.1)
            weighted_scores.append(confidence * weight)
            total_weight += weight
            
        global_confidence = round(sum(weighted_scores) / total_weight, 2) if total_weight > 0 else 0
        
        # Determine recommendation based on confidence
        if global_confidence >= 0.85:
            recommendation = 'data_trusted'
        elif global_confidence >= 0.7:
            recommendation = 'review_required'
        else:
            recommendation = 'likely_incorrect'
        
        detection_summary = {
            'fields_found': sum(1 for r in text_verification_results.values() if r['field_confidence'] >= 0.8),
            'fields_partial': sum(1 for r in text_verification_results.values() if 0.5 <= r['field_confidence'] < 0.8),
            'fields_missing': sum(1 for r in text_verification_results.values() if r['field_confidence'] < 0.5),
            'global_confidence': global_confidence,
            'recommendation': recommendation
        }
        
        # Face detection and verification
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        face_results = []
        for (x, y, w, h) in faces:
            face_image = image[y:y+h, x:x+w]
            face_id = str(uuid.uuid4())
            face_filename = os.path.join(detected_faces_dir, f"extracted_face_{face_id}.png")
            cv2.imwrite(face_filename, face_image)
            
            face_resized = cv2.resize(face_image, (224, 224))
            try:
                emb = DeepFace.represent(
                    face_resized,
                    model_name="Facenet512",
                    enforce_detection=False,
                    detector_backend="skip"
                )[0]["embedding"]
                
                min_dist = float("inf")
                match_name = None
                for name, emb2 in embs.items():
                    dst = find_distance(emb, emb2, "euclidean_l2")
                    if dst < min_dist:
                        min_dist = dst
                        match_name = name
                
                face_results.append({
                    "face_id": face_id,
                    "match_name": match_name if min_dist < 0.78 else "Unknown",
                    "distance": min_dist,
                    "image_path": face_filename
                })
            except Exception as e:
                face_results.append({
                    "face_id": face_id,
                    "error": str(e),
                    "image_path": face_filename
                })

        return jsonify({
            "text_verification": {
                "results": text_verification_results,
                "detection_summary": detection_summary
            },
            "face_detection": face_results,
            "extracted_text": full_text,
            "success": True
        })

    except Exception as e:
        return jsonify({
            "error": str(e),
            "success": False
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

from flask import Flask, request, jsonify
import cv2
import numpy as np
import easyocr
import os
import uuid

app = Flask(__name__)

@app.route('/process', methods=['POST'])
def process_uploaded_image():
    # Vérifier si un fichier a été envoyé
    if 'image' not in request.files:
        return jsonify({"error": "Aucun fichier envoyé avec le champ 'image'"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Fichier sans nom"}), 400

    # Lire le fichier image uploadé
    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if image is None:
        return jsonify({"error": "Impossible de lire l'image envoyée"}), 400

    # Définir les dossiers de sortie pour les visages et les textes
    output_dir_faces = r"C:\Users\lenovo\Desktop\mon_projet\backend\Bank%20Client%20Registration%20mobile%20Application%20%28Flask%29\detected_faces"
    output_dir_text = r"C:\Users\lenovo\Desktop\mon_projet\backend\Bank%20Client%20Registration%20mobile%20Application%20%28Flask%29\detected_text"
    
    # Créer les dossiers si ils n'existent pas
    os.makedirs(output_dir_faces, exist_ok=True)
    os.makedirs(output_dir_text, exist_ok=True)

    # Chemin du fichier de texte
    text_output_path = os.path.join(output_dir_text, "detected_text.txt")

    # Traitement visage
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)

    extracted_faces = []
    for i, (x, y, w, h) in enumerate(faces):
        face_image = image[y:y+h, x:x+w]
        
        # Générer un ID unique pour chaque visage
        face_id = str(uuid.uuid4())  # Crée un ID unique basé sur UUID
        
        # Créer un nom de fichier unique pour chaque visage avec cet ID
        face_filename = os.path.join(output_dir_faces, f"extracted_face_{face_id}.png")
        
        # Enregistrer le visage extrait
        cv2.imwrite(face_filename, face_image)
        
        # Ajouter le nom du fichier à la liste des visages extraits
        extracted_faces.append(face_filename)

    # Détection texte
    reader = easyocr.Reader(['en', 'pt'], gpu=False)
    result = reader.readtext(image)

    # Sauvegarder les textes détectés dans un fichier
    with open(text_output_path, 'w', encoding='utf-8') as f:
        for detection in result:
            f.write(detection[1] + '\n')

    # Retourner les réponses JSON avec les chemins des fichiers
    return jsonify({
        "message": "Image traitée avec succès",
        "faces_saved": extracted_faces,
        "text_file": text_output_path
    })

if __name__ == '__main__':
    app.run(debug=True)


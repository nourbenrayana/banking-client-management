from deepface import DeepFace
from deepface.modules.verification import find_distance
import cv2
import time
import sys
import pickle
import cvzone
import os

# Create embeddings directory if it doesn't exist
embeddings_dir = './embeddings'
if not os.path.exists(embeddings_dir):
    os.makedirs(embeddings_dir)

# Create directory for saving cropped faces
faces_dir = './detected_faces'
if not os.path.exists(faces_dir):
    os.makedirs(faces_dir)

cap = cv2.VideoCapture(0)  # or use video file path if needed
start_time = time.time()
fps = 0
frame_count = 0
detected_faces = []
last_detection_time = 0

model_name = "Facenet512"
metrics = [{"cosine": 0.30}, {"euclidean": 20.0}, {"euclidean_l2": 0.78}]

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
ret, frame = cap.read()
frame_width = frame.shape[1]
frame_height = frame.shape[0]
out = cv2.VideoWriter("output.mp4", fourcc, 20.0, (frame_width, frame_height))

# Function to calculate and display FPS
def calculate_fps(start_time):
    current_time = time.time()
    fps = 1.0 / (current_time - start_time)
    start_time = current_time
    return fps, start_time


def clahe(image):
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(image)


# Load embeddings or create a new file if not found
embeddings_path = f"{embeddings_dir}/embs_facenet512.pkl"

if os.path.exists(embeddings_path):
    with open(embeddings_path, "rb") as file:
        embs = pickle.load(file)
        print("Existing embeddings file loaded successfully.")
else:
    embs = {}
    print("No existing embeddings file found. A new file will be created.")
    

# Function to save embeddings to a file
def save_embeddings():
    with open(embeddings_path, "wb") as file:
        pickle.dump(embs, file)
        print(f"Embeddings saved to {embeddings_path}")


while True:
    new_frame_time = time.time()
    ret, frame = cap.read()

    if not ret:
        print("Error: Frame not read successfully")
        break

    fps, start_time = calculate_fps(start_time)

    if frame_count % 5 == 0:
        detected_faces = []
        try:
            results = DeepFace.extract_faces(frame, detector_backend="opencv", enforce_detection=False)

            for result in results:
                if result["confidence"] >= 0.5:
                    x = result["facial_area"]["x"]
                    y = result["facial_area"]["y"]
                    w = result["facial_area"]["w"]
                    h = result["facial_area"]["h"]

                    x1 = x
                    y1 = y
                    x2 = x + w
                    y2 = y + h

                    cropped_face = frame[y : y + h, x : x + w]
                    cropped_face_resized = cv2.resize(cropped_face, (224, 224))
                    cropped_face_gray = cv2.cvtColor(cropped_face_resized, cv2.COLOR_BGR2GRAY)
                    cropped_face_norm = clahe(cropped_face_gray)
                    cropped_face_gray = cv2.cvtColor(cropped_face_norm, cv2.COLOR_GRAY2RGB)

                    emb = DeepFace.represent(cropped_face_gray, model_name=model_name, enforce_detection=False, detector_backend="skip")[0]["embedding"]

                    min_dist = float("inf")
                    match_name = None

                    for name, emb2 in embs.items():
                        dst = find_distance(emb, emb2, list(metrics[2].keys())[0])
                        if dst < min_dist:
                            min_dist = dst
                            match_name = name

                    if min_dist < list(metrics[2].values())[0]:
                        detected_faces.append((x1, y1, x2, y2, match_name, min_dist, (0, 255, 0)))
                        print(f"detected as: {match_name} {min_dist:.2f}")
                    else:
                        match_name = "Inconnu"
                        detected_faces.append((x1, y1, x2, y2, match_name, min_dist, (0, 0, 255)))
                        embs[match_name] = emb  # Store new face embedding
                        save_embeddings()  # Save embeddings after adding new one

                        # Save the cropped face as a PNG/JPG image
                        face_image_path = os.path.join(faces_dir, f"{match_name}_{frame_count}.png")
                        cv2.imwrite(face_image_path, cropped_face)

        except Exception as e:
            print(f"Error during face detection: {e}")

        last_detection_time = frame_count

    for x1, y1, x2, y2, name, min_dist, color in detected_faces:
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1)
        cvzone.putTextRect(frame, f"{name} {min_dist:.2f}", (x1 + 10, y1 - 12), scale=1.5, thickness=2, colorR=color)

    cv2.imshow("frame", frame)
    out.write(frame)

    frame_count += 1

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
out.release()
cv2.destroyAllWindows()

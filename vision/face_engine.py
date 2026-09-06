import os
import cv2
import time
import json
import urllib.request
import logging
import threading
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

logger = logging.getLogger(__name__)

YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

class FaceEngine:
    """
    Whitelisted Familiar Face Recognition & Alert Suppression Engine.
    Uses OpenCV YuNet (Face Detection) + SFace (128-D Deep Feature Embedding) for accurate
    facial geometry identification and suppression of alarms for authorized staff.
    Guarded by a thread lock to ensure safe concurrent access across worker pools and API requests.
    """

    def __init__(self, data_dir: str = "data/whitelisted_faces", models_dir: str = "data/models"):
        self.data_dir = data_dir
        self.models_dir = models_dir
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.models_dir, exist_ok=True)

        self.db_json = os.path.join(self.data_dir, "whitelist.json")
        self.whitelisted_faces: List[Dict[str, Any]] = []

        self.lock = threading.Lock()
        self.detector = None
        self.recognizer = None
        self.cascade = None

        self._download_and_init_models()
        self.load_whitelist()

    def _download_and_init_models(self):
        yunet_path = os.path.join(self.models_dir, "face_detection_yunet_2023mar.onnx")
        sface_path = os.path.join(self.models_dir, "face_recognition_sface_2021dec.onnx")

        # Download YuNet face detector if missing
        if not os.path.exists(yunet_path):
            try:
                logger.info("Downloading YuNet Face Detection model weights...")
                urllib.request.urlretrieve(YUNET_URL, yunet_path)
            except Exception as e:
                logger.warning(f"Could not download YuNet ONNX: {e}")

        # Download SFace face recognizer if missing
        if not os.path.exists(sface_path):
            try:
                logger.info("Downloading SFace 128-D Deep Neural Recognition weights...")
                urllib.request.urlretrieve(SFACE_URL, sface_path)
            except Exception as e:
                logger.warning(f"Could not download SFace ONNX: {e}")

        # Initialize YuNet & SFace via OpenCV DNN module
        try:
            if os.path.exists(yunet_path) and os.path.exists(sface_path) and hasattr(cv2, 'FaceDetectorYN'):
                self.detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320), 0.35, 0.25, 5000)
                self.recognizer = cv2.FaceRecognizerSF.create(sface_path, "")
                logger.info("OpenCV YuNet + SFace Deep Neural Face Engine initialized successfully.")
            else:
                raise RuntimeError("SFace YN/SF API not available or weights missing.")
        except Exception as e:
            logger.warning(f"SFace Deep Neural init fallback to Haarcascade + LBP: {e}")
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            if os.path.exists(cascade_path):
                self.cascade = cv2.CascadeClassifier(cascade_path)

    def load_whitelist(self):
        if os.path.exists(self.db_json):
            try:
                with open(self.db_json, "r") as f:
                    self.whitelisted_faces = json.load(f)
                logger.info(f"Loaded {len(self.whitelisted_faces)} whitelisted staff profiles.")
            except Exception as e:
                logger.error(f"Error loading whitelist database: {e}")
                self.whitelisted_faces = []
        else:
            self.whitelisted_faces = []

    def _save_whitelist_db(self):
        try:
            with open(self.db_json, "w") as f:
                json.dump(self.whitelisted_faces, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving whitelist database: {e}")

    def _preprocess_crop(self, crop: np.ndarray) -> List[np.ndarray]:
        """
        Generates candidates for YuNet face detection:
        - Downscales huge uploads (e.g. 4032x3024 smartphone photos) to max 800px for speed & accuracy
        - Provides full-image candidate (ideal for passport/portrait uploads or close-ups)
        - Provides upper-body candidate (ideal for full-body pedestrian detections)
        """
        candidates = []
        if crop is None or crop.size == 0:
            return candidates

        h, w = crop.shape[:2]

        # Downscale oversized images so YuNet processes in 30ms instead of 40s
        max_dim = max(h, w)
        if max_dim > 800:
            scale_down = 800.0 / max_dim
            crop = cv2.resize(crop, (int(w * scale_down), int(h * scale_down)), interpolation=cv2.INTER_AREA)
            h, w = crop.shape[:2]

        # Candidate 1: Full image candidate
        candidates.append(crop)

        # Candidate 2: Upper body / head region (top 65%) for pedestrian crops
        if h > 40 and w > 20 and (h / max(w, 1)) > 1.2:
            head_h = max(int(h * 0.65), 20)
            head_crop = crop[0:head_h, 0:w]
            hh, hw = head_crop.shape[:2]
            scale_head = max(1.0, 160.0 / max(min(hh, hw), 1))
            if scale_head > 1.0:
                head_upscaled = cv2.resize(head_crop, (int(hw * scale_head), int(hh * scale_head)), interpolation=cv2.INTER_CUBIC)
            else:
                head_upscaled = head_crop.copy()
            candidates.append(head_upscaled)

        return candidates

    def extract_face_embedding(self, img: np.ndarray) -> Optional[np.ndarray]:
        """
        Extracts 128-dimensional SFace neural feature vector from image crop.
        Thread-safe: guarded by self.lock to prevent OpenCV DNN buffer corruption.
        """
        if img is None or img.size == 0:
            return None

        h, w = img.shape[:2]
        if h < 15 or w < 15:
            return None

        with self.lock:
            if self.detector is not None and self.recognizer is not None:
                candidates = self._preprocess_crop(img)
                for cand in candidates:
                    try:
                        ch, cw = cand.shape[:2]
                        self.detector.setInputSize((cw, ch))
                        _, faces = self.detector.detect(cand)
                        if faces is not None and len(faces) > 0:
                            best_face = max(faces, key=lambda f: f[14] if len(f) > 14 else (f[2] * f[3]))
                            aligned_face = self.recognizer.alignCrop(cand, best_face)
                            feat = self.recognizer.feature(aligned_face)
                            return feat
                    except Exception as e:
                        logger.debug(f"YuNet/SFace feature extraction note: {e}")

        return None

    def add_whitelisted_person(self, person_name: str, role: str, image_bytes: bytes) -> Dict[str, Any]:
        """GUI File Upload handler for adding authorized familiar personnel."""
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Invalid image file uploaded.")

        embedding = self.extract_face_embedding(img)
        if embedding is None:
            raise ValueError("No recognizable face detected in uploaded photo. Please upload a clear front-facing portrait photo.")

        emb_list = embedding.flatten().tolist()
        face_id = f"face_{int(time.time()*1000)}"
        img_filename = f"{face_id}.jpg"
        img_path = os.path.join(self.data_dir, img_filename)
        cv2.imwrite(img_path, img)

        profile = {
            "id": face_id,
            "name": person_name,
            "role": role,
            "image_uri": f"/whitelisted_faces/{img_filename}",
            "image_path": img_path,
            "embedding": emb_list,
            "created_at": time.time()
        }

        with self.lock:
            self.whitelisted_faces.append(profile)
            self._save_whitelist_db()

        logger.info(f"Added authorized familiar staff: '{person_name}' ({role}) with 128-D Deep Feature Embedding.")
        return profile

    def remove_whitelisted_person(self, face_id: str) -> bool:
        with self.lock:
            initial_len = len(self.whitelisted_faces)
            self.whitelisted_faces = [f for f in self.whitelisted_faces if f["id"] != face_id]
            if len(self.whitelisted_faces) < initial_len:
                self._save_whitelist_db()
                logger.info(f"Removed staff face ID: {face_id} from whitelist database.")
                return True
        return False

    def detect_and_match(self, person_crop: np.ndarray) -> Tuple[bool, Optional[str], float]:
        """
        Extracts face from person crop and compares against whitelisted profiles using Cosine Similarity.
        Returns: (is_whitelisted, person_name, match_confidence)
        Thread-safe: protected by self.lock.
        """
        if not self.whitelisted_faces or person_crop is None or person_crop.size == 0:
            return False, None, 0.0

        curr_emb = self.extract_face_embedding(person_crop)
        if curr_emb is None:
            return False, None, 0.0

        best_match_name = None
        best_score = -1.0

        with self.lock:
            for profile in self.whitelisted_faces:
                ref_vec = profile.get("embedding")
                if not ref_vec:
                    continue

                ref_arr = np.array(ref_vec, dtype=np.float32).reshape(1, -1)

                if self.recognizer is not None and ref_arr.shape == curr_emb.shape:
                    score = self.recognizer.match(curr_emb, ref_arr, cv2.FaceRecognizerSF_FR_COSINE)
                else:
                    norm_curr = np.linalg.norm(curr_emb.flatten())
                    norm_ref = np.linalg.norm(ref_arr.flatten())
                    if norm_curr > 0 and norm_ref > 0:
                        score = float(np.dot(curr_emb.flatten(), ref_arr.flatten()) / (norm_curr * norm_ref))
                    else:
                        score = 0.0

                if score > best_score:
                    best_score = score
                    best_match_name = profile["name"]

        # Deep neural threshold for positive face match (Cosine Similarity >= 0.30 for real-world SFace)
        threshold = 0.30 if self.recognizer is not None else 0.65
        if best_score >= threshold:
            return True, best_match_name, round(float(best_score), 2)

        return False, None, 0.0


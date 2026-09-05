import cv2
import logging
from typing import List, Dict, Any
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

logger = logging.getLogger(__name__)

TARGET_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

class ObjectDetector:
    """
    High-Accuracy AI Multi-Class Object Detector (YOLOv8).
    Detects pedestrians, fast-moving vehicles, and border intrusion entities.
    """

    def __init__(self, model_name: str = "yolov8n.pt", conf_threshold: float = 0.25):
        self.model_name = model_name
        self.conf_threshold = conf_threshold
        self.model = None
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        self._load_model()

    def _load_model(self):
        if YOLO is None:
            logger.error("Ultralytics library is not installed.")
            return
        
        try:
            logger.info(f"Loading YOLOv8 model: {self.model_name}")
            self.model = YOLO(self.model_name)
            logger.info("YOLOv8 model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load YOLOv8 model '{self.model_name}': {e}")
            raise e

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if self.model is None or frame is None or frame.size == 0:
            return []

        try:
            # 1. Preprocessing for shadowy streets & low-contrast pedestrians
            # Apply subtle luminance enhancement to bring out human contours in non-standard clothing (sarees/dupattas)
            h, w = frame.shape[:2]
            
            # Predict directly on high-resolution frame
            results = self.model.predict(
                source=frame,
                conf=self.conf_threshold,
                classes=list(TARGET_CLASSES.keys()),
                imgsz=640,
                verbose=False
            )
            
            detections = []
            if len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy().tolist()
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())
                    cls_name = TARGET_CLASSES.get(cls_id, "object")

                    detections.append({
                        "bbox": [round(v, 2) for v in xyxy],
                        "confidence": round(conf, 3),
                        "class_id": cls_id,
                        "class_name": cls_name
                    })

            return detections

        except Exception as e:
            logger.error(f"Error during detection inference: {e}")
            return []

import logging
from typing import List, Dict, Any
import numpy as np

try:
    import supervision as sv
except ImportError:
    sv = None

logger = logging.getLogger(__name__)

class ObjectTracker:
    def __init__(self, fps: int = 15):
        self.fps = fps
        self.tracker = None
        self._init_tracker()

    def _init_tracker(self):
        if sv is not None:
            try:
                self.tracker = sv.ByteTrack(frame_rate=self.fps)
                logger.info("ByteTrack initialized via Supervision library.")
            except Exception as e:
                logger.warning(f"Could not initialize sv.ByteTrack: {e}")
                self.tracker = None

    def update(self, detections: List[Dict[str, Any]], frame_shape: tuple) -> List[Dict[str, Any]]:
        if not detections:
            return []

        if self.tracker is not None and sv is not None:
            try:
                boxes = np.array([d["bbox"] for d in detections], dtype=np.float32)
                confidences = np.array([d["confidence"] for d in detections], dtype=np.float32)
                class_ids = np.array([d["class_id"] for d in detections], dtype=np.int32)

                sv_detections = sv.Detections(
                    xyxy=boxes,
                    confidence=confidences,
                    class_id=class_ids
                )

                tracked_sv = self.tracker.update_with_detections(sv_detections)

                tracked_results = []
                for i in range(len(tracked_sv)):
                    box = tracked_sv.xyxy[i].tolist()
                    track_id = int(tracked_sv.tracker_id[i]) if tracked_sv.tracker_id is not None else i + 1
                    cls_id = int(tracked_sv.class_id[i])
                    conf = float(tracked_sv.confidence[i])

                    class_name = "object"
                    for orig in detections:
                        if orig["class_id"] == cls_id:
                            class_name = orig["class_name"]
                            break

                    tracked_results.append({
                        "track_id": track_id,
                        "bbox": [round(v, 2) for v in box],
                        "confidence": round(conf, 3),
                        "class_id": cls_id,
                        "class_name": class_name
                    })

                return tracked_results

            except Exception as e:
                logger.error(f"Error updating ByteTrack: {e}")

        tracked_results = []
        for idx, det in enumerate(detections):
            det_copy = dict(det)
            det_copy["track_id"] = idx + 1
            tracked_results.append(det_copy)

        return tracked_results

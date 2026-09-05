import os
import cv2
import time
import logging
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional, Callable
import numpy as np

from vision.detector import ObjectDetector
from vision.tracker import ObjectTracker
from vision.rules import RuleEngine
from vision.stream_processor import StreamProcessor
from vision.anpr import ANPREngine
from vision.face_engine import FaceEngine

logger = logging.getLogger(__name__)

CLASS_COLORS = {
    "person": (0, 0, 255),       # Red
    "car": (255, 165, 0),        # Orange
    "motorcycle": (255, 255, 0), # Yellow
    "bus": (255, 0, 255),        # Purple
    "truck": (0, 165, 255),      # Orange-Red
    "bicycle": (0, 255, 255)     # Cyan
}

class VisionPipeline:
    """
    Main Video Analytics Pipeline for IBVAP.
    Runs continuous high-speed stream ingestion, detection, tracking, rule evaluation,
    asynchronous ThreadPool ANPR extraction, whitelisted face suppression, and snapshot saving.
    """

    def __init__(
        self,
        source: Any = 0,
        model_name: str = "yolov8n.pt",
        rules_config: List[Dict[str, Any]] = None,
        event_callback: Optional[Callable[[Dict[str, Any], np.ndarray], None]] = None,
        evidence_dir: str = "data/evidence"
    ):
        self.source = source
        self.evidence_dir = evidence_dir
        os.makedirs(self.evidence_dir, exist_ok=True)

        self.stream = StreamProcessor(source=source)
        self.detector = ObjectDetector(model_name=model_name)
        self.tracker = ObjectTracker()
        self.rule_engine = RuleEngine(rules_config=rules_config)
        self.event_callback = event_callback

        self.anpr_engine = ANPREngine()
        self.face_engine = FaceEngine()

        # Asynchronous Worker Pools for Non-Blocking Heavy Inference
        self.anpr_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ANPR_Worker")
        self.face_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="Face_Worker")
        self.pending_anpr_tracks = set()
        self.pending_face_tracks = set()

        self.plate_history: Dict[int, List[str]] = {}
        self.whitelisted_tracks: Dict[int, str] = {}

        self.latest_frame: Optional[np.ndarray] = None
        self.annotated_frame: Optional[np.ndarray] = None
        self.latest_detections: List[Dict[str, Any]] = []
        self.latest_tracks: List[Dict[str, Any]] = []
        self.latest_events: List[Dict[str, Any]] = []
        self.entity_counts: Dict[str, int] = {}

        self.current_fps: float = 0.0
        self.inference_latency_ms: float = 0.0
        self.is_running: bool = False
        self.thread: Optional[threading.Thread] = None

        self.frame_index = 0
        self.infer_stride = 2

    def start(self):
        if self.is_running:
            return

        self.is_running = True
        self.stream.open()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info("Vision Pipeline started with Asynchronous ThreadPool Worker Pool.")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        self.anpr_pool.shutdown(wait=False)
        self.face_pool.shutdown(wait=False)
        self.stream.release()
        logger.info("Vision Pipeline stopped.")

    def update_source(self, new_source: Any):
        logger.info(f"Pipeline updating video source to: {new_source}")
        self.source = new_source
        self.stream.change_source(new_source)

    def update_rules(self, rules_config: List[Dict[str, Any]]):
        self.rule_engine.update_rules(rules_config)

    def clear_face_cache(self):
        """Clears active track face recognition caches when whitelist database changes."""
        self.whitelisted_tracks.clear()
        self.pending_face_tracks.clear()
        logger.info("Cleared vision pipeline whitelisted track cache.")

    def toggle_pause(self) -> bool:
        return self.stream.toggle_pause()

    def seek_to_second(self, target_sec: float) -> bool:
        return self.stream.seek_to_second(target_sec)

    def get_playback_info(self) -> Dict[str, Any]:
        info = self.stream.get_playback_info()
        info["fps"] = self.current_fps
        info["latency_ms"] = self.inference_latency_ms
        info["entity_counts"] = self.entity_counts
        return info

    def _crop_object(self, frame: np.ndarray, bbox: List[float]) -> Optional[np.ndarray]:
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in bbox]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 - x1 < 10 or y2 - y1 < 10:
            return None
        return frame[y1:y2, x1:x2]

    def _async_extract_plate(self, track_id: int, crop: np.ndarray):
        """Asynchronous background worker for EasyOCR license plate extraction."""
        try:
            plate_str = self.anpr_engine.extract_license_plate(crop)
            if plate_str:
                if track_id not in self.plate_history:
                    self.plate_history[track_id] = []
                self.plate_history[track_id].append(plate_str)
        except Exception as e:
            logger.error(f"Error in async ANPR worker: {e}")
        finally:
            self.pending_anpr_tracks.discard(track_id)

    def _async_detect_face(self, track_id: int, crop: np.ndarray):
        """Asynchronous background worker for SFace neural face recognition."""
        try:
            is_white, p_name, conf = self.face_engine.detect_and_match(crop)
            if is_white and p_name:
                self.whitelisted_tracks[track_id] = p_name
        except Exception as e:
            logger.error(f"Error in async Face worker: {e}")
        finally:
            self.pending_face_tracks.discard(track_id)

    def _run_loop(self):
        prev_time = time.time()

        while self.is_running:
            start_t = time.time()
            ret, frame = self.stream.read_frame()

            if not ret or frame is None:
                time.sleep(0.02)
                continue

            self.latest_frame = frame.copy()
            h, w = frame.shape[:2]
            self.frame_index += 1

            if self.frame_index % self.infer_stride == 0 or not self.latest_detections:
                det_start = time.time()
                detections = self.detector.detect(frame)
                self.latest_detections = detections
                det_end = time.time()
                self.inference_latency_ms = round((det_end - det_start) * 1000.0, 1)
            else:
                detections = self.latest_detections

            tracked = self.tracker.update(detections, frame.shape)
            self.latest_tracks = tracked

            # Calculate entity breakdown counts
            counts: Dict[str, int] = {}
            active_track_ids = set()

            for obj in tracked:
                track_id = obj["track_id"]
                cname = obj.get("class_name", "object")
                bbox = obj["bbox"]
                counts[cname] = counts.get(cname, 0) + 1
                active_track_ids.add(track_id)

                # Process ANPR for vehicles asynchronously (Non-Blocking)
                if cname in ["car", "motorcycle", "bus", "truck"]:
                    if track_id not in self.pending_anpr_tracks and (track_id not in self.plate_history or len(self.plate_history[track_id]) < 3):
                        crop = self._crop_object(frame, bbox)
                        if crop is not None:
                            self.pending_anpr_tracks.add(track_id)
                            self.anpr_pool.submit(self._async_extract_plate, track_id, crop.copy())

                # Process Whitelist Face Detection for persons asynchronously (Non-Blocking)
                elif cname == "person":
                    if track_id not in self.whitelisted_tracks and track_id not in self.pending_face_tracks:
                        crop = self._crop_object(frame, bbox)
                        if crop is not None:
                            self.pending_face_tracks.add(track_id)
                            self.face_pool.submit(self._async_detect_face, track_id, crop.copy())

            self.entity_counts = counts

            # Active whitelisted names in database
            active_whitelisted_names = {f["name"] for f in self.face_engine.whitelisted_faces}

            # Clean up stale track histories or deleted whitelist profiles
            for tid in list(self.plate_history.keys()):
                if tid not in active_track_ids:
                    del self.plate_history[tid]
            for tid in list(self.whitelisted_tracks.keys()):
                if tid not in active_track_ids or self.whitelisted_tracks[tid] not in active_whitelisted_names:
                    del self.whitelisted_tracks[tid]

            # Evaluate virtual fence rules
            events = self.rule_engine.evaluate(tracked, w, h)
            valid_events = []

            for evt in events:
                tid = evt["track_id"]
                cname = evt["object_type"]

                # 1. Check if person is whitelisted familiar staff
                if cname == "person" and tid in self.whitelisted_tracks:
                    staff_name = self.whitelisted_tracks[tid]
                    if staff_name in active_whitelisted_names:
                        logger.info(f"Intrusion alarm suppressed for whitelisted staff: '{staff_name}' (Track #{tid})")
                        continue
                    else:
                        del self.whitelisted_tracks[tid]

                # 2. Attach majority-voted license plate for vehicles
                if cname in ["car", "motorcycle", "bus", "truck"] and tid in self.plate_history:
                    plates = self.plate_history[tid]
                    if plates:
                        most_common_plate = Counter(plates).most_common(1)[0][0]
                        evt["license_plate"] = most_common_plate

                valid_events.append(evt)

            self.latest_events = valid_events

            # Render canvas overlay
            annotated = self._render_overlay(frame, tracked, w, h)
            self.annotated_frame = annotated

            if valid_events and self.event_callback:
                for evt in valid_events:
                    evt_id = f"evt_{int(time.time()*1000)}_{evt['track_id']}"
                    evidence_filename = f"{evt_id}.jpg"
                    evidence_path = os.path.join(self.evidence_dir, evidence_filename)
                    cv2.imwrite(evidence_path, annotated)
                    
                    evt["event_id"] = evt_id
                    evt["evidence_uri"] = f"/evidence/{evidence_filename}"

                    try:
                        self.event_callback(evt, annotated)
                    except Exception as ex:
                        logger.error(f"Error executing event callback: {ex}")

            curr_time = time.time()
            dt = curr_time - prev_time
            prev_time = curr_time
            if dt > 0:
                self.current_fps = round(1.0 / dt, 1)

            target_dt = 1.0 / max(self.stream.target_fps, 1)
            elapsed = time.time() - start_t
            if elapsed < target_dt:
                time.sleep(target_dt - elapsed)

    def _render_overlay(self, frame: np.ndarray, tracked: List[Dict[str, Any]], w: int, h: int) -> np.ndarray:
        canvas = frame.copy()

        # 1. Draw Active Polygon Virtual Fences
        for rule in self.rule_engine.rules:
            if not rule.get("enabled", True):
                continue
            
            poly_pts = rule.get("polygon", [])
            if len(poly_pts) >= 3:
                is_normalized = all(0.0 <= p[0] <= 1.0 and 0.0 <= p[1] <= 1.0 for p in poly_pts)
                if is_normalized:
                    pts = np.array([[int(p[0]*w), int(p[1]*h)] for p in poly_pts], np.int32)
                else:
                    pts = np.array([[int(p[0]), int(p[1])] for p in poly_pts], np.int32)

                pts = pts.reshape((-1, 1, 2))
                
                overlay = canvas.copy()
                cv2.fillPoly(overlay, [pts], (0, 0, 200))
                cv2.addWeighted(overlay, 0.25, canvas, 0.75, 0, canvas)
                
                cv2.polylines(canvas, [pts], isClosed=True, color=(0, 0, 255), thickness=3)

                label_x = pts[0][0][0]
                label_y = max(pts[0][0][1] - 10, 20)
                cv2.putText(canvas, f"FENCE: {rule.get('name', 'RESTRICTED')}", (label_x, label_y),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2, cv2.LINE_AA)

        # 2. Draw Tracked Object Bounding Boxes & Identifiers
        for obj in tracked:
            bbox = obj["bbox"]
            track_id = obj["track_id"]
            class_name = obj["class_name"]
            conf = obj["confidence"]

            x1, y1, x2, y2 = [int(v) for v in bbox]

            # Custom styling for whitelisted personnel or plate recognition
            if track_id in self.whitelisted_tracks:
                color = (0, 230, 118) # Emerald green for authorized staff
                staff_name = self.whitelisted_tracks[track_id]
                label = f"#{track_id} STAFF: {staff_name.upper()}"
            else:
                color = CLASS_COLORS.get(class_name, (0, 255, 0))
                label = f"#{track_id} {class_name.upper()} {int(conf*100)}%"

                # Attach ANPR license plate label if available
                if track_id in self.plate_history and self.plate_history[track_id]:
                    best_plate = Counter(self.plate_history[track_id]).most_common(1)[0][0]
                    label += f" | PLATE: {best_plate}"

            cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)

            cx = (x1 + x2) // 2
            cy = y2
            cv2.circle(canvas, (cx, cy), 5, (0, 0, 255), -1)

            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(canvas, (x1, max(y1 - 22, 0)), (x1 + tw + 6, max(y1, 22)), color, -1)
            cv2.putText(canvas, label, (x1 + 3, max(y1 - 6, 16)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

        return canvas

    def get_encoded_mjpeg_frame(self) -> Optional[bytes]:
        if self.annotated_frame is None:
            return None
        ret, jpeg = cv2.imencode('.jpg', self.annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return jpeg.tobytes() if ret else None

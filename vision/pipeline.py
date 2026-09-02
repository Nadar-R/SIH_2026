import os
import cv2
import time
import logging
import threading
from typing import List, Dict, Any, Optional, Callable
import numpy as np

from vision.detector import ObjectDetector
from vision.tracker import ObjectTracker
from vision.rules import RuleEngine
from vision.stream_processor import StreamProcessor

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
    Runs continuous stream ingestion, detection, tracking, rule evaluation,
    and snapshot saving without any intrusive HUD overlay bar on video frames.
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
        logger.info("Vision Pipeline started.")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        self.stream.release()
        logger.info("Vision Pipeline stopped.")

    def update_source(self, new_source: Any):
        logger.info(f"Pipeline updating video source to: {new_source}")
        self.source = new_source
        self.stream.change_source(new_source)

    def update_rules(self, rules_config: List[Dict[str, Any]]):
        self.rule_engine.update_rules(rules_config)

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

    def _run_loop(self):
        prev_time = time.time()

        while self.is_running:
            start_t = time.time()
            ret, frame = self.stream.read_frame()

            if not ret or frame is None:
                time.sleep(0.04)
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
            for obj in tracked:
                cname = obj.get("class_name", "object")
                counts[cname] = counts.get(cname, 0) + 1
            self.entity_counts = counts

            events = self.rule_engine.evaluate(tracked, w, h)
            self.latest_events = events

            # Render overlay without any green HUD bar
            annotated = self._render_overlay(frame, tracked, w, h)
            self.annotated_frame = annotated

            if events and self.event_callback:
                for evt in events:
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

        # 2. Draw Tracked Object Bounding Boxes
        for obj in tracked:
            bbox = obj["bbox"]
            track_id = obj["track_id"]
            class_name = obj["class_name"]
            conf = obj["confidence"]

            x1, y1, x2, y2 = [int(v) for v in bbox]
            color = CLASS_COLORS.get(class_name, (0, 255, 0))

            cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)

            cx = (x1 + x2) // 2
            cy = y2
            cv2.circle(canvas, (cx, cy), 5, (0, 0, 255), -1)

            label = f"#{track_id} {class_name.upper()} {int(conf*100)}%"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(canvas, (x1, max(y1 - 22, 0)), (x1 + tw + 6, max(y1, 22)), color, -1)
            cv2.putText(canvas, label, (x1 + 3, max(y1 - 6, 16)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

        # NOTE: Green HUD bar removed per user request so video feed is completely clean.
        return canvas

    def get_encoded_mjpeg_frame(self) -> Optional[bytes]:
        if self.annotated_frame is None:
            return None
        ret, jpeg = cv2.imencode('.jpg', self.annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return jpeg.tobytes() if ret else None

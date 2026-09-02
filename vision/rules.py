import time
import logging
from typing import List, Dict, Any, Tuple
from shapely.geometry import Point, Polygon

logger = logging.getLogger(__name__)

def get_bottom_center(bbox: List[float]) -> Tuple[float, float]:
    x1, y1, x2, y2 = bbox
    return ((x1 + x2) / 2.0, y2)

class RuleEngine:
    def __init__(self, rules_config: List[Dict[str, Any]] = None):
        self.rules = rules_config or []
        self.track_history: Dict[int, Dict[str, Any]] = {}

    def update_rules(self, rules_config: List[Dict[str, Any]]):
        self.rules = rules_config or []
        logger.info(f"RuleEngine updated with {len(self.rules)} active rules.")

    def evaluate(self, tracked_objects: List[Dict[str, Any]], frame_width: int, frame_height: int) -> List[Dict[str, Any]]:
        triggered_events = []
        now = time.time()
        active_track_ids = set()

        for obj in tracked_objects:
            track_id = obj["track_id"]
            active_track_ids.add(track_id)
            bbox = obj["bbox"]
            class_name = obj["class_name"]
            confidence = obj["confidence"]

            px, py = get_bottom_center(bbox)

            if track_id not in self.track_history:
                self.track_history[track_id] = {
                    "inside_zones": set(),
                    "frame_counts": {},
                    "last_alert_times": {}
                }

            hist = self.track_history[track_id]

            for rule in self.rules:
                if not rule.get("enabled", True):
                    continue

                rule_id = rule["id"]
                allowed_classes = rule.get("object_types", ["person", "car", "motorcycle", "bus", "truck", "bicycle"])

                if class_name not in allowed_classes:
                    continue

                min_conf = rule.get("min_confidence", 0.40)
                if confidence < min_conf:
                    continue

                raw_polygon = rule.get("polygon", [])
                if len(raw_polygon) < 3:
                    continue

                is_normalized = all(0.0 <= p[0] <= 1.0 and 0.0 <= p[1] <= 1.0 for p in raw_polygon)
                if is_normalized:
                    poly_points = [(p[0] * frame_width, p[1] * frame_height) for p in raw_polygon]
                else:
                    poly_points = [(p[0], p[1]) for p in raw_polygon]

                try:
                    poly = Polygon(poly_points)
                    point = Point(px, py)

                    inside_now = poly.contains(point) or poly.touches(point)

                    min_frames = rule.get("min_frames", 2)
                    cooldown = rule.get("cooldown_seconds", 5)

                    current_frame_count = hist["frame_counts"].get(rule_id, 0)
                    last_alert_time = hist["last_alert_times"].get(rule_id, 0.0)

                    if inside_now:
                        current_frame_count += 1
                        hist["frame_counts"][rule_id] = current_frame_count

                        if current_frame_count >= min_frames and (now - last_alert_time) >= cooldown:
                            hist["last_alert_times"][rule_id] = now
                            
                            event_payload = {
                                "rule_id": rule_id,
                                "rule_name": rule.get("name", "Virtual Fence Intrusion"),
                                "event_type": "VIRTUAL_FENCE_INTRUSION",
                                "object_type": class_name,
                                "track_id": track_id,
                                "confidence": confidence,
                                "bbox": bbox,
                                "anchor_point": [round(px, 1), round(py, 1)],
                                "severity": rule.get("severity", "HIGH"),
                                "timestamp": now
                            }
                            triggered_events.append(event_payload)
                            logger.warning(f"INTRUSION DETECTED! Rule '{rule_id}' triggered by {class_name} (Track #{track_id})")
                    else:
                        hist["frame_counts"][rule_id] = 0

                except Exception as e:
                    logger.error(f"Error evaluating rule '{rule_id}': {e}")

        for tid in list(self.track_history.keys()):
            if tid not in active_track_ids:
                del self.track_history[tid]

        return triggered_events

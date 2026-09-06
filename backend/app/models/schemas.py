from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ZoneCreate(BaseModel):
    id: Optional[str] = None
    camera_id: str
    name: str
    geometry_type: str = "polygon"
    polygon: List[List[float]]
    min_confidence: float = 0.40
    min_frames: int = 2
    cooldown_seconds: int = 5
    severity: str = "HIGH"
    enabled: bool = True

class ZoneResponse(BaseModel):
    id: str
    camera_id: str
    name: str
    geometry_type: str
    polygon: List[List[float]]
    min_confidence: float
    min_frames: int
    cooldown_seconds: int
    severity: str
    enabled: bool
    created_at: float

class CameraCreate(BaseModel):
    id: str
    name: str
    source: str
    location: Optional[str] = "Border Outpost"
    enabled: bool = True

class CameraResponse(BaseModel):
    id: str
    name: str
    source: str
    location: str
    status: str
    enabled: bool
    created_at: float

class SourceSwitchRequest(BaseModel):
    camera_id: str = "cam-bop-01"
    source: str

class SeekRequest(BaseModel):
    target_sec: float

class EventAckRequest(BaseModel):
    operator_name: Optional[str] = "Operator-01"

class EventResponse(BaseModel):
    id: str
    timestamp: float
    camera_id: str
    rule_id: str
    event_type: str
    object_type: str
    track_id: int
    confidence: float
    evidence_uri: str
    severity: str
    status: str
    acknowledged_by: Optional[str] = None
    license_plate: Optional[str] = None

class PlaybackInfo(BaseModel):
    is_paused: bool = False
    current_sec: float = 0.0
    duration_sec: float = 0.0
    current_frame: int = 0
    total_frames: int = 0
    is_file: bool = False
    video_mode: str = "webcam"

class HealthResponse(BaseModel):
    status: str
    camera_status: str
    current_source: str
    fps: float
    latency_ms: float
    websocket_connected_clients: int
    unacknowledged_alerts: int
    active_tracks: int
    entity_counts: Dict[str, int] = {}
    playback: PlaybackInfo

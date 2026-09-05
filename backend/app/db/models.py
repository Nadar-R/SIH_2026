import time
from sqlalchemy import Column, String, Float, Integer, Boolean, Text
from backend.app.db.session import Base

class CameraModel(Base):
    __tablename__ = "cameras"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    source = Column(String, nullable=False)
    location = Column(String, default="Border Outpost")
    status = Column(String, default="ONLINE")
    enabled = Column(Boolean, default=True)
    created_at = Column(Float, default=time.time)

class ZoneModel(Base):
    __tablename__ = "zones"

    id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    geometry_type = Column(String, default="polygon")
    polygon_json = Column(Text, nullable=False)
    min_confidence = Column(Float, default=0.40)
    min_frames = Column(Integer, default=2)
    cooldown_seconds = Column(Integer, default=5)
    severity = Column(String, default="HIGH")
    enabled = Column(Boolean, default=True)
    created_at = Column(Float, default=time.time)

class EventModel(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(Float, default=time.time)
    camera_id = Column(String, nullable=False, index=True)
    rule_id = Column(String, nullable=False)
    event_type = Column(String, default="VIRTUAL_FENCE_INTRUSION")
    object_type = Column(String, nullable=False)
    track_id = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    evidence_uri = Column(String, nullable=False)
    severity = Column(String, default="HIGH")
    status = Column(String, default="NEW")
    acknowledged_by = Column(String, nullable=True)
    license_plate = Column(String, nullable=True)

class MetricModel(Base):
    __tablename__ = "system_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(Float, default=time.time)
    camera_id = Column(String, nullable=False)
    fps = Column(Float, default=0.0)
    latency_ms = Column(Float, default=0.0)
    active_tracks = Column(Integer, default=0)

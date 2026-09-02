import os
import json
import time
import shutil
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.db.models import CameraModel, ZoneModel, EventModel
from backend.app.models.schemas import (
    CameraResponse, ZoneCreate, ZoneResponse, EventResponse,
    EventAckRequest, SourceSwitchRequest, SeekRequest, HealthResponse, PlaybackInfo
)
from backend.app.services.events import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")

pipeline_instance = None

def set_pipeline(pipeline):
    global pipeline_instance
    pipeline_instance = pipeline

def get_video_mode(source_str: str) -> str:
    s = str(source_str).strip()
    if s.isdigit():
        return "webcam"
    if s.startswith("rtsp://") or s.startswith("http://") or s.startswith("https://"):
        return "rtsp"
    return "file"

@router.get("/health", response_model=HealthResponse)
def get_health(db: Session = Depends(get_db)):
    fps = pipeline_instance.current_fps if pipeline_instance else 0.0
    latency = pipeline_instance.inference_latency_ms if pipeline_instance else 0.0
    cam_status = "ONLINE" if (pipeline_instance and pipeline_instance.stream.is_running) else "OFFLINE"
    curr_source = str(pipeline_instance.source) if pipeline_instance else "0"
    active_tracks = len(pipeline_instance.latest_tracks) if pipeline_instance else 0
    entity_counts = pipeline_instance.entity_counts if pipeline_instance else {}

    unack_count = db.query(EventModel).filter(EventModel.status == "NEW").count()
    
    playback_dict = pipeline_instance.get_playback_info() if pipeline_instance else {}
    video_mode = get_video_mode(curr_source)

    playback_obj = PlaybackInfo(
        is_paused=playback_dict.get("is_paused", False),
        current_sec=playback_dict.get("current_sec", 0.0),
        duration_sec=playback_dict.get("duration_sec", 0.0),
        current_frame=playback_dict.get("current_frame", 0),
        total_frames=playback_dict.get("total_frames", 0),
        is_file=playback_dict.get("is_file", False),
        video_mode=video_mode
    )

    return HealthResponse(
        status="OK",
        camera_status=cam_status,
        current_source=curr_source,
        fps=fps,
        latency_ms=latency,
        websocket_connected_clients=len(ws_manager.active_connections),
        unacknowledged_alerts=unack_count,
        active_tracks=active_tracks,
        entity_counts=entity_counts,
        playback=playback_obj
    )

@router.get("/cameras", response_model=List[CameraResponse])
def list_cameras(db: Session = Depends(get_db)):
    cams = db.query(CameraModel).all()
    if not cams:
        default_cam = CameraModel(
            id="cam-bop-01",
            name="Border Outpost Gate 1",
            source=str(pipeline_instance.source) if pipeline_instance else "0",
            location="Sector Alpha - Main Gate",
            status="ONLINE" if (pipeline_instance and pipeline_instance.stream.is_running) else "OFFLINE",
            enabled=True
        )
        db.add(default_cam)
        db.commit()
        db.refresh(default_cam)
        return [default_cam]

    for cam in cams:
        if pipeline_instance:
            cam.source = str(pipeline_instance.source)
            cam.status = "ONLINE" if pipeline_instance.stream.is_running else "OFFLINE"
    return cams

@router.post("/cameras/switch")
def switch_camera_source(req: SourceSwitchRequest, db: Session = Depends(get_db)):
    if not pipeline_instance:
        raise HTTPException(status_code=500, detail="Vision pipeline is not running.")

    logger.info(f"Attempting to switch video source to: {req.source}")
    success = pipeline_instance.update_source(req.source)

    # Validate if OpenCV successfully opened the requested stream URL
    parsed_req = pipeline_instance.stream._parse_source(req.source)
    if pipeline_instance.stream.source != parsed_req:
        logger.warning(f"Failed to connect to stream '{req.source}'. Reverted to webcam 0.")
        raise HTTPException(
            status_code=400,
            detail=f"Unable to connect to stream URL '{req.source}'. Please ensure it is a raw RTSP stream (rtsp://...) or direct video stream URL, not a webpage HTML link."
        )

    cam = db.query(CameraModel).filter(CameraModel.id == req.camera_id).first()
    if cam:
        cam.source = str(req.source)
        cam.status = "ONLINE"
        db.commit()

    return {"status": "SUCCESS", "new_source": str(req.source)}

@router.post("/cameras/upload")
async def upload_video_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not pipeline_instance:
        raise HTTPException(status_code=500, detail="Vision pipeline is not running.")

    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "uploaded_videos")
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = f"{int(time.time())}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    logger.info(f"GUI File Upload saved to: {file_path}")
    pipeline_instance.update_source(file_path)

    cam = db.query(CameraModel).filter(CameraModel.id == "cam-bop-01").first()
    if cam:
        cam.source = file_path
        cam.status = "ONLINE"
        db.commit()

    return {"status": "SUCCESS", "filename": safe_filename, "file_path": file_path}

@router.post("/cameras/play_pause")
def toggle_play_pause():
    if not pipeline_instance:
        raise HTTPException(status_code=500, detail="Vision pipeline is not running.")
    is_paused = pipeline_instance.toggle_pause()
    return {"status": "SUCCESS", "is_paused": is_paused}

@router.post("/cameras/seek")
def seek_video(req: SeekRequest):
    if not pipeline_instance:
        raise HTTPException(status_code=500, detail="Vision pipeline is not running.")
    success = pipeline_instance.seek_to_second(req.target_sec)
    return {"status": "SUCCESS" if success else "FAILED", "target_sec": req.target_sec}

@router.get("/zones", response_model=List[ZoneResponse])
def list_zones(db: Session = Depends(get_db)):
    zones = db.query(ZoneModel).all()
    res = []
    for z in zones:
        poly = json.loads(z.polygon_json)
        res.append(ZoneResponse(
            id=z.id,
            camera_id=z.camera_id,
            name=z.name,
            geometry_type=z.geometry_type,
            polygon=poly,
            min_confidence=z.min_confidence,
            min_frames=z.min_frames,
            cooldown_seconds=z.cooldown_seconds,
            severity=z.severity,
            enabled=z.enabled,
            created_at=z.created_at
        ))
    return res

@router.post("/zones", response_model=ZoneResponse)
def create_or_update_zone(zone: ZoneCreate, db: Session = Depends(get_db)):
    zone_id = zone.id or f"zone_{int(time.time()*1000)}"
    existing = db.query(ZoneModel).filter(ZoneModel.id == zone_id).first()

    poly_json = json.dumps(zone.polygon)

    if existing:
        existing.name = zone.name
        existing.polygon_json = poly_json
        existing.min_confidence = zone.min_confidence
        existing.min_frames = zone.min_frames
        existing.cooldown_seconds = zone.cooldown_seconds
        existing.severity = zone.severity
        existing.enabled = zone.enabled
        db.commit()
        db.refresh(existing)
        db_obj = existing
    else:
        db_obj = ZoneModel(
            id=zone_id,
            camera_id=zone.camera_id,
            name=zone.name,
            geometry_type=zone.geometry_type,
            polygon_json=poly_json,
            min_confidence=zone.min_confidence,
            min_frames=zone.min_frames,
            cooldown_seconds=zone.cooldown_seconds,
            severity=zone.severity,
            enabled=zone.enabled
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

    if pipeline_instance:
        all_zones = db.query(ZoneModel).filter(ZoneModel.enabled == True).all()
        rules_config = []
        for z in all_zones:
            rules_config.append({
                "id": z.id,
                "camera_id": z.camera_id,
                "name": z.name,
                "polygon": json.loads(z.polygon_json),
                "min_confidence": z.min_confidence,
                "min_frames": z.min_frames,
                "cooldown_seconds": z.cooldown_seconds,
                "severity": z.severity,
                "enabled": z.enabled
            })
        pipeline_instance.update_rules(rules_config)

    return ZoneResponse(
        id=db_obj.id,
        camera_id=db_obj.camera_id,
        name=db_obj.name,
        geometry_type=db_obj.geometry_type,
        polygon=json.loads(db_obj.polygon_json),
        min_confidence=db_obj.min_confidence,
        min_frames=db_obj.min_frames,
        cooldown_seconds=db_obj.cooldown_seconds,
        severity=db_obj.severity,
        enabled=db_obj.enabled,
        created_at=db_obj.created_at
    )

@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: str, db: Session = Depends(get_db)):
    z = db.query(ZoneModel).filter(ZoneModel.id == zone_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    db.delete(z)
    db.commit()

    if pipeline_instance:
        all_zones = db.query(ZoneModel).filter(ZoneModel.enabled == True).all()
        rules_config = [{
            "id": z.id, "camera_id": z.camera_id, "name": z.name,
            "polygon": json.loads(z.polygon_json), "min_confidence": z.min_confidence,
            "min_frames": z.min_frames, "cooldown_seconds": z.cooldown_seconds,
            "severity": z.severity, "enabled": z.enabled
        } for z in all_zones]
        pipeline_instance.update_rules(rules_config)

    return {"status": "SUCCESS", "deleted_zone_id": zone_id}

@router.get("/events", response_model=List[EventResponse])
def list_events(
    status: Optional[str] = None,
    object_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(EventModel)
    if status:
        query = query.filter(EventModel.status == status)
    if object_type:
        query = query.filter(EventModel.object_type == object_type)

    events = query.order_by(EventModel.timestamp.desc()).limit(limit).all()
    return events

@router.post("/events/{event_id}/ack", response_model=EventResponse)
def acknowledge_event(event_id: str, req: EventAckRequest = EventAckRequest(), db: Session = Depends(get_db)):
    evt = db.query(EventModel).filter(EventModel.id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Event not found")

    evt.status = "ACKNOWLEDGED"
    evt.acknowledged_by = req.operator_name or "Operator-01"
    db.commit()
    db.refresh(evt)
    return evt

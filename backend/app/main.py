import os
import sys

# Ensure root workspace directory is in Python path for vision & backend imports
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import json
import time
import asyncio
import logging
import cv2
import numpy as np
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from sqlalchemy import text
from backend.app.db.session import engine, Base, SessionLocal
from backend.app.db.models import CameraModel, ZoneModel, EventModel
from backend.app.api.endpoints import router as api_router, set_pipeline
from backend.app.services.events import ws_manager
from vision.pipeline import VisionPipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("IBVAP-Main")

app = FastAPI(
    title="IBVAP - Intelligent Border Video Analytics Platform",
    description="Software-defined AI Video Analytics for CCTV Infrastructure",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Evidence Snapshots & Whitelisted Faces Directories
EVIDENCE_DIR = os.path.join(ROOT_DIR, "data", "evidence")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

WHITELIST_DIR = os.path.join(ROOT_DIR, "data", "whitelisted_faces")
os.makedirs(WHITELIST_DIR, exist_ok=True)
app.mount("/whitelisted_faces", StaticFiles(directory=WHITELIST_DIR), name="whitelisted_faces")

PLACEHOLDER_JPEG: Optional[bytes] = None

def get_placeholder_jpeg() -> bytes:
    global PLACEHOLDER_JPEG
    if PLACEHOLDER_JPEG is None:
        blank = np.full((120, 160, 3), 30, dtype=np.uint8)
        cv2.putText(blank, "NO SNAPSHOT", (15, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (120, 120, 120), 1)
        _, enc = cv2.imencode(".jpg", blank, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        PLACEHOLDER_JPEG = enc.tobytes()
    return PLACEHOLDER_JPEG

@app.get("/evidence/{filename}")
def get_evidence_snapshot(filename: str):
    file_path = os.path.join(EVIDENCE_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="image/jpeg")
    wl_path = os.path.join(WHITELIST_DIR, filename)
    if os.path.exists(wl_path):
        return FileResponse(wl_path, media_type="image/jpeg")
    return Response(content=get_placeholder_jpeg(), media_type="image/jpeg")

pipeline = None
main_loop = None

def handle_vision_event(event_data: dict, annotated_frame):
    db: Session = SessionLocal()
    try:
        event_id = event_data.get("event_id", f"evt_{int(time.time()*1000)}")
        
        db_event = EventModel(
            id=event_id,
            timestamp=event_data.get("timestamp", time.time()),
            camera_id="cam-bop-01",
            rule_id=event_data.get("rule_id", "vf-bop-01"),
            event_type=event_data.get("event_type", "VIRTUAL_FENCE_INTRUSION"),
            object_type=event_data.get("object_type", "person"),
            track_id=event_data.get("track_id", 0),
            confidence=event_data.get("confidence", 0.0),
            evidence_uri=event_data.get("evidence_uri", ""),
            severity=event_data.get("severity", "HIGH"),
            status="NEW",
            license_plate=event_data.get("license_plate")
        )
        db.add(db_event)
        db.commit()
        db.refresh(db_event)

        ws_payload = {
            "type": "NEW_ALERT",
            "data": {
                "id": db_event.id,
                "timestamp": db_event.timestamp,
                "camera_id": db_event.camera_id,
                "rule_id": db_event.rule_id,
                "event_type": db_event.event_type,
                "object_type": db_event.object_type,
                "track_id": db_event.track_id,
                "confidence": db_event.confidence,
                "evidence_uri": db_event.evidence_uri,
                "severity": db_event.severity,
                "status": db_event.status,
                "license_plate": db_event.license_plate
            }
        }
        
        if main_loop and main_loop.is_running():
            asyncio.run_coroutine_threadsafe(ws_manager.broadcast_event(ws_payload), main_loop)

    except Exception as e:
        logger.error(f"Error persisting vision event to DB: {e}")
    finally:
        db.close()

def load_initial_configs():
    Base.metadata.create_all(bind=engine)

    # Automatic SQLite schema migration for license_plate column
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE events ADD COLUMN license_plate TEXT;"))
            conn.commit()
        except Exception:
            pass
    db: Session = SessionLocal()
    try:
        cam = db.query(CameraModel).filter(CameraModel.id == "cam-bop-01").first()
        if not cam:
            cam = CameraModel(
                id="cam-bop-01",
                name="Border Outpost Gate 1",
                source="0",
                location="Sector Alpha - Main Gate",
                status="ONLINE",
                enabled=True
            )
            db.add(cam)
        else:
            # Reset camera source to default system webcam "0" on every backend launch
            cam.source = "0"
            cam.status = "ONLINE"

        # Load saved active zones from database
        active_zones = db.query(ZoneModel).filter(ZoneModel.enabled == True).all()
        rules_config = []
        for z in active_zones:
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
        return rules_config, cam.source

    except Exception as e:
        logger.error(f"Error loading initial configs: {e}")
        return [], 0
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    global pipeline, main_loop
    main_loop = asyncio.get_running_loop()
    logger.info("Initializing IBVAP Backend & Vision Analytics Engine...")
    rules_config, initial_source = load_initial_configs()

    if isinstance(initial_source, str) and initial_source.isdigit():
        initial_source = int(initial_source)

    pipeline = VisionPipeline(
        source=initial_source,
        model_name="yolov8n.pt",
        rules_config=rules_config,
        event_callback=handle_vision_event,
        evidence_dir=EVIDENCE_DIR
    )
    set_pipeline(pipeline)
    pipeline.start()
    logger.info("IBVAP Vision Engine initialized and started.")

@app.on_event("shutdown")
def shutdown_event():
    global pipeline
    if pipeline:
        pipeline.stop()
    logger.info("IBVAP Backend shutdown complete.")

app.include_router(api_router)

@app.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

BLANK_FRAME_JPEG: Optional[bytes] = None

def get_blank_jpeg() -> bytes:
    global BLANK_FRAME_JPEG
    if BLANK_FRAME_JPEG is None:
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(blank, "CONNECTING TO VIDEO FEED...", (110, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        _, enc = cv2.imencode(".jpg", blank, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        BLANK_FRAME_JPEG = enc.tobytes()
    return BLANK_FRAME_JPEG

@app.get("/api/v1/snapshot")
def get_snapshot():
    """Returns a single clean JPEG snapshot of current live camera canvas."""
    frame_bytes = pipeline.get_encoded_mjpeg_frame() if (pipeline and pipeline.is_running) else None
    if frame_bytes is None:
        frame_bytes = get_blank_jpeg()
    return Response(
        content=frame_bytes,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.get("/video_feed")
async def video_feed(request: Request):
    async def stream_generator():
        last_sent = None
        last_sent_time = 0.0
        try:
            while True:
                now = time.time()
                frame_bytes = pipeline.get_encoded_mjpeg_frame() if (pipeline and pipeline.is_running) else None
                if frame_bytes is None:
                    frame_bytes = get_blank_jpeg()

                # Efficient O(1) object identity check + heartbeat refresh
                if frame_bytes is not None and (frame_bytes is not last_sent or now - last_sent_time > 0.15):
                    last_sent = frame_bytes
                    last_sent_time = now
                    header = (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n"
                        b"Content-Length: " + str(len(frame_bytes)).encode() + b"\r\n\r\n"
                    )
                    yield header + frame_bytes + b"\r\n"

                await asyncio.sleep(0.033)
        except (asyncio.CancelledError, GeneratorExit):
            pass
        except Exception as e:
            logger.debug(f"Client disconnected from video feed: {e}")

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive"
        }
    )

# Mount Compiled Frontend SPA (React Production Build)
FRONTEND_DIST = os.path.join(ROOT_DIR, "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

# Implementation Plan: Advanced Border Surveillance Modules

We are implementing three powerful, 100% modular surveillance extensions into the IBVAP platform:

1. **Face Detection & Whitelisted Familiar Face Alert Suppression (GUI Upload)**
2. **Automatic Number Plate Recognition (ANPR / License Plate Extraction)**
3. **Night-Time Movement Detection & IR CLAHE Contrast Enhancement**

---

## 🏗️ Architectural Changes

### 1. Vision Engine Enhancements (`vision/`)
- `vision/face_engine.py` **[NEW]**: Facial feature extraction & whitelisted face embedding comparator. Suppresses intrusion alarms when authorized personnel walk through virtual fence zones.
- `vision/anpr.py` **[NEW]**: License plate localization & OCR text extraction for vehicles (`car`, `motorcycle`, `bus`, `truck`).
- `vision/night_vision.py` **[NEW]**: Automatic frame luminance measurement, IR CLAHE contrast enhancement, and MOG2 background motion detection.
- `vision/pipeline.py` **[MODIFY]**: Connects night-vision preprocessing, face whitelisting, ANPR, and rule evaluation into a unified 25–30 FPS pipeline.

### 2. Backend REST Endpoints (`backend/app/api/endpoints.py`)
- `GET /api/v1/faces/whitelist`: Returns active whitelisted personnel.
- `POST /api/v1/faces/whitelist`: GUI upload endpoint for authorized staff face photos & names.
- `DELETE /api/v1/faces/whitelist/{face_id}`: Removes an authorized staff member.

### 3. Frontend Dashboard UI (`frontend/src/`)
- `frontend/src/components/WhitelistManagerModal.jsx` **[NEW]**: GUI Modal to upload, preview, and manage whitelisted personnel faces.
- `frontend/src/components/LiveMonitoringTab.jsx` **[MODIFY]**: Renders Night Mode status badge, License Plate tags above vehicles, and Whitelist Manager button.
- `frontend/src/components/EventLogsTab.jsx` **[MODIFY]**: Displays License Plate text & search filter in audit logs.

---

## 🛡️ Model Selection Strategy
- Default model will remain lightweight **`yolov8n.pt`** (or configurable to **`yolov8s.pt`** for low-compute environments).
- `yolov8s.pt` (11.2M params, ~22 MB) can be selected via configuration if extra detection precision is desired.

---

## 🧪 Verification Plan
1. **Face Whitelisting Test**: Upload a test face via GUI, verify that entering a virtual fence logs authorized movement and suppresses high-severity alarm.
2. **ANPR Test**: Feed a video with a vehicle, verify license plate text is extracted and logged in audit history.
3. **Night Vision Test**: Feed a dark/IR night-vision video, verify CLAHE enhancement engages and displays `🌙 NIGHT SURVEILLANCE ACTIVE`.

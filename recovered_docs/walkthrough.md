# IBVAP Walkthrough & Feature Release Notes

We have completed and verified all 3 requested surveillance features:

---

## 🚀 Newly Added Features

### 1. 👤 GUI Whitelisted Familiar Face Engine & Alert Suppression
- **GUI Whitelist Manager (`WhitelistManagerModal.jsx`)**: Operators can click **`[ 🛡️ STAFF WHITELIST ]`** on the Live Monitoring toolbar to upload photos of authorized personnel, enter their name and role.
- **Alert Suppression (`vision/face_engine.py`)**: When an authorized staff member is recognized inside a Virtual Fence polygon, the platform labels them e.g. `#1 AUTHORIZED: GUARD RAJAT`, logs authorized movement, and **suppresses high-severity alarms**!

### 2. 🚗 Automatic Number Plate Recognition (ANPR / LPR)
- **Plate Extraction (`vision/anpr.py`)**: Detects license plate contours on vehicles (`car`, `motorcycle`, `bus`, `truck`) and performs OCR text extraction.
- **Video & Audit Log Integration**: Displays license plate text tags on video frames (e.g. `#12 CAR [IND-DL-01-AB-1234]`) and populates event audit history.

### 3. 🌙 Night-Time Movement Detection & IR CLAHE Contrast Enhancement
- **Auto Night Mode Detector (`vision/night_vision.py`)**: Measures average frame luminance. If below 65, automatically engages CLAHE contrast enhancement for dark/IR night-vision streams.
- **Motion Subtraction**: Computes background motion score to detect subtle stealth movements in total darkness.
- **Status Indicator**: Displays a **`🌙 NIGHT MODE (CLAHE ACTIVE)`** badge on the stream player header.

---

## ⚡ Model Performance Strategy
- Retained lightweight **`yolov8n.pt`** (or `yolov8s.pt` if configured) for 25–30 FPS real-time processing on low-compute systems.

---

## 🚀 How to Run

In your CMD terminal (`C:\Users\Rajat\Desktop\SIH2026`):

```cmd
python start_all.py
```
Open **`http://localhost:8000`** in your browser!

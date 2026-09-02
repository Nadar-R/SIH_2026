# 🛡️ IBVAP - Intelligent Border Video Analytics Platform (SIH 2026)

IBVAP is an AI-powered real-time border video surveillance & virtual fence analytics platform built with **FastAPI**, **YOLOv8**, **ByteTrack**, and a modern **React (Tailwind CSS)** operator dashboard.

---

## ✨ Features

- 📹 **Multi-Source Support**: Ingest live video feeds from Connected USB Webcams, GUI Local Video Files (`.mp4`/`.mkv`), or Real RTSP IP CCTV Cameras (`rtsp://`).
- ✍️ **Interactive Virtual Fence Drawer**: Click-to-draw polygon restricted zones (`P1`, `P2`, `P3`) directly on live video frames.
- ⚡ **High FPS Processing**: 25-30 FPS smooth video streaming with frame-skipped YOLOv8 object detection & ByteTrack object tracking.
- 📊 **Active Entity Breakdown**: Real-time counter of tracked Persons, Cars, Motorcycles, Buses, Trucks, and Bicycles outside the video player.
- ⏯️ **Playback Controls**: Fullscreen mode, Play/Pause toggle, and an interactive Video Seek Bar (`00:15 / 02:45`) for local video files.
- 🚨 **Real-Time Push Alerts & Evidence Audit**: Push notification alert rail with snapshot inspector and CSV audit log exporter.

---

## 🚀 Quick Setup Guide for Team Members

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/SIH2026.git
cd SIH2026
```

### 2. Install Dependencies
Make sure you have Python 3.10+ and Node.js installed.

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Frontend React dependencies
cd frontend
npm install
cd ..
```

### 3. Launch Application with 1 Command
Run the single launcher script:

```bash
python start_all.py
```

The launcher will run an automated pre-flight self-test and automatically open **`http://localhost:8000`** in your browser!

---

## 🛠️ Tech Stack

- **Backend & AI Engine**: Python 3.10+, FastAPI, Uvicorn, OpenCV, YOLOv8 (Ultralytics), ByteTrack (Supervision), Shapely, SQLite (SQLAlchemy)
- **Frontend Dashboard**: React 18, Vite, Tailwind CSS, Lucide Icons, WebSockets

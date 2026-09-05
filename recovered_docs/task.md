# IBVAP Feature Enhancements Checklist

- [ ] **Task 1: GUI File Picker & Video Upload Endpoint**
  - [ ] Add `POST /api/v1/cameras/upload` endpoint in FastAPI backend to handle native file uploads
  - [ ] Add Drag & Drop / File Input UI in `CameraSourcesTab.jsx` for selecting local MP4/MKV video files without typing paths

- [ ] **Task 2: Performance Engineering for Smooth 25-30 FPS Playback**
  - [ ] Downscale video frames to 640px prior to inference in `stream_processor.py`
  - [ ] Implement inference cadence frame skipping (interleaving YOLO inference every 2 frames with ByteTrack prediction) in `pipeline.py`
  - [ ] Optimize JPEG stream compression and frame delivery rate to achieve 25-30 FPS smooth video playback

- [ ] **Task 3: Dynamic Toolbar Dropdown Rules**
  - [ ] Modify `LiveMonitoringTab.jsx`:
    - When active mode is `webcam`: Dropdown ONLY lists connected USB webcams (Inbuilt #0, USB #1).
    - When active mode is `file` or `rtsp`: Dropdown is completely hidden, replaced with a clean file/stream info badge.

- [ ] **Task 4: Fullscreen, Play/Pause & Video Seek Bar Controls**
  - [ ] Add `pause()`, `resume()`, and `seek_to_second()` in `StreamProcessor` and `VisionPipeline`
  - [ ] Add `POST /api/v1/cameras/play_pause` and `POST /api/v1/cameras/seek` API endpoints
  - [ ] Render Play/Pause toggle, Fullscreen button, and interactive Video Seek Bar (`00:15 / 02:30`) on the stream player

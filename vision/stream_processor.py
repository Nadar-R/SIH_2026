import cv2
import time
import logging
import threading
from typing import Union, Tuple, Optional, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)

class StreamProcessor:
    def __init__(self, source: Union[int, str] = 0, target_fps: int = 25):
        self.source = self._parse_source(source)
        self.target_fps = target_fps
        self.cap: Optional[cv2.VideoCapture] = None
        self.lock = threading.Lock()
        self.capture_lock = threading.Lock()
        self.is_running = False
        self.is_paused = False
        self.current_frame = 0
        self.total_frames = 0
        self.width = 640
        self.height = 480
        self.fps = 25.0
        self.last_frame: Optional[np.ndarray] = None
        self.fail_count = 0

    def _parse_source(self, src: Union[int, str]) -> Union[int, str]:
        if isinstance(src, int):
            return src
        if isinstance(src, str) and src.isdigit():
            return int(src)
        return src

    def open(self) -> bool:
        with self.lock:
            return self._open_unlocked()

    def _open_unlocked(self) -> bool:
        with self.capture_lock:
            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None

        logger.info(f"Opening video stream source: {self.source}")
        try:
            if isinstance(self.source, int):
                self.cap = cv2.VideoCapture(self.source, cv2.CAP_DSHOW)
                if not self.cap or not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(self.source)
                if self.cap and self.cap.isOpened():
                    # Set optimal low-latency, moderate-bandwidth properties on hardware
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.cap.set(cv2.CAP_PROP_FPS, 30)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            else:
                self.cap = cv2.VideoCapture(self.source)
        except Exception as e:
            logger.error(f"Failed to initialize VideoCapture for {self.source}: {e}")
            self.source = 0
            self.cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            if self.cap and self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.cap.set(cv2.CAP_PROP_FPS, 30)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not self.cap or not self.cap.isOpened():
            logger.error(f"Failed to open video source: {self.source}. Falling back to default webcam (Device 0).")
            self.source = 0
            self.cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            if not self.cap or not self.cap.isOpened():
                self.cap = cv2.VideoCapture(0)
            if self.cap and self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.cap.set(cv2.CAP_PROP_FPS, 30)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not self.cap or not self.cap.isOpened():
            # If opening fails temporarily, keep last known running state if we have cached frames
            if self.last_frame is None:
                self.is_running = False
            return False

        src_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
        src_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
        src_fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.fps = src_fps if src_fps and src_fps > 0 else 25.0
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        self.current_frame = 0

        scale = 640.0 / max(src_width, 1)
        self.width = 640
        self.height = int(src_height * scale)

        self.is_running = True
        self.is_paused = False
        self.fail_count = 0
        logger.info(f"Stream opened successfully ({self.width}x{self.height} @ {self.fps:.1f} FPS, Total Frames: {self.total_frames})")
        return True

    def change_source(self, new_source: Union[int, str]) -> bool:
        with self.lock:
            self.source = self._parse_source(new_source)
            self.is_paused = False
            return self._open_unlocked()

    def toggle_pause(self) -> bool:
        self.is_paused = not self.is_paused
        return self.is_paused

    def seek_to_second(self, target_sec: float) -> bool:
        with self.capture_lock:
            with self.lock:
                if not self.cap or self.total_frames == 0:
                    return False
                target_frame = int(target_sec * self.fps)
                target_frame = max(0, min(target_frame, self.total_frames - 1))
                try:
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
                    self.current_frame = target_frame
                    logger.info(f"Seek video stream to {target_sec:.1f}s (Frame #{target_frame}/{self.total_frames})")
                    
                    # If paused, immediately decode 1 frame at the new seek location to update last_frame
                    ret, frame = self.cap.read()
                    if ret and frame is not None:
                        if frame.shape[1] != self.width or frame.shape[0] != self.height:
                            frame = cv2.resize(frame, (self.width, self.height), interpolation=cv2.INTER_LINEAR)
                        self.last_frame = frame.copy()
                    return True
                except Exception as e:
                    logger.error(f"Error seeking stream: {e}")
                    return False

    def get_playback_info(self) -> Dict[str, Any]:
        if not self.is_running:
            return {
                "is_paused": False,
                "current_sec": 0.0,
                "duration_sec": 0.0,
                "current_frame": 0,
                "total_frames": 0,
                "is_file": False
            }

        is_file = isinstance(self.source, str) and not self.source.startswith("rtsp") and not self.source.startswith("http")
        curr_frame = self.current_frame
        duration_sec = round(self.total_frames / self.fps, 1) if self.fps > 0 else 0.0
        current_sec = round(curr_frame / self.fps, 1) if self.fps > 0 else 0.0

        return {
            "is_paused": self.is_paused,
            "current_sec": current_sec,
            "duration_sec": duration_sec,
            "current_frame": curr_frame,
            "total_frames": self.total_frames,
            "is_file": is_file
        }

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        is_paused = False
        last_frame_copy = None
        is_file = isinstance(self.source, str) and not self.source.startswith("rtsp") and not self.source.startswith("http")
        cap_ref = None

        with self.lock:
            if not self.is_running or self.cap is None:
                if not self._open_unlocked():
                    return False, None

            if self.is_paused:
                is_paused = True
                if self.last_frame is not None:
                    last_frame_copy = self.last_frame.copy()
            else:
                cap_ref = self.cap

        if is_paused:
            if last_frame_copy is not None:
                return True, last_frame_copy
            return False, None

        # Read frame with capture_lock so cap.release() in change_source never races with read()
        ret, frame = False, None
        with self.capture_lock:
            if cap_ref is not None:
                try:
                    ret, frame = cap_ref.read()
                except Exception:
                    ret, frame = False, None

        if ret and is_file and cap_ref is not None:
            with self.lock:
                try:
                    self.current_frame = int(cap_ref.get(cv2.CAP_PROP_POS_FRAMES))
                except Exception:
                    self.current_frame += 1
        elif ret:
            with self.lock:
                self.current_frame += 1

        # Handle frame read failures & seamless video looping
        if not ret or frame is None:
            with self.capture_lock:
                with self.lock:
                    self.fail_count += 1

                    if is_file and self.cap:
                        # Seamless file loop by setting position back to frame 0
                        try:
                            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            self.current_frame = 0
                            ret, frame = self.cap.read()
                            if ret and frame is not None:
                                self.fail_count = 0
                        except Exception:
                            pass

                    # Failure threshold: 15 frames for file loop, 150 frames (~5s) for live cameras
                    max_fails = 15 if is_file else 150
                    if not ret and self.fail_count > max_fails:
                        logger.warning(f"Stream read failure threshold reached for {self.source}. Attempting graceful reconnect...")
                        time.sleep(0.2)
                        self._open_unlocked()
                        self.fail_count = 0
                        if self.last_frame is not None:
                            return True, self.last_frame.copy()
                        return False, None

                    # If we have a cached valid frame, return it temporarily while waiting
                    if not ret and self.last_frame is not None:
                        return True, self.last_frame.copy()

        if not ret or frame is None:
            return False, None

        if frame.shape[1] != self.width or frame.shape[0] != self.height:
            frame = cv2.resize(frame, (self.width, self.height), interpolation=cv2.INTER_LINEAR)

        with self.lock:
            self.last_frame = frame.copy()
            self.fail_count = 0

        return True, frame

    def release(self):
        with self.lock:
            self.is_running = False
        with self.capture_lock:
            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None

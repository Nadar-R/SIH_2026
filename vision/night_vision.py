import cv2
import logging
from typing import Tuple
import numpy as np

logger = logging.getLogger(__name__)

class NightVisionEnhancer:
    """
    Night-Time Surveillance & Motion Enhancer.
    Detects low-light/IR night vision feeds, applies CLAHE contrast enhancement,
    and runs MOG2 background motion subtraction to detect subtle night movement.
    """

    def __init__(self, low_light_threshold: float = 65.0):
        self.low_light_threshold = low_light_threshold
        self.clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=25, detectShadows=False)
        self.is_night_mode = False
        self.night_motion_score = 0.0

    def process(self, frame: np.ndarray) -> Tuple[np.ndarray, bool, float]:
        """
        Processes frame:
        Returns: (enhanced_frame, is_night_mode, night_motion_score)
        """
        if frame is None or frame.size == 0:
            return frame, False, 0.0

        # 1. Compute Mean Luminance
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_lum = float(np.mean(gray))
        self.is_night_mode = mean_lum < self.low_light_threshold

        processed_frame = frame.copy()

        if self.is_night_mode:
            # Apply CLAHE Contrast Enhancement to IR/Night channels
            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            cl = self.clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            processed_frame = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

            # MOG2 Background Motion Mask
            fg_mask = self.bg_subtractor.apply(gray)
            motion_pixels = cv2.countNonZero(fg_mask)
            total_pixels = gray.shape[0] * gray.shape[1]
            self.night_motion_score = round((motion_pixels / float(total_pixels)) * 100.0, 2)
        else:
            self.night_motion_score = 0.0

        return processed_frame, self.is_night_mode, self.night_motion_score

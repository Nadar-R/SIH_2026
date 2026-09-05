import cv2
import re
import os
import logging
from typing import Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

class ANPREngine:
    """
    Automatic Number Plate Recognition (ANPR) Engine.
    Detects rectangular license plate regions on vehicles (car, motorcycle, bus, truck)
    and extracts alphanumeric plate characters using OpenCV morphology, sharpening & EasyOCR.
    """

    def __init__(self):
        self.ocr_reader = None
        self.sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
        self._init_ocr()

    def _init_ocr(self):
        try:
            import easyocr
            self.ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            logger.info("EasyOCR Engine initialized successfully for license plate recognition.")
        except Exception as e:
            logger.warning(f"EasyOCR initialization delayed/failed: {e}.")

    def format_plate_text(self, raw_text: str) -> str:
        """
        Cleans OCR text and formats into standard Indian / International license plate syntax.
        Example: 'HR26DC0165' -> 'HR-26-DC-0165'
        """
        clean = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
        if len(clean) < 5:
            return clean

        # Match standard Indian License Plate Pattern: State (2 letters) + Code (2 digits) + Series (1-3 letters) + Number (4 digits)
        match = re.search(r'([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{4})', clean)
        if match:
            state, code, series, num = match.groups()
            return f"{state}-{int(code):02d}-{series}-{num}"

        return clean

    def _compute_sharpness(self, img: np.ndarray) -> float:
        """Computes Laplacian Variance to measure image sharpness and filter out motion blur."""
        if img is None or img.size == 0:
            return 0.0
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    def extract_license_plate(self, vehicle_crop: np.ndarray) -> Optional[str]:
        """
        Locates license plate contour in vehicle crop and performs alphanumeric OCR.
        Applies 15% ROI margin expansion, sharpen kernel, and motion deblurring.
        Returns: Recognized License Plate String (e.g. 'HR-26-DC-0165') or None
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return None

        h, w = vehicle_crop.shape[:2]
        if w < 40 or h < 30:
            return None

        try:
            # 1. Image Sharpening & Motion Deblur Filter
            sharpened_vehicle = cv2.filter2D(vehicle_crop, -1, self.sharpen_kernel)

            # 2. EasyOCR direct region recognition on sharpened crop
            if self.ocr_reader is not None:
                rgb_crop = cv2.cvtColor(sharpened_vehicle, cv2.COLOR_BGR2RGB)
                results = self.ocr_reader.readtext(rgb_crop, detail=0, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-')
                for res in results:
                    formatted = self.format_plate_text(res)
                    if len(formatted) >= 5:
                        return formatted

            # 3. Contour Detection & Morphological Binarization for Plate Region
            gray = cv2.cvtColor(vehicle_crop, cv2.COLOR_BGR2GRAY)
            blur = cv2.bilateralFilter(gray, 11, 17, 17)
            edged = cv2.Canny(blur, 30, 200)

            contours, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]

            plate_roi = None
            for c in contours:
                peri = cv2.arcLength(c, True)
                approx = cv2.approxPolyDP(c, 0.018 * peri, True)
                if len(approx) == 4:
                    x, y, pw, ph = cv2.boundingRect(approx)
                    aspect_ratio = pw / float(ph)
                    if 1.8 <= aspect_ratio <= 6.5 and pw > 35 and ph > 12:
                        # 15% ROI Margin Expansion for Fast Moving Vehicles
                        margin_x = int(pw * 0.15)
                        margin_y = int(ph * 0.15)
                        x1 = max(0, x - margin_x)
                        y1 = max(0, y - margin_y)
                        x2 = min(w, x + pw + margin_x)
                        y2 = min(h, y + ph + margin_y)

                        plate_roi = sharpened_vehicle[y1:y2, x1:x2]
                        break

            if plate_roi is not None and self.ocr_reader is not None:
                rgb_roi = cv2.cvtColor(plate_roi, cv2.COLOR_BGR2RGB)
                results = self.ocr_reader.readtext(rgb_roi, detail=0, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-')
                for res in results:
                    formatted = self.format_plate_text(res)
                    if len(formatted) >= 5:
                        return formatted

        except Exception as e:
            logger.error(f"Error in ANPR license plate extraction: {e}")

        return None

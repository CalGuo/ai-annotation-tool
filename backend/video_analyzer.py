from ultralytics import YOLO
import cv2
import os
from video_utils import extract_frames

model = YOLO("yolov8n.pt")

def analyze_video(video_path):
    frames = extract_frames(video_path, "frames")
    annotated_frames = []

    for frame_path in frames:
        res = model(frame_path)
        frame = cv2.imread(frame_path)

        for box in res[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            confidence  = float(box.conf[0])
            label = f"{confidence:.2f}" # percentage in decimal format
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 225, 0), 2)

            cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        output_path = f"annotated_{os.path.basename(frame_path)}"
        cv2.imwrite(output_path, frame)
        annotated_frames.append(output_path)

    return annotated_frames

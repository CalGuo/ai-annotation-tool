import cv2
import os

def extract_frames(video_path, output_folder, frame_interval=10):

    os.makedirs(output_folder, exist=True)

    cap = cv2.VideoCapture(video_path)

    frame_count = 0
    saved_frames = []

    while True:
        ret, frame = cap.read()

        if not ret:
            break

        # saves 1 of every 10 frames
        if frame_count % frame_interval == 0:
            frame_path = os.path.join(output_folder, f"frame_{frame_count}.jpg")
            cv2.imwrite(frame_path, frame)
            saved_frames.append(frame_path)

        frame_count += 1

    cap.release()

    return saved_frames
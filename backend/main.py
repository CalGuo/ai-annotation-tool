from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import cv2
from fastapi.responses import JSONResponse
import shutil
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("yolov8n.pt")

@app.get("/")
def home():
    return {"message": "Airway AI Detection API is running"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}.jpg"
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    res = model(temp_path)

    boxes = []
    if res[0].boxes is not None:
        for box in res[0].boxes:
            boxes.append({
                "x1": float(box.xyxy[0][0]),
                "y1": float(box.xyxy[0][1]),
                "x2": float(box.xyxy[0][2]),
                "y2": float(box.xyxy[0][3]),
                "confidence": float(box.conf[0])
            })

    os.remove(temp_path)
    return {"detections": boxes}
    
@app.post("/extract_frames")
async def extract_frames(file: UploadFile = File(...), frame_count: int = 10):
    contents = await file.read()
    temp_video = "temp_video.mp4"

    with open(temp_video, "wb") as f:
        f.write(contents)

    cap = cv2.VideoCapture(temp_video)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(total_frames // frame_count, 1)
    frames = []
    i = 0
    frame_index = 0

    while cap.isOpened():
        ret, frame = cap.read()

        if not ret:
            break

        if i % step == 0 and frame_index < frame_count:
            _, buffer = cv2.imencode(".jpg", frame)
            frames.append(buffer.tobytes())
            frame_index += 1
        i += 1

    cap.release()
    os.remove(temp_video)

    return JSONResponse(
        content={"frames": [frame.hex() for frame in frames]}
    )
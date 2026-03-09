from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import shutil
import os

app = FastAPI()

model = YOLO("yolov8n.pt")

@app.get("/")
def home():
    return {"message": "Airway AI Detection API is running"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

        res = model(temp_path)

        boxes = []
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
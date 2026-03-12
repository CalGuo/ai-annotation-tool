# AI Annotation Tool

An AI-assisted annotation platform for labeling image and video datasets used in computer vision training.

This project provides a full-stack tool for uploading images or videos, extracting frames, generating bounding box suggestions using YOLOv8, manually adding annotations, and exporting datasets in YOLO training format.

---

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Export Structure](#export-structure)
- [Repository Structure](#repository-structure)

---

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/GITHUB_USERNAME/ai-annotation-tool.git
cd ai-annotation-tool
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Start the backend server:
```bash
uvicorn main:app --reload
```

> The backend API will run at **http://127.0.0.1:8000**


### 3. Frontend Setup

Open a new terminal:
```bash
cd frontend
npm install
npm run dev
```

> The frontend will run at **http://localhost:5173**


---

## Usage

1. Upload either multiple images or a single video file.

2. Videos: specify the number of frames to extract. Frames are processed using OpenCV and loaded into the annotation interface.

3. Run YOLOv8 detection on the current frame or across all frames at once. Detected bounding boxes are automatically added to the annotation layer.

4. Add bounding boxes manually using a click-and-drag interface on the canvas. Use the undo button to remove the most recent annotation on the current frame.

5. Browse frames using the previous and next controls.

6. Export the fully labeled dataset in YOLO training format.

---

## Export Structure
```
dataset/
├── images/
│   ├── frame_*.jpg
└── labels/
    └── frame_*.txt
```

Each label file follows YOLO format:
```
class x_center y_center width height
```

> Coordinates are normalized relative to the image dimensions.

---

## Repository Structure
```
ai-annotation-tool/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── video_analyzer.py
│   ├── video_utils.py
│   └── yolov8n.pt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── dashboard.css
│       ├── main.jsx
│       └── index.css
├── README.md
└── LICENSE
```

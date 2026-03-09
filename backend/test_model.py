from ultralytics import YOLO

model = YOLO("yolov8n.pt")

# sample image
res = model("https://ultralytics.com/images/bus.jpg")

res[0].save(filename="output.jpg")

for box in res[0].boxes:
	print(box.xyxy)


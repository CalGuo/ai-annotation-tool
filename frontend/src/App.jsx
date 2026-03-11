import { useState, useRef } from "react"

function App() {
  const [file, setFile] = useState(null)
  const [imageURL, setImageURL] = useState(null)
  const [detections, setDetections] = useState([])
  const [boxes, setBoxes] = useState([])
  const [drawing, setDrawing] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)

  const canvasRef = useRef(null)
  const imageRef = useRef(null)

  const handleUpload = async () => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      body: formData
    })

    const data = await response.json()
    setDetections(data.detections)
    setBoxes(data.detections)
    drawBoxes(data.detections)
  }

  const handleFileChange = (e) => {
    const selectFile = e.target.files[0]
    setFile(selectFile)
    const url = URL.createObjectURL(selectFile)
    setImageURL(url)
  }

  const drawBoxes = (boxes) => {
    if (!canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const img = imageRef.current

    const displayWidth = img.clientWidth
    const displayHeight = img.clientHeight

    canvas.width = displayWidth
    canvas.height = displayHeight

    const scaleX = displayWidth / img.naturalWidth
    const scaleY = displayHeight / img.naturalHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = "red"
    ctx.lineWidth = 2
    ctx.fillStyle = "red"

    boxes.forEach(box => {
      const x = box.x1 * scaleX
      const y = box.y1 * scaleY
      const width = (box.x2 - box.x1) * scaleX
      const height = (box.y2 - box.y1) * scaleY

      ctx.strokeRect(x, y, width, height)
      ctx.fillText(box.confidence.toFixed(2), x, y - 5)
    })
  }

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    setStartX(e.clientX - rect.left)
    setStartY(e.clientY - rect.top)
    setDrawing(true)
  }

  const handleMouseUp = (e) => {
    if (!drawing) return
    const rect = canvasRef.current.getBoundingClientRect()
    const endX = e.clientX - rect.left
    const endY = e.clientY - rect.top

    const img = imageRef.current
    const scaleX = img.naturalWidth / img.clientWidth
    const scaleY = img.naturalHeight / img.clientHeight
    
    if (Math.abs(endX - startX) < 5 || Math.abs(endY - startY) < 5) {
      setDrawing(false)
      return
    }

    const newBox = {
      x1: startX * scaleX,
      y1: startY * scaleY,
      x2: endX * scaleX,
      y2: endY * scaleY,
      confidence: 1.0
    }

    const updatedBoxes = [...boxes, newBox]

    setBoxes(updatedBoxes)
    drawBoxes(updatedBoxes)
    setDrawing(false)
  }

  const handleMouseMove = (e) => {
  if (!drawing) return

  const canvas = canvasRef.current
  const ctx = canvas.getContext("2d")
  const rect = canvas.getBoundingClientRect()

  const currentX = e.clientX - rect.left
  const currentY = e.clientY - rect.top

  drawBoxes(boxes)

  ctx.strokeStyle = "blue"
  ctx.lineWidth = 2
  ctx.strokeRect(startX, startY, currentX - startX, currentY - startY)
  }

const exportAnnotations = () => {
  if (!boxes.length) return

  const img = imageRef.current
  const imgWidth = img.naturalWidth
  const imgHeight = img.naturalHeight

  const yoloLabels = boxes.map(box => {
    const x_center = ((box.x1 + box.x2) / 2) / imgWidth
    const y_center = ((box.y1 + box.y2) / 2) / imgHeight
    const width = (box.x2 - box.x1) / imgWidth
    const height = (box.y2 - box.y1) / imgHeight

    return `0 ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`
  })

  const blob = new Blob([yoloLabels.join("\n")], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = "labels.txt"
  link.click()
}

  return (
    <div style={{padding:40}}>
      <h1>Airway AI Annotation Tool</h1>
      <input
        type="file"
        onChange={handleFileChange}
        />
        <button onClick={handleUpload}>
          Run AI Detection
        </button>
        <button onClick={exportAnnotations}>
          Export Dataset
        </button>
        <div style={{position:"relative", marginTop:20}}>
          {imageURL && (
            <>
              <img
                ref={imageRef}
                src={imageURL}
                alt="uploaded"
                style={{maxWidth:"600px"}}
                onLoad={() => drawBoxes(detections)}
              />
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{position:"absolute",
                        top:0,
                        left:0,
                        maxWidth:"600px"}}
              />
            </>
          )}
        </div>
    </div>
    )
  }

export default App

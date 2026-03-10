import { useState, useRef } from "react"

function App() {
  const [file, setFile] = useState(null)
  const [imageURL, setImageURL] = useState(null)
  const [detections, setDetections] = useState([])
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
    drawBoxes(data.detections)
  }

  const handleFileChange = (e) => {
    const selectFile = e.target.files[0]
    setFile(selectFile)
    const url = URL.createObjectURL(selectFile)
    setImageURL(url)
  }

  const drawBoxes = (boxes) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const img = imageRef.current

    const displayWidth = img.clientWidth
    const displayHeight = img.clientHeight

    canvas.width = img.width
    canvas.height = img.height

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
                style={{position:"absolute", top:0, left:0}}
              />
            </>
          )}
        </div>
    </div>
    )
  }

export default App

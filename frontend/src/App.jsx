import { useState, useRef } from "react"
import JSZip from "jszip"
import { saveAs } from "file-saver"

function App() {
  const [drawing, setDrawing] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [images, setImages] = useState([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [annotations, setAnnotations] = useState({})
  const [videoFile, setVideoFile] = useState(null)
  const [frameCount, setFrameCount] = useState(10)

  const canvasRef = useRef(null)
  const imageRef = useRef(null)

  const handleDetection = async () => {
    const response = await fetch(images[currentFrame])
    const blob = await response.blob()
    const formData = new FormData()
    formData.append("file", blob)
    const res = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      body: formData
    })
    const data = await res.json()
    const updatedAnnotations = { ...annotations }
    updatedAnnotations[currentFrame] = data.detections
    setAnnotations(updatedAnnotations)
    drawBoxes(data.detections)
  }

  const runDetectionAllFrames = async () => {
    if (images.length === 0) return
    const updatedAnnotations = { ...annotations }

    for (let i = 0; i < images.length; i++) {
      const response = await fetch(images[i])
      const blob = await response.blob()
      const formData = new FormData()
      formData.append("file", blob)
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        body: formData
      })
      const data = await res.json()
      updatedAnnotations[i] = data.detections
    }
    setAnnotations(updatedAnnotations)
    drawBoxes(updatedAnnotations[currentFrame])
  }

  const uploadVideo = async () => {
    const formData = new FormData()
    formData.append("file", videoFile)
    formData.append("frame_count", frameCount)

    const res = await fetch("http://127.0.0.1:8000/extract_frames", {
      method: "POST",
      body: formData
    })
    const data = await res.json()

    const urls = data.frames.map(hex => {
      const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
      const blob = new Blob([bytes], { type: "image/jpeg" })
      return URL.createObjectURL(blob)
    })

    setImages(urls)
    const initialAnnotations = {}
    urls.forEach((_, i) => {
      initialAnnotations[i] = []
    })
    setAnnotations(initialAnnotations)
    setCurrentFrame(0)
  }

  const exportDataset = async () => {
    const zip = new JSZip()
    const imagesFolder = zip.folder("dataset/images")
    const labelsFolder = zip.folder("dataset/labels")
    
    for (let i = 0; i < images.length; i++) {
      const imgURL = images[i]
      const response = await fetch(imgURL)
      const blob = await response.blob()
      const imageName = `frame_${String(i).padStart(3,"0")}.jpg`

      imagesFolder.file(imageName, blob)
      const img = new Image()
      img.src = imgURL


      await new Promise(resolve => {
        img.onload = resolve
      })

      const imgWidth = img.width
      const imgHeight = img.height
      const frameBoxes = annotations[i] || []
      
      const yoloLabels = frameBoxes.map(box => {
        const x_center = ((box.x1 + box.x2) / 2) / imgWidth
        const y_center = ((box.y1 + box.y2) / 2) / imgHeight
        const width = (box.x2 - box.x1) / imgWidth
        const height = (box.y2 - box.y1) / imgHeight

        return `0 ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`
      }).join("\n")
      
      const labelName = `frame_${String(i).padStart(3,"0")}.txt`
      labelsFolder.file(labelName, yoloLabels)
  }
  
  const content = await zip.generateAsync({ type: "blob" })
  saveAs(content, "dataset.zip")
}

  const frameBoxes = annotations[currentFrame] || []
  const drawBoxes = (frameBoxes) => {
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

    frameBoxes.forEach(box => {
      const x = box.x1 * scaleX
      const y = box.y1 * scaleY
      const width = (box.x2 - box.x1) * scaleX
      const height = (box.y2 - box.y1) * scaleY

      ctx.strokeRect(x, y, width, height)
      ctx.fillText(box.confidence.toFixed(2), x, y - 5)
    })
  }

  const handleMouseDown = (e) => {
    if (!canvasRef.current || !imageRef.current) return

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

    const x1 = Math.min(startX, endX)
    const y1 = Math.min(startY, endY)
    const x2 = Math.max(startX, endX)
    const y2 = Math.max(startY, endY)

    const newBox = {
      x1: x1 * scaleX,
      y1: y1 * scaleY,
      x2: x2 * scaleX,
      y2: y2 * scaleY,
      confidence: 1.0
    }

    const updatedAnnotations = { ...annotations }
    const frameBoxes = updatedAnnotations[currentFrame] || []
    updatedAnnotations[currentFrame] = [...frameBoxes, newBox]

    setAnnotations(updatedAnnotations)
    drawBoxes(updatedAnnotations[currentFrame])
    setDrawing(false)
  }

  const handleMouseMove = (e) => {
  if (!drawing) return

  const canvas = canvasRef.current
  const ctx = canvas.getContext("2d")
  const rect = canvas.getBoundingClientRect()

  const currentX = e.clientX - rect.left
  const currentY = e.clientY - rect.top

  drawBoxes(annotations[currentFrame] || [])

  ctx.strokeStyle = "blue"
  ctx.lineWidth = 2
  ctx.strokeRect(startX, startY, currentX - startX, currentY - startY)
  }

  const undoLastBox = () => {
    const frameBoxes = annotations[currentFrame] || []
    if (frameBoxes.length === 0) return

    const updatedAnnotations = { ...annotations }
    updatedAnnotations[currentFrame] = frameBoxes.slice(0, -1)
    setAnnotations(updatedAnnotations)
  }

  const exportAnnotations = () => {
    const frameBoxes = annotations[currentFrame] || []
    if (!frameBoxes.length) return

    const img = imageRef.current
    const imgWidth = img.naturalWidth
    const imgHeight = img.naturalHeight
    
    const yoloLabels = frameBoxes.map (box => {
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

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    const urls = files.map(file => URL.createObjectURL(file))
    setImages(urls)
    setCurrentFrame(0)
    const initialAnnotations = {}

    urls.forEach((_, i) => {
      initialAnnotations[i] = []
    })

    setAnnotations(initialAnnotations)
  }

  const nextFrame = () => {
    if (currentFrame < images.length - 1) {
      const next = currentFrame + 1
      setCurrentFrame(next)
    }
  }

  const prevFrame = () => {
    if (currentFrame > 0) {
      const prev = currentFrame - 1
      setCurrentFrame(prev)
    }
  }

  const totalFrames = images.length
  const framesAnnotated = Object.values(annotations).filter(boxes => boxes.length > 0).length
  const totalBoxes = Object.values(annotations).reduce((sum, boxes) => sum + boxes.length, 0)

  return (
    <div style={{padding:40}}>
      <h1>AI Annotation Tool</h1>
      <input
        type="file"
        multiple
        onChange={handleFileUpload}
        />
        <button onClick={handleDetection} disabled={images.length === 0}>
          Run AI Detection
        </button>
        <button onClick={runDetectionAllFrames}>
          Run Detection on All Frames
        </button>
        <button onClick={exportAnnotations}>
          Export Current Frame
        </button>
        <button onClick={exportDataset}>
          Export Full Dataset
        </button>
        <div style={{marginTop:20}}>
        <button onClick={prevFrame}>Previous</button>
        <span style={{margin:"0 10px"}}>Frame {currentFrame + 1} / {images.length}</span>
        <button onClick={nextFrame}>Next</button>
        </div>
        <button onClick={undoLastBox}
                disabled={(annotations[currentFrame] || []).length === 0}>
          Undo Last Annotation
        </button>
        <div style={{
          marginTop:20,
          padding:15,
          border:"1px solid #ccc",
          width:"300px",
          }}>
        <h3>Annotation Stats</h3>
        <p>Total Frames: {totalFrames}</p>
        <p>Frames Annotated: {framesAnnotated}</p>
        <p>Total Boxes: {totalBoxes}</p>
        </div>
        <div style={{marginTop:20}}>
          <h3>Upload Video</h3>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files[0])}
          />
          <input
            type="number"
            value={frameCount}
            onChange={(e) => setFrameCount(parseInt(e.target.value))}
            placeholder="Number of frames to extract"
          />
          <button onClick={uploadVideo} disabled={!videoFile}>
          Extract Frames
          </button>
        </div>
        <div style={{position:"relative", marginTop:20}}>
          {images.length > 0 && (
            <>
              <img
                ref={imageRef}
                src={images[currentFrame]}
                alt="uploaded"
                style={{maxWidth:"600px"}}
                onLoad={() => drawBoxes(annotations[currentFrame] || [])}
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

import { useState, useRef } from "react"
import JSZip from "jszip"
import { saveAs } from "file-saver"
import "./dashboard.css"

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
    const newBoxes = frameBoxes.slice(0, -1)

    updatedAnnotations[currentFrame] = newBoxes
    setAnnotations(updatedAnnotations)

    drawBoxes(newBoxes)
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
  const annotationProgress = totalFrames === 0 ? 0 : Math.round((framesAnnotated / totalFrames) * 100)

  return (
    <>
      <div className="dash-shell">
        <header className="topbar">
          <div className="topbar-logo">
            <div className="topbar-logo-dot" />
            AI Annotation Tool
          </div>
          <div className="topbar-divider" />
          <span className="topbar-route">workspace</span>
          <div className="topbar-badge">YOLOv8</div>
        </header>
        <aside className="sidebar">
          <div className="sidebar-section-label">Navigation</div>
          <div className="frame-nav">
            <div className="frame-nav-label">Frame</div>
            <div className="frame-counter">
              {images.length > 0 ? String(currentFrame + 1).padStart(2, "0") : "-"}
              <span> / {images.length > 0 ? String(images.length).padStart(2, "0") : "-"}</span>
            </div>
            <div className="frame-btn-row">
              <button className="btn btn-nav" onClick={prevFrame} disabled={currentFrame === 0}>
                ← Prev
              </button>
              <button className="btn btn-nav" onClick={nextFrame} disabled={currentFrame >= images.length - 1}>
                Next →
              </button>
            </div>
          </div>
          <div className="stats-card">
            <div className="stats-card-title">Statistics</div>
            <div className="stat-row">
              <span className="stat-label">Total Frames</span>
              <span className="stat-value">{totalFrames}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Annotated Frames</span>
              <span className="stat-value">{framesAnnotated}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Boxes</span>
              <span className="stat-value">{totalBoxes}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">This Frame</span>
              <span className="stat-value">{frameBoxes.length}</span>
            </div>
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill"
                style={{ width: `${annotationProgress}%` }}
              />
            </div>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#475569", marginTop: 6, textAlign: "right" }}>
              {annotationProgress}% complete
            </div>
          </div>

        </aside>
        <main className="main-content">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-dot" />
              <span className="panel-title">Source</span>
            </div>
            <div className="panel-body">
              <div className="controls-grid">
                <div>
                  <label className="file-input-label">
                    <span>Upload Images</span>
                    <input type="file" multiple onChange={handleFileUpload} />
                  </label>
                  {images.length > 0 && (
                    <div className="file-status">✓ {images.length} image{images.length !== 1 ? "s" : ""} loaded</div>
                  )}
                </div>
                <div>
                  <label className="file-input-label">
                    <span>{videoFile ? videoFile.name : "Upload Video"}</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setVideoFile(e.target.files[0])}
                    />
                  </label>
                  <div className="number-input-row">
                    <span className="number-input-label">Frames:</span>
                    <input
                      className="number-input"
                      type="number"
                      value={frameCount}
                      onChange={(e) => setFrameCount(parseInt(e.target.value))}
                      placeholder="10"
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={uploadVideo}
                      disabled={!videoFile}
                      style={{ flex: 1 }}
                    >
                      Extract
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-dot" style={{ background: "#a78bfa", boxShadow: "0 0 6px #a78bfa" }} />
              <span className="panel-title">Detection &amp; Export</span>
            </div>
            <div className="panel-body">
              <div className="controls-grid">
                <button
                  className="btn btn-primary"
                  onClick={handleDetection}
                  disabled={images.length === 0}
                >
                  Run AI Detection
                </button>
                <button
                  className="btn btn-primary"
                  onClick={runDetectionAllFrames}
                  disabled={images.length === 0}
                >
                  Detect All Frames
                </button>
                <button
                  className="btn btn-success"
                  onClick={exportAnnotations}
                  disabled={frameBoxes.length === 0}
                >
                  Export Current Frame
                </button>
                <button
                  className="btn btn-success"
                  onClick={exportDataset}
                  disabled={images.length === 0}
                >
                  Export Full Dataset
                </button>
                <button
                  className="btn btn-danger"
                  onClick={undoLastBox}
                  disabled={(annotations[currentFrame] || []).length === 0}
                >
                  Undo Last Annotation
                </button>
              </div>
            </div>
          </div>
          <div className="panel viewer-panel" style={{ flex: 1 }}>
            <div className="panel-header">
              <div className="panel-dot" style={{ background: "#34d399", boxShadow: "0 0 6px #34d399" }} />
              <span className="panel-title">
                Annotation Viewer
                {images.length > 0 && (
                  <span style={{ marginLeft: 12, color: "#475569", fontSize: 10 }}>
                    — Frame {currentFrame + 1} of {images.length} · {frameBoxes.length} box{frameBoxes.length !== 1 ? "es" : ""}
                  </span>
                )}
              </span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {images.length === 0 ? (
                <div className="viewer-empty">
                  <div className="viewer-empty-icon">[FRAME]</div>
                  <div>No images loaded</div>
                  <div style={{ fontSize: 11, color: "#1e2330" }}>Upload images or extract video frames above</div>
                </div>
              ) : (
                <div className="viewer-img-wrap">
                  <img
                    ref={imageRef}
                    src={images[currentFrame]}
                    alt="annotation frame"
                    onLoad={() => drawBoxes(annotations[currentFrame] || [])}
                  />
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  />
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </>
  )
}

export default App

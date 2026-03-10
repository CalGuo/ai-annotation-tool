import { useState } from "react"

function App() {
  const [file, setFile] = useState(null)
  const [detections, setDetections] = useState([])

  const handleUpload = async () => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      body: formData
    })

    const data = await response.json()
    setDetections(data.detections)
  }
  return (
    <div style={{padding:40}}>
      <h1>Airway AI Annotation Tool</h1>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
        />
        <button onClick={handleUpload}>
          Run AI Detection
        </button>
        <h2>Detections</h2>
        <pre>
          {JSON.stringify(detections, null, 2)}
        </pre>
      </div>
    )
  }

export default App

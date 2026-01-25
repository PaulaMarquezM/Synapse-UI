import CameraFeed from "./components/CameraFeed"
import type { DetectionData } from "./components/CameraFeed"

export default function CameraPage() {
  const handleDetection = (data: DetectionData) => {
    // 🔁 Enviar datos al background / popup
    chrome.runtime.sendMessage({
      type: "UPDATE_FOCUS_DATA",
      data
    })
  }

  return <CameraFeed onDetection={handleDetection} />
}

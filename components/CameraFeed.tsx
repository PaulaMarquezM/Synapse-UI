import React, { useRef, useEffect, useState } from "react"
import * as faceapi from "face-api.js"

// Datos que se envían al Dashboard
export interface DetectionData {
  expressions: faceapi.FaceExpressions
  gazeX: number
  gazeY: number
  headPose: {
    yaw: number
    pitch: number
    roll: number
  }
  blinkRate: number
}

interface CameraFeedProps {
  onDetection: (data: DetectionData) => void
}

const CameraFeed: React.FC<CameraFeedProps> = ({ onDetection }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Seguimiento de mirada
  const [gazeData, setGazeData] = useState({ x: 0, y: 0 })

  // Parpadeo
  const blinkHistory = useRef<number[]>([])
  const lastEyeState = useRef<boolean>(true) // true = ojos abiertos

  /* ============================
     CARGA DE MODELOS (CORREGIDO)
     ============================ */
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = chrome.runtime.getURL("models")

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ])

        console.log("[SYNAPSE] Modelos de IA cargados correctamente")
        setModelsLoaded(true)
      } catch (error) {
        console.error("[SYNAPSE] Error al cargar modelos:", error)
      }
    }

    loadModels()
  }, [])

  /* ============================
     INICIALIZAR CÁMARA
     ============================ */
  useEffect(() => {
    if (modelsLoaded && !isInitialized) {
      startVideo()
    }
  }, [modelsLoaded, isInitialized])

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user"
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsInitialized(true)
        console.log("[SYNAPSE] Cámara inicializada")
      }
    } catch (err) {
      console.error("[SYNAPSE] Error al acceder a la cámara:", err)
    }
  }

  /* ============================
     CÁLCULO DE ORIENTACIÓN
     ============================ */
  const calculateHeadPose = (landmarks: faceapi.FaceLandmarks68) => {
    const nose = landmarks.getNose()
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()

    const noseTip = nose[3]
    const leftEyeCenter = leftEye[0]
    const rightEyeCenter = rightEye[3]

    const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x)
    const noseOffset =
      noseTip.x - (leftEyeCenter.x + rightEyeCenter.x) / 2
    const yaw = (noseOffset / eyeDistance) * 45

    const eyeLevel = (leftEyeCenter.y + rightEyeCenter.y) / 2
    const nosePitch = (noseTip.y - eyeLevel) / 50
    const pitch = Math.max(-30, Math.min(30, nosePitch * 30))

    const eyeAngle = Math.atan2(
      rightEyeCenter.y - leftEyeCenter.y,
      rightEyeCenter.x - leftEyeCenter.x
    )
    const roll = (eyeAngle * 180) / Math.PI

    return { yaw, pitch, roll }
  }

  /* ============================
     DETECCIÓN DE PARPADEO
     ============================ */
  const detectBlink = (landmarks: faceapi.FaceLandmarks68): boolean => {
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()

    const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y)
    const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y)

    const leftEyeWidth = Math.abs(leftEye[3].x - leftEye[0].x)
    const rightEyeWidth = Math.abs(rightEye[3].x - rightEye[0].x)

    const leftEAR = leftEyeHeight / leftEyeWidth
    const rightEAR = rightEyeHeight / rightEyeWidth
    const avgEAR = (leftEAR + rightEAR) / 2

    return avgEAR < 0.15
  }

  /* ============================
     ESTIMACIÓN DE MIRADA
     ============================ */
  const estimateGaze = (detection: faceapi.WithFaceLandmarks<any>) => {
    const box = detection.detection.box
    const videoWidth = videoRef.current?.videoWidth || 640
    const videoHeight = videoRef.current?.videoHeight || 480

    const faceCenterX = box.x + box.width / 2
    const faceCenterY = box.y + box.height / 2

    const screenX =
      window.screen.width * (1 - faceCenterX / videoWidth)
    const screenY =
      window.screen.height * (faceCenterY / videoHeight)

    setGazeData({ x: screenX, y: screenY })
    return { x: screenX, y: screenY }
  }

  /* ============================
     FRECUENCIA DE PARPADEO
     ============================ */
  const updateBlinkRate = () => {
    const now = Date.now()
    blinkHistory.current = blinkHistory.current.filter(
      (time) => now - time < 60000
    )
    return blinkHistory.current.length
  }

  /* ============================
     LOOP PRINCIPAL DE DETECCIÓN
     ============================ */
  const handleVideoOnPlay = () => {
    if (!videoRef.current || !canvasRef.current) return

    const detect = async () => {
      if (!videoRef.current || !modelsLoaded) return

      try {
        const detections = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()
          .withFaceExpressions()

        if (detections) {
          const headPose = calculateHeadPose(detections.landmarks)

          const isBlinking = detectBlink(detections.landmarks)
          if (isBlinking && lastEyeState.current) {
            blinkHistory.current.push(Date.now())
          }
          lastEyeState.current = !isBlinking

          const blinkRate = updateBlinkRate()
          const gaze = estimateGaze(detections)

          const combinedData: DetectionData = {
            expressions: detections.expressions,
            gazeX: gaze.x,
            gazeY: gaze.y,
            headPose,
            blinkRate
          }

          onDetection(combinedData)
        }
      } catch (error) {
        console.error("[SYNAPSE] Error en detección:", error)
      }

      setTimeout(detect, 150)
    }

    detect()
  }

  return (
    <div style={{ position: "relative" }}>
      <video
        ref={videoRef}
        onPlay={handleVideoOnPlay}
        autoPlay
        muted
        playsInline
        style={{ display: "none" }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {!modelsLoaded && (
        <div
          style={{
            color: "#fbbf24",
            padding: "10px",
            background: "rgba(251, 191, 36, 0.1)",
            borderRadius: "8px",
            fontSize: "12px"
          }}
        >
          ⏳ Cargando modelos de IA...
        </div>
      )}

      {modelsLoaded && !isInitialized && (
        <div
          style={{
            color: "#60a5fa",
            padding: "10px",
            background: "rgba(96, 165, 250, 0.1)",
            borderRadius: "8px",
            fontSize: "12px"
          }}
        >
          📹 Inicializando cámara...
        </div>
      )}
    </div>
  )
}

export default CameraFeed

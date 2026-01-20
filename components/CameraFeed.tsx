// src/components/CameraFeed.tsx
// (Ajusta la ruta si tu CameraFeed está en otro directorio)

import React, { useRef, useEffect, useState } from "react"
import type * as FaceApi from "face-api.js"

// IMPORTANTE:
// - Si NO usas alias "~", cambia esta línea por una ruta relativa correcta.
//   Ejemplo (si CameraFeed.tsx está en src/components/):
//   import { installModelFetchPatch } from "../lib/installModelFetchPatch"
import { installModelFetchPatch } from "~lib/installModelFetchPatch"

// Datos que se envían al Dashboard
export interface DetectionData {
  expressions: FaceApi.FaceExpressions
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

  // Guardamos el módulo face-api.js aquí, porque ahora lo importamos dinámicamente
  const faceapiRef = useRef<typeof import("face-api.js") | null>(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Seguimiento de mirada
  const [gazeData, setGazeData] = useState({ x: 0, y: 0 })

  // Parpadeo
  const blinkHistory = useRef<number[]>([])
  const lastEyeState = useRef<boolean>(true) // true = ojos abiertos

  /* ============================
     CARGA DE MODELOS + DEBUG
     ============================ */
  useEffect(() => {
    let isActive = true

    const loadModels = async () => {
      try {
        console.log("========== [SYNAPSE] INICIO CARGA MODELOS ==========")
        console.log("[SYNAPSE] UserAgent:", navigator.userAgent)
        console.log("[SYNAPSE] Location:", window.location.href)
        console.log("[SYNAPSE] Extension ID (host):", window.location.host)

        // 1) Patch global del fetch ANTES de importar face-api
        console.log("[SYNAPSE] Instalando GLOBAL fetch patch...")
        installModelFetchPatch()
        console.log("[SYNAPSE] GLOBAL fetch patch instalado ✅")

        // 2) Import dinámico de face-api (importante para que tfjs inicialice con fetch ya parchado)
        console.log("[SYNAPSE] Importando face-api.js dinámicamente...")
        const faceapi = await import("face-api.js")
        faceapiRef.current = faceapi
        console.log("[SYNAPSE] face-api.js importado ✅")

        // Base URL absoluta real del build
        const BASE = chrome.runtime.getURL("assets/models/")
        console.log("[SYNAPSE] MODEL_BASE =", BASE)

        /* --------------------------------------------------
           VERIFICACIÓN DURA (SI ESTO FALLA, ES RUTA/BUILD)
           -------------------------------------------------- */
        const requiredFiles = [
          "tiny_face_detector_model-weights_manifest.json",
          "tiny_face_detector_model-shard1",
          "face_expression_model-weights_manifest.json",
          "face_expression_model-shard1",
          "face_landmark_68_model-weights_manifest.json",
          "face_landmark_68_model-shard1"
        ]

        console.log("[SYNAPSE] Verificando accesibilidad de archivos...")
        for (const file of requiredFiles) {
          const url = `${BASE}${file}`
          const r = await fetch(url, { cache: "no-store" })
          console.log("[SYNAPSE] CHECK FILE:", r.status, r.ok, url)
          if (!r.ok) throw new Error(`Archivo no accesible: ${url}`)
        }
        console.log("[SYNAPSE] Accesibilidad OK ✅")

        /* --------------------------------------------------
           CARGA REAL DE MODELOS
           -------------------------------------------------- */
        console.log("[SYNAPSE] Iniciando face-api loadFromUri(BASE)...")

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(BASE),
          faceapi.nets.faceExpressionNet.loadFromUri(BASE),
          faceapi.nets.faceLandmark68Net.loadFromUri(BASE)
        ])

        if (!isActive) return

        console.log("✅ [SYNAPSE] MODELOS DE IA CARGADOS CORRECTAMENTE")
        setModelsLoaded(true)
      } catch (error) {
        console.error("❌ [SYNAPSE] ERROR CARGANDO MODELOS:", error)

        // Dump extra por si el error es intermitente
        try {
          const BASE = chrome.runtime.getURL("assets/models/")
          const urls = [
            `${BASE}tiny_face_detector_model-weights_manifest.json`,
            `${BASE}tiny_face_detector_model-shard1`,
            `${BASE}face_expression_model-weights_manifest.json`,
            `${BASE}face_expression_model-shard1`,
            `${BASE}face_landmark_68_model-weights_manifest.json`,
            `${BASE}face_landmark_68_model-shard1`
          ]

          console.log("[SYNAPSE] Dump de accesibilidad de archivos...")
          for (const u of urls) {
            try {
              const r = await fetch(u, { cache: "no-store" })
              console.log("  ", r.status, r.ok, u)
            } catch (e) {
              console.error("  FAIL", u, e)
            }
          }
        } catch {
          // ignore
        }
      }
    }

    loadModels()

    return () => {
      isActive = false
      console.log("[SYNAPSE] Cleanup loadModels")
    }
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
      console.log("[SYNAPSE] Solicitando cámara...")
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
        console.log("[SYNAPSE] Cámara inicializada ✅")
      }
    } catch (err) {
      console.error("[SYNAPSE] Error al acceder a la cámara:", err)
    }
  }

  /* ============================
     CÁLCULO DE ORIENTACIÓN
     ============================ */
  const calculateHeadPose = (landmarks: FaceApi.FaceLandmarks68) => {
    const nose = landmarks.getNose()
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()

    const noseTip = nose[3]
    const leftEyeCenter = leftEye[0]
    const rightEyeCenter = rightEye[3]

    const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x)
    const noseOffset = noseTip.x - (leftEyeCenter.x + rightEyeCenter.x) / 2
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
  const detectBlink = (landmarks: FaceApi.FaceLandmarks68): boolean => {
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
  const estimateGaze = (detection: FaceApi.WithFaceLandmarks<any>) => {
    const box = detection.detection.box
    const videoWidth = videoRef.current?.videoWidth || 640
    const videoHeight = videoRef.current?.videoHeight || 480

    const faceCenterX = box.x + box.width / 2
    const faceCenterY = box.y + box.height / 2

    const screenX = window.screen.width * (1 - faceCenterX / videoWidth)
    const screenY = window.screen.height * (faceCenterY / videoHeight)

    setGazeData({ x: screenX, y: screenY })
    return { x: screenX, y: screenY }
  }

  /* ============================
     FRECUENCIA DE PARPADEO
     ============================ */
  const updateBlinkRate = () => {
    const now = Date.now()
    blinkHistory.current = blinkHistory.current.filter((time) => now - time < 60000)
    return blinkHistory.current.length
  }

  /* ============================
     LOOP PRINCIPAL DE DETECCIÓN
     ============================ */
  const handleVideoOnPlay = () => {
    if (!videoRef.current || !canvasRef.current) return

    const detect = async () => {
      const faceapi = faceapiRef.current
      if (!videoRef.current || !modelsLoaded || !faceapi) return

      try {
        const detections = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
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

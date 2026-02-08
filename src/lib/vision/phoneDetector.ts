/**
 * Phone Detector - Detección de celular en cámara usando COCO-SSD
 *
 * Usa el modelo lite_mobilenet_v2 (~2MB) para detectar objetos.
 * Filtra solo la clase "cell phone" con confidence > 0.5.
 * Maneja errores silenciosamente para no bloquear face detection.
 */

import type * as CocoSsd from "@tensorflow-models/coco-ssd"

let model: CocoSsd.ObjectDetection | null = null
let loading = false
let loadFailed = false

export interface PhoneDetectionResult {
  detected: boolean
  confidence: number
}

/**
 * Carga el modelo COCO-SSD (lite_mobilenet_v2).
 * Retorna true si se cargó correctamente, false si falló.
 * Solo intenta cargar una vez; si falla, no reintenta.
 */
export async function loadPhoneDetector(): Promise<boolean> {
  if (model) return true
  if (loadFailed) return false
  if (loading) return false

  loading = true
  try {
    const tf = await import("@tensorflow/tfjs")
    await tf.ready()

    const cocoSsd = await import("@tensorflow-models/coco-ssd")
    model = await cocoSsd.load({ base: "lite_mobilenet_v2" })

    console.log("[SYNAPSE] COCO-SSD cargado correctamente")
    loading = false
    return true
  } catch (err) {
    console.warn("[SYNAPSE] No se pudo cargar COCO-SSD:", err)
    loading = false
    loadFailed = true
    return false
  }
}

/**
 * Detecta si hay un celular visible en el frame del video.
 * Retorna { detected: false, confidence: 0 } si el modelo no está cargado o hay error.
 */
export async function detectPhone(
  video: HTMLVideoElement
): Promise<PhoneDetectionResult> {
  if (!model) return { detected: false, confidence: 0 }

  try {
    const predictions = await model.detect(video)

    const phonePrediction = predictions.find(
      (p) => p.class === "cell phone" && p.score > 0.5
    )

    if (phonePrediction) {
      return { detected: true, confidence: phonePrediction.score }
    }

    return { detected: false, confidence: 0 }
  } catch {
    return { detected: false, confidence: 0 }
  }
}

/**
 * Retorna true si el modelo está listo para usar.
 */
export function isPhoneDetectorReady(): boolean {
  return model !== null
}

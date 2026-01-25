/**
 * SYNAPSE UI - Facial Signal Analyzers
 * Extrae señales cognitivas de los landmarks faciales de MediaPipe
 */

import type {
  FacialLandmarks,
  EyeMetrics,
  FacialExpression,
  HeadPose,
} from './types';

// ============================================
// CONSTANTES - Índices de MediaPipe
// ============================================

// Índices de landmarks de MediaPipe Face Mesh
const LANDMARKS = {
  // Ojos
  LEFT_EYE: [33, 133, 160, 159, 158, 157, 173, 144],
  RIGHT_EYE: [362, 263, 387, 386, 385, 384, 398, 373],
  LEFT_IRIS: [468, 469, 470, 471],
  RIGHT_IRIS: [473, 474, 475, 476],
  
  // Cejas
  LEFT_EYEBROW: [70, 63, 105, 66, 107],
  RIGHT_EYEBROW: [300, 293, 334, 296, 336],
  
  // Boca
  LIPS_OUTER: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  LIPS_INNER: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  
  // Nariz
  NOSE_TIP: [1],
  NOSE_BRIDGE: [168],
  
  // Contorno facial
  FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
};

// ============================================
// UTILIDADES GEOMÉTRICAS
// ============================================

function euclideanDistance(
  p1: { x: number; y: number; z?: number },
  p2: { x: number; y: number; z?: number }
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateAngle(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
}

// ============================================
// ANALIZADOR DE MÉTRICAS OCULARES
// ============================================

export class EyeAnalyzer {
  private blinkHistory: number[] = [];
  private gazeHistory: Array<{ x: number; y: number; timestamp: number }> = [];
  private maxHistorySize = 60; // 60 frames
  
  analyze(landmarks: FacialLandmarks): EyeMetrics {
    const leftEye = this.analyzeEye(landmarks, 'left');
    const rightEye = this.analyzeEye(landmarks, 'right');
    
    // Promedio de ambos ojos
    const eyeOpenness = (leftEye.openness + rightEye.openness) / 2;
    
    // Detectar parpadeo
    this.detectBlink(eyeOpenness);
    
    // Dirección de la mirada
    const gazeDirection = this.calculateGazeDirection(landmarks);
    
    // Estabilidad de la mirada
    const gazeStability = this.calculateGazeStability(gazeDirection);
    
    return {
      gazeDirection,
      blinkRate: this.calculateBlinkRate(),
      eyeOpenness,
      pupilDilation: 0.5, // Placeholder - requiere iris tracking avanzado
      gazeStability,
    };
  }
  
  private analyzeEye(
    landmarks: FacialLandmarks,
    eye: 'left' | 'right'
  ): { openness: number } {
    const eyePoints = eye === 'left' ? LANDMARKS.LEFT_EYE : LANDMARKS.RIGHT_EYE;
    
    // Calcular apertura vertical del ojo (EAR - Eye Aspect Ratio)
    const points = eyePoints.map(i => landmarks.landmarks[i]);
    
    const verticalDist1 = euclideanDistance(points[1], points[5]);
    const verticalDist2 = euclideanDistance(points[2], points[4]);
    const horizontalDist = euclideanDistance(points[0], points[3]);
    
    const ear = (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);
    
    // Normalizar a 0-1 (EAR típico: cerrado ~0.1, abierto ~0.3)
    const openness = Math.min(Math.max((ear - 0.1) / 0.2, 0), 1);
    
    return { openness };
  }
  
  private detectBlink(eyeOpenness: number): void {
    const timestamp = Date.now();
    
    // Umbral de parpadeo
    if (eyeOpenness < 0.3) {
      this.blinkHistory.push(timestamp);
    }
    
    // Mantener solo últimos 60 segundos
    const cutoff = timestamp - 60000;
    this.blinkHistory = this.blinkHistory.filter(t => t > cutoff);
  }
  
  private calculateBlinkRate(): number {
    // Parpadeos en el último minuto
    return this.blinkHistory.length;
  }
  
  private calculateGazeDirection(landmarks: FacialLandmarks): { x: number; y: number } {
    // Simplificación: usar posición del iris relativa al ojo
    // En producción, usar iris tracking de MediaPipe
    
    const leftIris = landmarks.landmarks[468]; // Centro del iris izquierdo
    const rightIris = landmarks.landmarks[473]; // Centro del iris derecho
    
    // Promedio de ambos iris
    const gazeX = (leftIris.x + rightIris.x) / 2;
    const gazeY = (leftIris.y + rightIris.y) / 2;
    
    // Normalizar a -1 a 1
    const normalizedX = (gazeX - 0.5) * 2;
    const normalizedY = (gazeY - 0.5) * 2;
    
    // Registrar en historial
    this.gazeHistory.push({
      x: normalizedX,
      y: normalizedY,
      timestamp: Date.now(),
    });
    
    // Mantener solo últimos 2 segundos
    const cutoff = Date.now() - 2000;
    this.gazeHistory = this.gazeHistory.filter(g => g.timestamp > cutoff);
    
    return { x: normalizedX, y: normalizedY };
  }
  
  private calculateGazeStability(currentGaze: { x: number; y: number }): number {
    if (this.gazeHistory.length < 10) return 0.5;
    
    // Calcular desviación estándar de la mirada
    const recentGazes = this.gazeHistory.slice(-30);
    
    const avgX = recentGazes.reduce((sum, g) => sum + g.x, 0) / recentGazes.length;
    const avgY = recentGazes.reduce((sum, g) => sum + g.y, 0) / recentGazes.length;
    
    const variance =
      recentGazes.reduce((sum, g) => {
        return sum + Math.pow(g.x - avgX, 2) + Math.pow(g.y - avgY, 2);
      }, 0) / recentGazes.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Invertir: menor desviación = mayor estabilidad
    // Normalizar a 0-1
    const stability = Math.max(0, 1 - stdDev * 2);
    
    return stability;
  }
}

// ============================================
// ANALIZADOR DE EXPRESIONES FACIALES
// ============================================

export class ExpressionAnalyzer {
  analyze(landmarks: FacialLandmarks): FacialExpression {
    // Calcular tensión en cejas (estrés)
    const eyebrowFurrow = this.analyzeEyebrowFurrow(landmarks);
    
    // Calcular tensión en boca
    const mouthTension = this.analyzeMouthTension(landmarks);
    
    // Placeholder para expresiones completas
    // En producción, usar un modelo de clasificación entrenado
    const neutral = 1 - (eyebrowFurrow + mouthTension) / 2;
    
    return {
      neutral: Math.max(0, neutral),
      happy: 0,
      sad: 0,
      angry: eyebrowFurrow,
      fearful: 0,
      disgusted: 0,
      surprised: 0,
      eyebrowFurrow,
      mouthTension,
    };
  }
  
  private analyzeEyebrowFurrow(landmarks: FacialLandmarks): number {
    const leftBrow = LANDMARKS.LEFT_EYEBROW.map(i => landmarks.landmarks[i]);
    const rightBrow = LANDMARKS.RIGHT_EYEBROW.map(i => landmarks.landmarks[i]);
    
    // Calcular distancia entre cejas (más cerca = más fruncido)
    const leftInner = leftBrow[0];
    const rightInner = rightBrow[0];
    
    const distance = euclideanDistance(leftInner, rightInner);
    
    // Normalizar (valores típicos: relajado ~0.15, fruncido ~0.10)
    const furrow = Math.max(0, 1 - (distance / 0.15));
    
    return Math.min(furrow, 1);
  }
  
  private analyzeMouthTension(landmarks: FacialLandmarks): number {
    const outerLips = LANDMARKS.LIPS_OUTER.map(i => landmarks.landmarks[i]);
    const innerLips = LANDMARKS.LIPS_INNER.map(i => landmarks.landmarks[i]);
    
    // Calcular compresión de labios
    const outerHeight = euclideanDistance(outerLips[3], outerLips[9]);
    const innerHeight = euclideanDistance(innerLips[3], innerLips[9]);
    
    const compression = 1 - (innerHeight / outerHeight);
    
    return Math.min(Math.max(compression, 0), 1);
  }
}

// ============================================
// ANALIZADOR DE POSTURA DE CABEZA
// ============================================

export class HeadPoseAnalyzer {
  private poseHistory: Array<{ pitch: number; yaw: number; roll: number; timestamp: number }> = [];
  
  analyze(landmarks: FacialLandmarks): HeadPose {
    // Calcular ángulos de rotación usando puntos clave
    const noseTip = landmarks.landmarks[LANDMARKS.NOSE_TIP[0]];
    const noseBridge = landmarks.landmarks[LANDMARKS.NOSE_BRIDGE[0]];
    
    const leftEye = landmarks.landmarks[LANDMARKS.LEFT_EYE[0]];
    const rightEye = landmarks.landmarks[LANDMARKS.RIGHT_EYE[0]];
    
    // Yaw (rotación izq/derecha)
    const yaw = this.calculateYaw(leftEye, rightEye, noseTip);
    
    // Pitch (inclinación arriba/abajo)
    const pitch = this.calculatePitch(noseTip, noseBridge);
    
    // Roll (inclinación lateral)
    const roll = this.calculateRoll(leftEye, rightEye);
    
    // Guardar en historial
    this.poseHistory.push({ pitch, yaw, roll, timestamp: Date.now() });
    
    // Mantener solo últimos 3 segundos
    const cutoff = Date.now() - 3000;
    this.poseHistory = this.poseHistory.filter(p => p.timestamp > cutoff);
    
    // Calcular estabilidad
    const stability = this.calculateStability();
    
    return { pitch, yaw, roll, stability };
  }
  
  private calculateYaw(
    leftEye: { x: number; y: number },
    rightEye: { x: number; y: number },
    noseTip: { x: number; y: number }
  ): number {
    // Calcular centro entre ojos
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };
    
    // Offset de la nariz respecto al centro
    const offset = noseTip.x - eyeCenter.x;
    
    // Normalizar a grados (-90 a 90)
    const yaw = offset * 180;
    
    return Math.max(-90, Math.min(90, yaw));
  }
  
  private calculatePitch(
    noseTip: { x: number; y: number },
    noseBridge: { x: number; y: number }
  ): number {
    // Offset vertical
    const offset = noseTip.y - noseBridge.y;
    
    // Normalizar a grados
    const pitch = offset * 180;
    
    return Math.max(-90, Math.min(90, pitch));
  }
  
  private calculateRoll(
    leftEye: { x: number; y: number },
    rightEye: { x: number; y: number }
  ): number {
    // Ángulo entre línea de ojos y horizontal
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    return Math.max(-90, Math.min(90, angle));
  }
  
  private calculateStability(): number {
    if (this.poseHistory.length < 10) return 0.5;
    
    const recent = this.poseHistory.slice(-30);
    
    // Calcular varianza de los ángulos
    const avgPitch = recent.reduce((sum, p) => sum + p.pitch, 0) / recent.length;
    const avgYaw = recent.reduce((sum, p) => sum + p.yaw, 0) / recent.length;
    const avgRoll = recent.reduce((sum, p) => sum + p.roll, 0) / recent.length;
    
    const variance =
      recent.reduce((sum, p) => {
        return (
          sum +
          Math.pow(p.pitch - avgPitch, 2) +
          Math.pow(p.yaw - avgYaw, 2) +
          Math.pow(p.roll - avgRoll, 2)
        );
      }, 0) / recent.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Mayor estabilidad = menor desviación
    const stability = Math.max(0, 1 - stdDev / 50);
    
    return stability;
  }
}
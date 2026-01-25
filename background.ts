import { Storage } from "@plasmohq/storage";

const storage = new Storage();

// Definimos el tipo de datos que almacenaremos globalmente
interface FocusState {
  score: number;        // Puntuación de Enfoque (0 a 100)
  stressLevel: number;  // Nivel de Estrés (0 a 100)
  emotion: string;
}

// ============================================
// CONFIGURACIÓN DEL SIDE PANEL
// ============================================

// Abrir side panel automáticamente cuando se hace click en el ícono
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error configurando Side Panel:', error));

// Listener para cuando se instala la extensión
chrome.runtime.onInstalled.addListener(() => {
  console.log('🧠 SYNAPSE UI instalado correctamente');
  
  // Inicializar estado por defecto
  storage.set("focusState", {
    score: 50,
    stressLevel: 20,
    emotion: "neutral"
  });
});

// ============================================
// ESCUCHAR MENSAJES DEL POPUP/SIDEPANEL
// ============================================

// Escuchamos mensajes que vienen desde el popup con los datos crudos de la IA
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "UPDATE_FOCUS_DATA" && request.data) {
    const { expressions, gazeX, gazeY, headPose, blinkRate, emotion } = request.data;

    // Calcular las nuevas métricas usando las funciones refinadas
    const newFocusScore = calculateFocusScore(gazeX, gazeY, expressions, headPose, blinkRate);
    const newStressLevel = calculateStressLevel(expressions);
    
    // Usar la emoción dominante que ya viene calculada del popup
    const dominantEmotion = emotion || Object.keys(expressions).reduce(
      (a, b) => expressions[a] > expressions[b] ? a : b
    );

    const state: FocusState = {
      score: newFocusScore,
      stressLevel: newStressLevel,
      emotion: dominantEmotion,
    };

    // Guardamos el estado globalmente para que todos los scripts lo lean
    storage.set("focusState", state).then(() => {
      console.log('📊 Estado actualizado:', state);
      
      // Enviamos el nuevo estado a TODAS las pestañas abiertas para que actualicen su UI
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { 
              type: "STATE_UPDATED", 
              state: state 
            }).catch(() => {
              // Ignorar errores de pestañas que no tienen content script
            });
          }
        });
      });
      
      sendResponse({ status: "State updated", state });
    });

    return true; // Mantener el canal abierto para respuesta asíncrona
  }

  // Comando para obtener el estado actual
  if (request.type === "GET_FOCUS_STATE") {
    storage.get("focusState").then((state) => {
      sendResponse({ state });
    });
    return true;
  }
});

// ============================================
// LÓGICA REFINADA PARA CALCULAR MÉTRICAS
// ============================================

/**
 * Función para calcular el Focus Score
 * Basado en: mirada estable, postura de cabeza, expresiones, parpadeo
 */
function calculateFocusScore(
  gazeX: number, 
  gazeY: number, 
  expressions: any,
  headPose?: { yaw: number; pitch: number; roll: number },
  blinkRate?: number
): number {
  // Peso emocional (neutral + happy = mejor foco)
  const emotionalWeight = (expressions.neutral + expressions.happy) * 0.5;

  // Estabilidad de la mirada
  const screenWidth = typeof window !== 'undefined' ? window.screen.width : 1920;
  const screenHeight = typeof window !== 'undefined' ? window.screen.height : 1080;
  
  const isGazeReasonable = 
    gazeX > screenWidth * 0.2 && 
    gazeX < screenWidth * 0.8 &&
    gazeY > screenHeight * 0.1 && 
    gazeY < screenHeight * 0.9;

  // Alineación de la cabeza (si está disponible)
  let headAlignment = 1;
  if (headPose) {
    const yawPenalty = Math.abs(headPose.yaw) / 45; // 45° = máximo
    const pitchPenalty = Math.abs(headPose.pitch) / 30; // 30° = máximo
    headAlignment = Math.max(0, 1 - (yawPenalty + pitchPenalty) / 2);
  }

  // Factor de parpadeo (ritmo normal = buen foco)
  let blinkFactor = 1;
  if (blinkRate !== undefined) {
    // Rango ideal: 10-25 parpadeos por minuto
    blinkFactor = (blinkRate > 10 && blinkRate < 25) ? 1 : 0.7;
  }

  // Cálculo del score
  let score = 0;

  if (isGazeReasonable && expressions.neutral > 0.4) {
    // Foco alto: mirada centrada + expresión neutral
    score = 70 + (emotionalWeight * 30);
  } else if (expressions.angry > 0.2 || expressions.sad > 0.2) {
    // Foco bajo: emociones negativas
    score = 10 + (emotionalWeight * 20);
  } else {
    // Estado intermedio
    score = 40 + (emotionalWeight * 20);
  }

  // Aplicar factores de cabeza y parpadeo
  score = score * headAlignment * blinkFactor;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Función para calcular el Nivel de Estrés/Carga Cognitiva
 * Basado en emociones negativas vs positivas
 */
function calculateStressLevel(expressions: any): number {
  // Emociones negativas aumentan estrés
  const negativeEmotions = 
    expressions.angry + 
    expressions.sad + 
    expressions.surprised;

  // Emociones positivas reducen estrés
  const positiveEmotions = 
    expressions.happy + 
    expressions.neutral;

  // Cálculo del estrés
  const stress = negativeEmotions - (positiveEmotions * 0.5);

  // Escalar a rango 0-100
  const level = (stress + 1) * 50; // Rango teórico de -1 a 1

  return Math.round(Math.min(100, Math.max(0, level)));
}

// ============================================
// FUNCIÓN EXPORTABLE PARA LEER ESTADO
// ============================================

/**
 * Función para leer el estado actual desde el storage
 * Útil para el popup/sidepanel al abrirse
 */
export const getFocusState = async (): Promise<FocusState> => {
  return await storage.get("focusState");
};

// ============================================
// MANTENER SERVICE WORKER VIVO
// ============================================

// Ping cada 20 segundos para mantener el service worker activo
setInterval(() => {
  chrome.runtime.getPlatformInfo(() => {
    // Solo necesitamos ejecutar algo para mantenerlo vivo
  });
}, 20000);

console.log('🧠 SYNAPSE UI Background Script iniciado');

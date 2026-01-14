import { Storage } from "@plasmohq/storage";

const storage = new Storage();

// Definimos el tipo de datos que almacenaremos globalmente
interface FocusState {
    score: number;      // Puntuación de Enfoque (0 a 100)
    stressLevel: number; // Nivel de Estrés (0 a 100)
    emotion: string;
}

// Escuchamos mensajes que vienen desde el popup con los datos crudos de la IA
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.type === "UPDATE_FOCUS_DATA" && request.data) {
        const { expressions, gazeX, gazeY } = request.data;
        
        // Calcular las nuevas métricas usando las funciones refinadas
        const newFocusScore = calculateFocusScore(gazeX, gazeY, expressions);
        const newStressLevel = calculateStressLevel(expressions);
        const dominantEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);

        const state: FocusState = {
            score: newFocusScore,
            stressLevel: newStressLevel,
            emotion: dominantEmotion,
        };

        // Guardamos el estado globalmente para que todos los scripts lo lean
        await storage.set("focusState", state);

        // Enviamos el nuevo estado a TODAS las pestañas abiertas para que actualicen su UI
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.id) {
                    chrome.tabs.sendMessage(tab.id, { type: "STATE_UPDATED", state: state });
                }
            });
        });

        sendResponse({ status: "State updated" });
    }
});


// --- Lógica Refinada para Calcular Métricas ---

// Función para calcular el Focus Score (Principalmente basado en la mirada estable)
function calculateFocusScore(gazeX: number, gazeY: number, expressions: any): number {
    // Asumimos que una mirada estable y centralizada indica foco.
    // Los valores de gazeX/Y dependen de la resolución del monitor del usuario.
    // Esto es heurístico.
    
    // Un enfoque neutral o feliz suele ser mejor que estar enojado o triste.
    const emotionalWeight = (expressions.neutral + expressions.happy) * 0.5;
    
    // Simplificamos la lógica de estabilidad de mirada por ahora (idealmente se mide varianza en el tiempo)
    // Simulación: Si la mirada está en un rango "razonable" del centro de la pantalla
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;

    const isGazeReasonable = gazeX > screenWidth * 0.2 && gazeX < screenWidth * 0.8 &&
                             gazeY > screenHeight * 0.1 && gazeY < screenHeight * 0.9;

    let score = 0;
    if (isGazeReasonable && expressions.neutral > 0.4) {
        score = 70 + (emotionalWeight * 30); // Foco alto
    } else if (expressions.angry > 0.2 || expressions.sad > 0.2) {
        score = 10 + (emotionalWeight * 20); // Foco bajo si hay emoción negativa
    } else {
        score = 40; // Estado por defecto
    }

    return Math.round(Math.min(100, Math.max(0, score)));
}

// Función para calcular el Nivel de Estrés/Carga Cognitiva
function calculateStressLevel(expressions: any): number {
    // El enojo, la tristeza y la sorpresa (shock/sobrecarga) aumentan el estrés.
    const negativeEmotions = expressions.angry + expressions.sad + expressions.surprised;
    
    // El nivel de estrés es inversamente proporcional a la neutralidad/felicidad.
    const stress = negativeEmotions - expressions.happy - expressions.neutral;
    
    // Escalar el valor a un rango de 0 a 100
    const level = (stress + 1) * 50; // Rango teórico de -1 a 1

    return Math.round(Math.min(100, Math.max(0, level)));
}


// Función para leer el estado actual desde el storage (útil para el popup al abrirse)
export const getFocusState = async (): Promise<FocusState> => {
    return await storage.get("focusState");
};

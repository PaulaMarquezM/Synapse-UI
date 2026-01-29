import { supabase } from './supabase';

export interface SessionMetrics {
  focus: number;
  stress: number;
  fatigue: number;
  distraction: number;
  dominantState: 'focus' | 'stress' | 'fatigue' | 'distraction' | 'neutral';
  confidence: number; // 0-1
}

export interface SessionSummary {
  sessionId: string;
  duration: number; // segundos
  avgFocus: number;
  avgStress: number;
  avgFatigue: number;
  avgDistraction: number;
  pctFocused: number;
  pctDistracted: number;
  pctStressed: number;
  pctTired: number;
  interruptions: number;
  focusPeriods: number;
  dominantState: string;
  avgConfidence: number;
  effectiveness: number; // 0-100
}

export class SessionManager {
  private sessionId: string | null = null;
  private startTime: Date | null = null;
  private metricsHistory: SessionMetrics[] = [];
  
  // Contadores en tiempo real
  private interruptionCount = 0;
  private focusPeriodCount = 0;
  private lastState: string | null = null;
  private consecutiveFocusCount = 0;

  /**
   * Inicia una nueva sesión de trabajo
   */
  async startSession(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('work_sessions')
      .insert({
        user_id: user.id,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    this.sessionId = data.id;
    this.startTime = new Date();
    this.metricsHistory = [];
    this.interruptionCount = 0;
    this.focusPeriodCount = 0;
    this.lastState = null;
    this.consecutiveFocusCount = 0;

    console.log(`✅ Sesión iniciada: ${data.id}`);
    return data.id;
  }

  /**
   * Registra métricas en tiempo real (llamar cada 1-2 segundos desde el engine)
   */
  recordMetrics(metrics: SessionMetrics) {
    if (!this.sessionId) return;

    this.metricsHistory.push(metrics);

    // Detectar interrupciones (cambio de foco a distracción)
    if (this.lastState === 'focus' && metrics.dominantState === 'distraction') {
      this.interruptionCount++;
      console.log(`⚠️ Interrupción detectada (#${this.interruptionCount})`);
    }

    // Contar períodos de foco (30 segundos consecutivos en foco)
    if (metrics.dominantState === 'focus') {
      this.consecutiveFocusCount++;
      if (this.consecutiveFocusCount >= 15) { // 30 segundos (asumiendo 1 llamada cada 2 seg)
        this.focusPeriodCount++;
        this.consecutiveFocusCount = 0; // Reset
        console.log(`🎯 Período de foco completado (#${this.focusPeriodCount})`);
      }
    } else {
      this.consecutiveFocusCount = 0;
    }

    this.lastState = metrics.dominantState;

    // Limitar historial a últimos 5 minutos (150 registros a 1 cada 2 seg)
    if (this.metricsHistory.length > 150) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Finaliza la sesión y guarda estadísticas
   */
  async endSession(): Promise<SessionSummary> {
    if (!this.sessionId || !this.startTime) {
      throw new Error('No hay sesión activa');
    }

    if (this.metricsHistory.length === 0) {
      throw new Error('No hay datos registrados en esta sesión');
    }

    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - this.startTime.getTime()) / 1000);

    // Calcular promedios
    const avgFocus = this.average(this.metricsHistory.map(m => m.focus));
    const avgStress = this.average(this.metricsHistory.map(m => m.stress));
    const avgFatigue = this.average(this.metricsHistory.map(m => m.fatigue));
    const avgDistraction = this.average(this.metricsHistory.map(m => m.distraction));
    const avgConfidence = this.average(this.metricsHistory.map(m => m.confidence));

    // Calcular porcentajes de tiempo en cada estado
    const stateCounts = this.countStates(this.metricsHistory.map(m => m.dominantState));
    const total = this.metricsHistory.length;

    const pctFocused = ((stateCounts.focus || 0) / total) * 100;
    const pctDistracted = ((stateCounts.distraction || 0) / total) * 100;
    const pctStressed = ((stateCounts.stress || 0) / total) * 100;
    const pctTired = ((stateCounts.fatigue || 0) / total) * 100;

    // Determinar estado dominante
    const dominantState = Object.entries(stateCounts)
      .sort(([, a], [, b]) => b - a)[0][0] as string;

    // Calcular efectividad (fórmula personalizada)
    const effectiveness = this.calculateEffectiveness(
      pctFocused, 
      this.interruptionCount, 
      avgConfidence
    );

    // Actualizar sesión en Supabase
    const { error } = await supabase
      .from('work_sessions')
      .update({
        ended_at: endTime.toISOString(),
        duration_seconds: durationSeconds,
        avg_focus: Math.round(avgFocus),
        avg_stress: Math.round(avgStress),
        avg_fatigue: Math.round(avgFatigue),
        avg_distraction: Math.round(avgDistraction),
        pct_focused: parseFloat(pctFocused.toFixed(2)),
        pct_distracted: parseFloat(pctDistracted.toFixed(2)),
        pct_stressed: parseFloat(pctStressed.toFixed(2)),
        pct_tired: parseFloat(pctTired.toFixed(2)),
        interruptions: this.interruptionCount,
        focus_periods: this.focusPeriodCount,
        dominant_state: dominantState,
        avg_confidence: parseFloat(avgConfidence.toFixed(2)),
        updated_at: new Date().toISOString()
      })
      .eq('id', this.sessionId);

    if (error) throw error;

    const summary: SessionSummary = {
      sessionId: this.sessionId,
      duration: durationSeconds,
      avgFocus,
      avgStress,
      avgFatigue,
      avgDistraction,
      pctFocused,
      pctDistracted,
      pctStressed,
      pctTired,
      interruptions: this.interruptionCount,
      focusPeriods: this.focusPeriodCount,
      dominantState,
      avgConfidence,
      effectiveness
    };

    console.log('📊 Sesión finalizada:', summary);
    this.reset();
    return summary;
  }

  /**
   * Obtener estado actual de la sesión
   */
  getSessionStatus() {
    if (!this.sessionId || !this.startTime) return null;

    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    return {
      sessionId: this.sessionId,
      elapsedSeconds,
      interruptions: this.interruptionCount,
      focusPeriods: this.focusPeriodCount,
      isActive: true
    };
  }

  // Métodos auxiliares
  private average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private countStates(states: string[]): Record<string, number> {
    return states.reduce((acc, state) => {
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Fórmula de efectividad:
   * - 60% peso al porcentaje de foco
   * - 20% penalización por interrupciones
   * - 20% bonificación por confianza del modelo
   */
  private calculateEffectiveness(
    focusPercentage: number, 
    interruptions: number, 
    confidence: number
  ): number {
    const focusScore = focusPercentage * 0.6;
    const interruptionPenalty = Math.min(interruptions * 3, 20);
    const confidenceBonus = confidence * 100 * 0.2;
    
    return Math.max(0, Math.min(100, focusScore - interruptionPenalty + confidenceBonus));
  }

  private reset() {
    this.sessionId = null;
    this.startTime = null;
    this.metricsHistory = [];
    this.interruptionCount = 0;
    this.focusPeriodCount = 0;
    this.lastState = null;
    this.consecutiveFocusCount = 0;
  }

  /**
   * Pausar sesión (sin finalizar)
   */
  pause() {
    // Implementar si se necesita pausa/resume
  }

  /**
   * Reanudar sesión pausada
   */
  resume() {
    // Implementar si se necesita pausa/resume
  }
}

// Singleton para usar en toda la app
export const sessionManager = new SessionManager();
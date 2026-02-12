// src/lib/metricsSmoothing.ts

export type Level = "Bajo" | "Normal" | "Alto"

export type Metrics = {
  focus: number
  stress: number
  fatigue: number
  distraction: number
}

export type MetricsLevels = {
  focus: Level
  stress: Level
  fatigue: Level
  distraction: Level
}

export type SmoothingConfig = {
  alpha: number // EMA, 0..1 (más bajo = más estable)
  maxDeltaPerTick: number // límite de cambio por update
  clampMin?: number
  clampMax?: number
  fatigueRiseAlpha?: number // EMA when fatigue is rising (default: 0.45)
  fatigueRiseMaxDelta?: number // max delta when fatigue rising (default: 18)
  fatigueDecayAlpha?: number // EMA when fatigue is falling (default: 0.06)
  fatigueDecayMaxDelta?: number // max delta when fatigue falling (default: 3)
  thresholds?: {
    focus: { low: number; high: number }
    stress: { low: number; high: number }
    fatigue: { low: number; high: number }
    distraction: { low: number; high: number }
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const smoothEMA = (prev: number, next: number, alpha: number) => prev + alpha * (next - prev)

const limitDelta = (prev: number, next: number, maxDelta: number) => {
  const delta = next - prev
  if (Math.abs(delta) <= maxDelta) return next
  return prev + Math.sign(delta) * maxDelta
}

const toLevel = (value: number, low: number, high: number): Level => {
  if (value < low) return "Bajo"
  if (value >= high) return "Alto"
  return "Normal"
}

export const defaultThresholds: NonNullable<SmoothingConfig["thresholds"]> = {
  focus: { low: 45, high: 75 },
  stress: { low: 35, high: 65 },
  fatigue: { low: 35, high: 70 },
  distraction: { low: 45, high: 75 }
}

export const defaultSmoothingConfig: SmoothingConfig = {
  alpha: 0.12,
  maxDeltaPerTick: 5,
  clampMin: 0,
  clampMax: 100,
  fatigueRiseAlpha: 0.45,
  fatigueRiseMaxDelta: 18,
  fatigueDecayAlpha: 0.06,
  fatigueDecayMaxDelta: 3,
  thresholds: defaultThresholds
}

export type MetricsSmoother = {
  update: (raw: Metrics) => { smoothed: Metrics; levels: MetricsLevels }
  get: () => { smoothed: Metrics; levels: MetricsLevels }
  reset: (initial?: Partial<Metrics>) => void
}

export const createMetricsSmoother = (
  initial: Metrics,
  config: SmoothingConfig = defaultSmoothingConfig
): MetricsSmoother => {
  const clampMin = config.clampMin ?? 0
  const clampMax = config.clampMax ?? 100
  const thresholds = config.thresholds ?? defaultThresholds

  let state: Metrics = {
    focus: clamp(initial.focus, clampMin, clampMax),
    stress: clamp(initial.stress, clampMin, clampMax),
    fatigue: clamp(initial.fatigue, clampMin, clampMax),
    distraction: clamp(initial.distraction, clampMin, clampMax)
  }

  const computeLevels = (m: Metrics): MetricsLevels => ({
    focus: toLevel(m.focus, thresholds.focus.low, thresholds.focus.high),
    stress: toLevel(m.stress, thresholds.stress.low, thresholds.stress.high),
    fatigue: toLevel(m.fatigue, thresholds.fatigue.low, thresholds.fatigue.high),
    distraction: toLevel(m.distraction, thresholds.distraction.low, thresholds.distraction.high)
  })

  const fatigueRiseAlpha = config.fatigueRiseAlpha ?? 0.45
  const fatigueRiseMaxDelta = config.fatigueRiseMaxDelta ?? 18
  const fatigueDecayAlpha = config.fatigueDecayAlpha ?? 0.06
  const fatigueDecayMaxDelta = config.fatigueDecayMaxDelta ?? 3

  const apply = (prev: number, raw: number) => {
    const ema = smoothEMA(prev, raw, config.alpha)
    const limited = limitDelta(prev, ema, config.maxDeltaPerTick)
    return clamp(Math.round(limited), clampMin, clampMax)
  }

  const applyFatigue = (prev: number, raw: number) => {
    const rising = raw > prev
    const a = rising ? fatigueRiseAlpha : fatigueDecayAlpha
    const md = rising ? fatigueRiseMaxDelta : fatigueDecayMaxDelta
    const ema = smoothEMA(prev, raw, a)
    const limited = limitDelta(prev, ema, md)
    return clamp(Math.round(limited), clampMin, clampMax)
  }

  return {
    update(raw: Metrics) {
      state = {
        focus: apply(state.focus, raw.focus),
        stress: apply(state.stress, raw.stress),
        fatigue: applyFatigue(state.fatigue, raw.fatigue),
        distraction: apply(state.distraction, raw.distraction)
      }
      const levels = computeLevels(state)
      return { smoothed: { ...state }, levels }
    },
    get() {
      const levels = computeLevels(state)
      return { smoothed: { ...state }, levels }
    },
    reset(initialOverride?: Partial<Metrics>) {
      state = {
        focus: clamp(initialOverride?.focus ?? state.focus, clampMin, clampMax),
        stress: clamp(initialOverride?.stress ?? state.stress, clampMin, clampMax),
        fatigue: clamp(initialOverride?.fatigue ?? state.fatigue, clampMin, clampMax),
        distraction: clamp(initialOverride?.distraction ?? state.distraction, clampMin, clampMax)
      }
    }
  }
}

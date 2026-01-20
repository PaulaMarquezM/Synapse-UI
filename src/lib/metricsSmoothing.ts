// src/lib/metricsSmoothing.ts

export type Level = "Bajo" | "Normal" | "Alto"

export type Metrics = {
  focus: number
  stress: number
  alert: number
}

export type MetricsLevels = {
  focus: Level
  stress: Level
  alert: Level
}

export type SmoothingConfig = {
  alpha: number // EMA, 0..1 (más bajo = más estable)
  maxDeltaPerTick: number // límite de cambio por update
  clampMin?: number
  clampMax?: number
  thresholds?: {
    focus: { low: number; high: number }
    stress: { low: number; high: number }
    alert: { low: number; high: number }
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
  alert: { low: 35, high: 70 }
}

export const defaultSmoothingConfig: SmoothingConfig = {
  alpha: 0.12,
  maxDeltaPerTick: 5,
  clampMin: 0,
  clampMax: 100,
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
    alert: clamp(initial.alert, clampMin, clampMax)
  }

  const computeLevels = (m: Metrics): MetricsLevels => ({
    focus: toLevel(m.focus, thresholds.focus.low, thresholds.focus.high),
    stress: toLevel(m.stress, thresholds.stress.low, thresholds.stress.high),
    alert: toLevel(m.alert, thresholds.alert.low, thresholds.alert.high)
  })

  const apply = (prev: number, raw: number) => {
    const ema = smoothEMA(prev, raw, config.alpha)
    const limited = limitDelta(prev, ema, config.maxDeltaPerTick)
    return clamp(Math.round(limited), clampMin, clampMax)
  }

  return {
    update(raw: Metrics) {
      state = {
        focus: apply(state.focus, raw.focus),
        stress: apply(state.stress, raw.stress),
        alert: apply(state.alert, raw.alert)
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
        alert: clamp(initialOverride?.alert ?? state.alert, clampMin, clampMax)
      }
    }
  }
}

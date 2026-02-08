import React, { useMemo } from "react"
import type { SessionRow } from "~components/dashboard/SessionsTable"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts"

type DataHealthPanelProps = {
  sessions: SessionRow[]
  loading: boolean
}

type DailyHealthPoint = {
  day: string
  completas: number
  incompletas: number
  invalidas: number
}

type NullFieldPoint = {
  field: string
  missing: number
}

const cardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)"
}

const isMissing = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim().length === 0)

const inRange = (value: number | null, min: number, max: number) =>
  value === null || (value >= min && value <= max)

const parseTs = (iso?: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const dayKeyFromIso = (iso?: string | null) => {
  const date = parseTs(iso)
  if (!date) return "sin-fecha"
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const PIE_COLORS = ["#60a5fa", "#22c55e", "#fbbf24", "#f97316", "#ef4444", "#a78bfa", "#94a3b8"]

const DataHealthPanel: React.FC<DataHealthPanelProps> = ({ sessions, loading }) => {
  const stats = useMemo(() => {
    const completed = sessions.filter(
      (s) => !isMissing(s.ended_at) && s.duration_seconds !== null && s.duration_seconds > 0
    ).length

    const invalidTimeline = sessions.filter((s) => {
      const started = parseTs(s.started_at)
      const ended = parseTs(s.ended_at)
      if (started && ended && ended.getTime() < started.getTime()) return true
      if (s.duration_seconds !== null && s.duration_seconds < 0) return true
      return false
    }).length

    const outOfRange = sessions.filter((s) => {
      return !(
        inRange(s.avg_focus, 0, 100) &&
        inRange(s.avg_stress, 0, 100) &&
        inRange(s.avg_fatigue, 0, 100) &&
        inRange(s.avg_distraction, 0, 100) &&
        inRange(s.pct_focused, 0, 100) &&
        inRange(s.pct_distracted, 0, 100) &&
        inRange(s.pct_stressed, 0, 100) &&
        inRange(s.pct_tired, 0, 100) &&
        inRange(s.avg_confidence, 0, 1)
      )
    }).length

    const pending = sessions.length - completed

    const qualityScore =
      sessions.length === 0
        ? 0
        : Math.max(
            0,
            Math.round(
              ((sessions.length - invalidTimeline - outOfRange - Math.floor(pending * 0.4)) /
                sessions.length) *
                100
            )
          )

    return {
      total: sessions.length,
      completed,
      pending,
      invalidTimeline,
      outOfRange,
      qualityScore
    }
  }, [sessions])

  const dailyHealth = useMemo<DailyHealthPoint[]>(() => {
    const map = new Map<string, DailyHealthPoint>()

    for (const s of sessions) {
      const day = dayKeyFromIso(s.started_at)
      if (!map.has(day)) {
        map.set(day, { day, completas: 0, incompletas: 0, invalidas: 0 })
      }

      const current = map.get(day)!
      const complete = !isMissing(s.ended_at) && s.duration_seconds !== null && s.duration_seconds > 0
      const started = parseTs(s.started_at)
      const ended = parseTs(s.ended_at)
      const invalid =
        (started && ended && ended.getTime() < started.getTime()) ||
        (s.duration_seconds !== null && s.duration_seconds < 0)

      if (complete) current.completas += 1
      else current.incompletas += 1
      if (invalid) current.invalidas += 1
    }

    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day))
  }, [sessions])

  const nullFieldData = useMemo<NullFieldPoint[]>(() => {
    const fields: Array<{ key: keyof SessionRow; label: string }> = [
      { key: "ended_at", label: "Sin fin" },
      { key: "duration_seconds", label: "Sin duración" },
      { key: "avg_focus", label: "Sin foco" },
      { key: "avg_stress", label: "Sin estrés" },
      { key: "avg_fatigue", label: "Sin fatiga" },
      { key: "avg_distraction", label: "Sin distracción" },
      { key: "dominant_state", label: "Sin dominante" },
      { key: "avg_confidence", label: "Sin confianza" }
    ]

    return fields.map((field) => ({
      field: field.label,
      missing: sessions.filter((s) => isMissing(s[field.key])).length
    }))
  }, [sessions])

  const dominantStateData = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const s of sessions) {
      const key = s.dominant_state || "sin_dato"
      countMap.set(key, (countMap.get(key) || 0) + 1)
    }
    return [...countMap.entries()].map(([name, value]) => ({ name, value }))
  }, [sessions])

  const qualityLabel =
    stats.qualityScore >= 85 ? "Alta" : stats.qualityScore >= 60 ? "Media" : "Baja"
  const qualityColor =
    stats.qualityScore >= 85 ? "#4ade80" : stats.qualityScore >= 60 ? "#fbbf24" : "#f87171"

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
        Validación de calidad de datos guardados en Supabase.
      </div>

      <div
        style={{
          ...cardStyle,
          marginBottom: 16,
          background: "linear-gradient(180deg, rgba(30, 64, 175, 0.14), rgba(14, 23, 42, 0.5))"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Cómo leer esta vista</div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: qualityColor,
              background: `${qualityColor}22`,
              border: `1px solid ${qualityColor}44`,
              borderRadius: 999,
              padding: "4px 10px"
            }}
          >
            Calidad actual: {qualityLabel}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 10,
            fontSize: 12
          }}
        >
          <div style={{ color: "#cbd5e1" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>KPIs superiores</div>
            <div>Calidad DB: salud general del dataset (ideal mayor o igual a 85%).</div>
            <div>Completas: sesiones cerradas correctamente.</div>
            <div>Incompletas: sesiones sin cierre o sin duración.</div>
            <div>Inválidas: tiempos incoherentes (ej. fin antes de inicio).</div>
            <div>Fuera de rango: métricas fuera de valores esperados.</div>
          </div>

          <div style={{ color: "#cbd5e1" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Gráficas inferiores</div>
            <div>Estado por día: muestra tendencia diaria de calidad.</div>
            <div>Nulos por tipo: indica qué campos faltan con mayor frecuencia.</div>
            <div>Estado dominante: distribución de resultados cognitivos guardados.</div>
            <div style={{ marginTop: 4, color: "#94a3b8" }}>
              Referencia rápida: verde = bueno, amarillo = revisar, rojo = corregir.
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Calidad DB</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats.qualityScore >= 80 ? "#4ade80" : "#fbbf24" }}>
            {stats.qualityScore}%
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Sesiones completas</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.completed}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Sesiones incompletas</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats.pending > 0 ? "#fbbf24" : "white" }}>
            {stats.pending}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Filas inválidas</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats.invalidTimeline > 0 ? "#f87171" : "white" }}>
            {stats.invalidTimeline}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Campos fuera de rango</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats.outOfRange > 0 ? "#f87171" : "white" }}>
            {stats.outOfRange}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          marginBottom: 16
        }}
      >
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Estado de sesiones por día</div>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={dailyHealth}>
              <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="4 4" />
              <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 12
                }}
              />
              <Legend />
              <Bar dataKey="completas" fill="#22c55e" />
              <Bar dataKey="incompletas" fill="#fbbf24" />
              <Bar dataKey="invalidas" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Campos nulos por tipo</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={nullFieldData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="4 4" />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="field" stroke="#94a3b8" tick={{ fontSize: 11 }} width={95} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "white",
                    fontSize: 12
                  }}
                />
                <Bar dataKey="missing" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Distribución estado dominante</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={dominantStateData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {dominantStateData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "white",
                    fontSize: 12
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ marginTop: 12, color: "#93c5fd", fontSize: 12 }}>
          Actualizando datos...
        </div>
      )}
    </div>
  )
}

export default DataHealthPanel

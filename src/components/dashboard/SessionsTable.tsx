import React from "react"
import { formatDate, formatDuration } from "~lib/dashboardUtils"

export type SessionRow = {
  id: string
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  avg_focus: number | null
  avg_stress: number | null
  avg_fatigue: number | null
  avg_distraction: number | null
  pct_focused: number | null
  pct_distracted: number | null
  pct_stressed: number | null
  pct_tired: number | null
  interruptions: number | null
  focus_periods: number | null
  dominant_state: string | null
  avg_confidence: number | null
}

type SessionsTableProps = {
  sessions: SessionRow[]
  loading: boolean
  onSelect: (session: SessionRow) => void
}

const SessionsTable: React.FC<SessionsTableProps> = ({ sessions, loading, onSelect }) => {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#94a3b8" }}>
            <th style={{ padding: "10px 8px" }}>Inicio</th>
            <th style={{ padding: "10px 8px" }}>Duracion</th>
            <th style={{ padding: "10px 8px" }}>Foco</th>
            <th style={{ padding: "10px 8px" }}>Estres</th>
            <th style={{ padding: "10px 8px" }}>Fatiga</th>
            <th style={{ padding: "10px 8px" }}>Distraccion</th>
            <th style={{ padding: "10px 8px" }}>Dominante</th>
            <th style={{ padding: "10px 8px" }}>Interrupciones</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.id}
              onClick={() => onSelect(s)}
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer"
              }}
            >
              <td style={{ padding: "10px 8px" }}>{formatDate(s.started_at)}</td>
              <td style={{ padding: "10px 8px" }}>{formatDuration(s.duration_seconds)}</td>
              <td style={{ padding: "10px 8px" }}>{Math.round(s.avg_focus || 0)}</td>
              <td style={{ padding: "10px 8px" }}>{Math.round(s.avg_stress || 0)}</td>
              <td style={{ padding: "10px 8px" }}>{Math.round(s.avg_fatigue || 0)}</td>
              <td style={{ padding: "10px 8px" }}>{Math.round(s.avg_distraction || 0)}</td>
              <td style={{ padding: "10px 8px" }}>{s.dominant_state || "-"}</td>
              <td style={{ padding: "10px 8px" }}>{s.interruptions ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sessions.length === 0 && !loading && (
        <div style={{ marginTop: 12, color: "#94a3b8" }}>
          Aun no hay sesiones guardadas.
        </div>
      )}
    </div>
  )
}

export default SessionsTable

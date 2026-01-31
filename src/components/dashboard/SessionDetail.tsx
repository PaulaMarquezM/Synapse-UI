import React from "react"
import type { SessionRow } from "~components/dashboard/SessionsTable"
import { formatDate, formatDuration } from "~lib/dashboardUtils"

type SessionDetailProps = {
  session: SessionRow
}

const SessionDetail: React.FC<SessionDetailProps> = ({ session }) => {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)"
      }}
    >
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
        Detalle de sesion
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontSize: 12 }}>
        <div>Inicio: {formatDate(session.started_at)}</div>
        <div>Duracion: {formatDuration(session.duration_seconds)}</div>
        <div>Foco: {Math.round(session.avg_focus || 0)}</div>
        <div>Estres: {Math.round(session.avg_stress || 0)}</div>
        <div>Fatiga: {Math.round(session.avg_fatigue || 0)}</div>
        <div>Distraccion: {Math.round(session.avg_distraction || 0)}</div>
        <div>Dominante: {session.dominant_state || "-"}</div>
        <div>Interrupciones: {session.interruptions ?? 0}</div>
        <div>Confianza: {Math.round((session.avg_confidence || 0) * 100)}%</div>
      </div>
    </div>
  )
}

export default SessionDetail

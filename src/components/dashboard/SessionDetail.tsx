import React from "react"
import type { SessionRow } from "~components/dashboard/SessionsTable"
import { formatDate, formatDuration } from "~lib/dashboardUtils"

type SessionDetailProps = {
  session: SessionRow
}

const stateLabels: Record<string, string> = {
  deep_focus: "Foco profundo",
  focus: "Enfocado",
  normal: "Normal",
  distracted: "Distraido",
  stressed: "Estresado",
  tired: "Cansado",
  drowsy: "Somnoliento"
}

const MetricRow = ({ label, value, desc, color }: { label: string; value: string | number; desc: string; color?: string }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: color || "#e2e8f0" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{value}</span>
    </div>
    <p style={{ fontSize: 10, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>{desc}</p>
  </div>
)

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
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
        Detalle de sesion
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 12 }}>
        {formatDate(session.started_at)} &bull; Duracion: {formatDuration(session.duration_seconds)}
      </div>

      <MetricRow
        label="Enfoque"
        value={Math.round(session.avg_focus || 0)}
        desc="Promedio de concentracion en pantalla durante la sesion."
        color="#60a5fa"
      />
      <MetricRow
        label="Estres"
        value={Math.round(session.avg_stress || 0)}
        desc="Nivel de tension detectado por expresiones faciales negativas."
        color="#f87171"
      />
      <MetricRow
        label="Fatiga"
        value={Math.round(session.avg_fatigue || 0)}
        desc="Cansancio ocular medido por cierre de ojos y parpadeos lentos."
        color="#fbbf24"
      />
      <MetricRow
        label="Distraccion"
        value={Math.round(session.avg_distraction || 0)}
        desc="Inverso del enfoque. Sube al mirar fuera de pantalla o al celular."
        color="#a855f7"
      />

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, marginTop: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontSize: 11, color: "#94a3b8" }}>
          <div>
            <span style={{ color: "#64748b" }}>Estado dominante: </span>
            {stateLabels[session.dominant_state || ""] || session.dominant_state || "-"}
          </div>
          <div>
            <span style={{ color: "#64748b" }}>Interrupciones: </span>
            {session.interruptions ?? 0}
          </div>
          <div>
            <span style={{ color: "#64748b" }}>Periodos de foco: </span>
            {session.focus_periods ?? 0}
          </div>
          <div>
            <span style={{ color: "#64748b" }}>Confianza IA: </span>
            {Math.round((session.avg_confidence || 0) * 100)}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default SessionDetail

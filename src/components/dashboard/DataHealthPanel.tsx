import React from "react"
import type { SessionRow } from "~components/dashboard/SessionsTable"

type DataHealthPanelProps = {
  sessions: SessionRow[]
  loading: boolean
}

type InfoCard = {
  title: string
  description: string
  details?: string[]
}

const shellStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)"
}

const tableCards: InfoCard[] = [
  {
    title: "work_sessions",
    description:
      "Tabla principal del sistema. Guarda cada sesion de estudio o trabajo por usuario.",
    details: [
      "Campos clave: user_id, started_at, ended_at, duration_seconds",
      "Metricas: avg_focus, avg_stress, avg_fatigue, avg_distraction",
      "Resumen: interruptions, focus_periods, dominant_state"
    ]
  },
  {
    title: "user_preferences",
    description:
      "Configuracion persistente por usuario para personalizar la experiencia.",
    details: [
      "Guarda ajustes por usuario autenticado",
      "Permite recuperar preferencias en cada sesion",
      "Se integra con el control de acceso por RLS"
    ]
  }
]

const viewCards: InfoCard[] = [
  {
    title: "daily_session_summary",
    description:
      "Vista analitica por dia para reportar sesiones totales y comportamiento diario.",
    details: [
      "Agrupa por usuario y fecha",
      "Facilita dashboards y seguimiento historico"
    ]
  },
  {
    title: "top_sessions",
    description:
      "Vista de rendimiento para identificar sesiones destacadas de enfoque.",
    details: [
      "Prioriza foco promedio y duracion",
      "Se usa para reportes y comparacion de resultados"
    ]
  }
]

const flowSteps = [
  {
    title: "1. Auth",
    text: "El usuario inicia sesion en Supabase Auth y recibe JWT con user_id."
  },
  {
    title: "2. Acceso seguro",
    text: "Cada consulta pasa por RLS para limitar lectura y escritura al dueño de la fila."
  },
  {
    title: "3. Registro de sesion",
    text: "La app inserta y actualiza work_sessions mientras corre la sesion cognitiva."
  },
  {
    title: "4. Analitica",
    text: "Las vistas resumen datos para el dashboard historico y exposicion de resultados."
  }
]

const securityCards: InfoCard[] = [
  {
    title: "Supabase Auth + JWT",
    description:
      "Identidad validada por token; el user_id viaja en cada solicitud autenticada."
  },
  {
    title: "Row Level Security (RLS)",
    description:
      "Aislamiento multiusuario: cada usuario accede solo a sus propias filas."
  },
  {
    title: "Politicas optimizadas",
    description:
      "Reglas RLS simplificadas para claridad, menor costo de evaluacion y menos conflictos."
  },
  {
    title: "Vistas seguras",
    description:
      "Las vistas respetan permisos del usuario para no saltarse las reglas de acceso."
  },
  {
    title: "Funciones PostgreSQL endurecidas",
    description:
      "Funciones internas con configuracion segura para evitar ejecucion en contextos no esperados."
  }
]

const improvements = [
  "Fortalecimiento de contrasenas y medidas anti credenciales filtradas",
  "Limpieza de indices innecesarios para mantener mejor rendimiento",
  "Ajustes de politicas RLS para mejor consistencia en consultas",
  "Refuerzo de funciones internas para reducir superficie de riesgo"
]

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{title}</div>
    {subtitle && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>}
  </div>
)

const CardGrid = ({ cards }: { cards: InfoCard[] }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 12
    }}
  >
    {cards.map((card) => (
      <div key={card.title} style={shellStyle}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd", marginBottom: 6 }}>
          {card.title}
        </div>
        <p style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>{card.description}</p>
        {card.details && card.details.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {card.details.map((detail) => (
              <div
                key={detail}
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: "rgba(148, 163, 184, 0.10)",
                  border: "1px solid rgba(148, 163, 184, 0.16)"
                }}
              >
                {detail}
              </div>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
)

const DataHealthPanel: React.FC<DataHealthPanelProps> = ({ sessions, loading }) => {
  return (
    <div>
      <div
        style={{
          ...shellStyle,
          marginBottom: 16,
          background: "linear-gradient(180deg, rgba(14, 165, 233, 0.16), rgba(15, 23, 42, 0.55))"
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: "#e2e8f0", marginBottom: 8 }}>
          Arquitectura de Base de Datos y Seguridad
        </div>
        <p style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.65 }}>
          Esta vista resume como usamos Supabase en SYNAPSE UI: estructura principal,
          flujo de uso en la app y medidas de seguridad para proteger los datos de cada usuario.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16
        }}
      >
        <div style={shellStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Tablas principales</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#4ade80" }}>2</div>
        </div>
        <div style={shellStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Vistas analiticas</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#60a5fa" }}>2</div>
        </div>
        <div style={shellStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Seguridad activa</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fbbf24" }}>Auth + RLS</div>
        </div>
        <div style={shellStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Sesiones en rango</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#a78bfa" }}>{sessions.length}</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SectionTitle
          title="Tablas del sistema"
          subtitle="Estructura base usada para registrar sesiones y configuracion por usuario"
        />
        <CardGrid cards={tableCards} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <SectionTitle
          title="Como usamos la base de datos"
          subtitle="Flujo simplificado desde autenticacion hasta analitica"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12
          }}
        >
          {flowSteps.map((step) => (
            <div key={step.title} style={shellStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd", marginBottom: 6 }}>
                {step.title}
              </div>
              <p style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SectionTitle
          title="Vistas para analitica"
          subtitle="Capas de consulta para dashboards y presentacion de resultados"
        />
        <CardGrid cards={viewCards} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <SectionTitle
          title="Seguridad implementada"
          subtitle="Controles aplicados para privacidad, aislamiento de datos y consistencia"
        />
        <CardGrid cards={securityCards} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <SectionTitle title="Mejoras aplicadas" subtitle="Resumen ejecutivo para exposicion" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 10
          }}
        >
          {improvements.map((item) => (
            <div
              key={item}
              style={{
                ...shellStyle,
                padding: "10px 12px",
                background: "rgba(74, 222, 128, 0.08)",
                border: "1px solid rgba(74, 222, 128, 0.24)",
                fontSize: 12,
                color: "#d1fae5"
              }}
            >
              {item}
            </div>
          ))}
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

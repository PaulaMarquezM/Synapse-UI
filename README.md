This is a [Plasmo extension](https://docs.plasmo.com/) project bootstrapped with [`plasmo init`](https://www.npmjs.com/package/plasmo).

## Getting Started

First, run the development server:

```bash
pnpm dev
# or
npm run dev
```

Open your browser and load the appropriate development build. For example, if you are developing for the chrome browser, using manifest v3, use: `build/chrome-mv3-dev`.

You can start editing the popup by modifying `popup.tsx`. It should auto-update as you make changes. To add an options page, simply add a `options.tsx` file to the root of the project, with a react component default exported. Likewise to add a content page, add a `content.ts` file to the root of the project, importing some module and do some logic, then reload the extension on your browser.

For further guidance, [visit our Documentation](https://docs.plasmo.com/)

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension, ready to be zipped and published to the stores.

## Submit to the webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!


[CameraFeed (face-api.js)]
   |
   | DetectionData (expresiones, gaze, pose, blink)
   v
[Sidepanel UI]
   |
   | + Calibracion (baseline)
   | + Smoothing
   | + Cognitive thresholds
   v
[Estado Cognitivo]
   |         \
   |          \--> [Nudges + Sonido + Badge de Atencion]
   |
   v
[SessionControl] --(registro periodico)--> [SessionManager]
                                          |
                                          v
                                    [Supabase DB]
                                          |
                                          v
                               [Dashboard Historico]


# SYNAPSE UI – README Tecnico

## Descripcion
SYNAPSE UI es una extension de navegador (Plasmo, MV3) que analiza señales faciales en tiempo real para inferir estados cognitivos: foco, estres y fatiga/alerta. 
El objetivo integra dos materias: Interaccion Humano-Computadora (IHC) y Base de Datos en la Nube.

---

## Arquitectura General

Entrypoints principales:
- `background.ts`: service worker, gestiona estado global.
- `src/sidepanel.tsx`: UI principal del usuario.
- `content-siderbar.tsx`: inyeccion de sidebar en paginas.
- `contents/injector.ts`: efectos visuales (Aura).
- `sidepanel.html?view=dashboard`: dashboard historico.

---

## Flujo de datos

1. `CameraFeed` captura video y aplica `face-api.js`.
2. Se generan señales faciales: expresiones, gaze, head pose, blink rate.
3. `sidepanel` procesa:
   - calibracion (baseline)
   - smoothing
   - umbrales cognitivos
4. Se generan metricas: foco, estres, fatiga, alertas.
5. `SessionManager` guarda sesiones en Supabase.
6. Dashboard consulta datos historicos desde la nube.

---

## Modulos clave

### Deteccion y estabilidad
- `src/components/CameraFeed.tsx`
- `src/lib/vision/faceStabilizers.ts`

Funciones:
- smooth de expresiones, pose y mirada
- parpadeo adaptativo
- filtros de calidad

### Logica Cognitiva
- `src/lib/cognitivethresholds.ts`
- penaliza foco si no mira pantalla
- distingue “mirar celular”
- alertas: estres alto, fatiga alta, ojos cerrados, fuera de pantalla

### Base de Datos (Supabase)
- `src/lib/supabase.ts`
- Tabla: `work_sessions`
- Guarda sesiones y metricas promedio

---

## Dashboard historico

Ruta:
- `sidepanel.html?view=dashboard`

Componentes modularizados:
- `DashboardHeader`
- `DashboardStats`
- `RangeFilter`
- `FocusTrendChart`
- `SessionsTable`
- `SessionDetail`

Funciones:
- grafica de tendencia de foco
- filtros por fechas
- tabla de sesiones
- detalle de sesion

---

## Funcionalidades de UX

- Feedback en tiempo real (foco/estres/alerta)
- Indicador de atencion visual:
  - En pantalla
  - Fuera
  - Celular
  - Sin rostro
- Mensajes motivacionales y de descanso
- Sonido opcional en alertas criticas

---

## Dependencias principales

- Plasmo (MV3)
- face-api.js
- Supabase JS
- Recharts
- Framer Motion

---

## Proximos pasos sugeridos

- Exportar sesiones a CSV
- Graficas adicionales (estres, fatiga)
- Alertas mas personalizadas
- Ajustes de calibracion por usuario
- Mejoras de rendimiento en deteccion

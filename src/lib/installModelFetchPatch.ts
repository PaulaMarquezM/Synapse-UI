// src/lib/installModelFetchPatch.ts

const MODEL_MARKERS = [
  "/assets/models/",
  "weights_manifest.json",
  "-shard"
]

// Convierte RequestInfo/URL a string (sin romper si viene Request)
function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return (input as Request).url
}

// Caso observado: "chrome-extension:/<id>/..."  ->  "chrome-extension://<id>/..."
function normalizeChromeExtensionUrl(url: string): string {
  if (url.startsWith("chrome-extension:/") && !url.startsWith("chrome-extension://")) {
    return "chrome-extension://" + url.slice("chrome-extension:/".length)
  }
  return url
}

function isModelUrl(url: string): boolean {
  return MODEL_MARKERS.some((m) => url.includes(m))
}

/**
 * Instala un fetch global que:
 * - Normaliza chrome-extension:/ -> chrome-extension://
 * - Reconstruye Request si venía "sellado" con URL mala
 * - Fuerza RequestInit estable para MV3 (no-store, omit, same-origin)
 *
 * Safe: se ejecuta una vez y no se “re-parcha” si ya está instalado.
 */
export function installModelFetchPatch() {
  const g = globalThis as any

  if (g.__SYNAPSE_FETCH_PATCHED__) return
  g.__SYNAPSE_FETCH_PATCHED__ = true

  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = toUrlString(input)
    const fixed = normalizeChromeExtensionUrl(raw)

    const modelReq = isModelUrl(raw) || isModelUrl(fixed)
    if (!modelReq) {
      return originalFetch(input, init)
    }

    if (modelReq) {
      console.log("[SYNAPSE][GLOBAL_FETCH] raw  ->", raw, init)
      if (fixed !== raw) console.log("[SYNAPSE][GLOBAL_FETCH] fixed->", fixed)
    }

    // Si llega un Request con URL mala, hay que reconstruirlo. Para GET de assets funciona perfecto.
    const finalInput: RequestInfo | URL =
      typeof input === "string" || input instanceof URL
        ? fixed
        : fixed !== raw
          ? new Request(fixed, input as Request)
          : input

    // RequestInit recomendado para recursos internos chrome-extension://
    const finalInit: RequestInit = {
      ...(init ?? {}),
      cache: "no-store",
      credentials: "omit",
      mode: "same-origin",
      redirect: "follow",
      referrerPolicy: "no-referrer"
    }

    const resp = await originalFetch(finalInput as any, finalInit)

    if (modelReq) {
      console.log(
        "[SYNAPSE][GLOBAL_FETCH] <-",
        fixed,
        resp.status,
        resp.ok,
        (resp as any).type
      )
    }

    return resp
  }
}

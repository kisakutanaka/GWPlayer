export interface Gw150914Meta {
  event: string
  detector: string
  sampleRate: number
  gpsStart: number
  duration: number
  sampleCount: number
  strainFile: string
  strainFormat: 'float32le'
  source: string
}

export interface Gw150914Data {
  meta: Gw150914Meta
  strain: Float32Array
}

const DATA_DIR = `${import.meta.env.BASE_URL}data/gw150914/`

export async function loadGw150914(): Promise<Gw150914Data> {
  const metaRes = await fetch(`${DATA_DIR}meta.json`)
  if (!metaRes.ok) {
    throw new Error(`Failed to load meta.json: ${metaRes.status}`)
  }
  const meta: Gw150914Meta = await metaRes.json()

  const strainRes = await fetch(`${DATA_DIR}${meta.strainFile}`)
  if (!strainRes.ok) {
    throw new Error(`Failed to load ${meta.strainFile}: ${strainRes.status}`)
  }
  const buffer = await strainRes.arrayBuffer()
  const strain = new Float32Array(buffer)

  if (strain.length !== meta.sampleCount) {
    throw new Error(
      `Sample count mismatch: expected ${meta.sampleCount}, got ${strain.length}`,
    )
  }

  return { meta, strain }
}

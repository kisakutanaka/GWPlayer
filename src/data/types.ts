export interface StrainMeta {
  event: string
  detector: string
  sampleRate: number
  gpsStart: number
  duration: number
  sampleCount: number
}

export interface StrainData {
  meta: StrainMeta
  strain: Float32Array
}

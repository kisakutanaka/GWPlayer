import type { OrbitState } from '../physics/inspiral'

export interface OrbitColors {
  body1: string
  body2: string
  merged: string
}

const BASE_RADIUS_PX = 9

// 質量の立方根におおよそ比例させて円のサイズを決める(見た目上の目安であり、
// ブラックホールの実際の事象の地平面の大きさを縮尺で表したものではない)。
function bodyRadiusPx(mass: number, avgMass: number): number {
  return BASE_RADIUS_PX * Math.cbrt(mass / avgMass)
}

export function renderOrbit(
  canvas: HTMLCanvasElement,
  state: OrbitState,
  maxRadius: number,
  m1: number,
  m2: number,
  colors: OrbitColors,
): void {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const cx = width / 2
  const cy = height / 2
  const maxPixelRadius = (Math.min(width, height) / 2) * 0.85
  const M = m1 + m2
  const avgMass = M / 2

  if (state.merged) {
    ctx.fillStyle = colors.merged
    ctx.beginPath()
    ctx.arc(cx, cy, bodyRadiusPx(M, avgMass), 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const scale = maxRadius > 0 ? maxPixelRadius / maxRadius : 0
  const r1px = state.r * (m2 / M) * scale
  const r2px = state.r * (m1 / M) * scale

  const x1 = cx + r1px * Math.cos(state.theta)
  const y1 = cy + r1px * Math.sin(state.theta)
  const x2 = cx + r2px * Math.cos(state.theta + Math.PI)
  const y2 = cy + r2px * Math.sin(state.theta + Math.PI)

  ctx.fillStyle = colors.body1
  ctx.beginPath()
  ctx.arc(x1, y1, bodyRadiusPx(m1, avgMass), 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colors.body2
  ctx.beginPath()
  ctx.arc(x2, y2, bodyRadiusPx(m2, avgMass), 0, Math.PI * 2)
  ctx.fill()
}

import type { InspiralModel } from '../physics/inspiral'

export interface RotationCurveData {
  times: number[]
  rotations: number[] // 回転数(回転/秒)。合体後は打ち切る
  maxRotation: number
}

// 時間 vs 回転数のデータを合体時刻まで(合体後は打ち切り)サンプリングする。
export function computeRotationCurve(
  model: InspiralModel,
  duration: number,
  points = 300,
): RotationCurveData {
  const times: number[] = []
  const rotations: number[] = []
  let maxRotation = 0
  for (let i = 0; i <= points; i++) {
    const t = (duration * i) / points
    const state = model.stateAt(t)
    if (state.merged) break
    const rot = state.omega / (2 * Math.PI)
    times.push(t)
    rotations.push(rot)
    if (rot > maxRotation) maxRotation = rot
  }
  return { times, rotations, maxRotation }
}

const MARGIN_LEFT = 34
const MARGIN_RIGHT = 8
const MARGIN_TOP = 12
const MARGIN_BOTTOM = 26
const GRID_COLOR = '#8888a055'
const LABEL_COLOR = '#8888a0'
const X_AXIS_TITLE = '時間 (秒)'
const Y_AXIS_TITLE = '回転数 (回/秒)'

function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  return { ctx, width, height }
}

function computeScales(width: number, height: number, duration: number, maxRotation: number) {
  const plotWidth = width - MARGIN_LEFT - MARGIN_RIGHT
  const plotHeight = height - MARGIN_TOP - MARGIN_BOTTOM
  const yMax = Math.ceil((maxRotation || 1) / 5) * 5 || 5
  const xFor = (t: number) => MARGIN_LEFT + (t / duration) * plotWidth
  const yFor = (r: number) =>
    MARGIN_TOP + plotHeight - (r / yMax) * plotHeight
  return { plotWidth, plotHeight, yMax, xFor, yFor }
}

export function renderRotationCurve(
  canvas: HTMLCanvasElement,
  data: RotationCurveData,
  duration: number,
  color: string,
): void {
  const { ctx, width, height } = setupCanvas(canvas)
  const { yMax, xFor, yFor } = computeScales(width, height, duration, data.maxRotation)

  ctx.font = '9px system-ui, sans-serif'
  ctx.strokeStyle = GRID_COLOR
  ctx.fillStyle = LABEL_COLOR
  ctx.lineWidth = 1

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const frac of [0, 0.5, 1]) {
    const r = yMax * frac
    const y = yFor(r)
    ctx.beginPath()
    ctx.moveTo(MARGIN_LEFT, y)
    ctx.lineTo(width - MARGIN_RIGHT, y)
    ctx.stroke()
    ctx.fillText(r.toFixed(0), MARGIN_LEFT - 6, y)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const frac of [0, 0.5, 1]) {
    const t = duration * frac
    ctx.fillText(t.toFixed(0), xFor(t), height - MARGIN_BOTTOM + 4)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(Y_AXIS_TITLE, MARGIN_LEFT, 9)
  ctx.textAlign = 'right'
  ctx.fillText(X_AXIS_TITLE, width - MARGIN_RIGHT, height - 1)

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  data.times.forEach((t, i) => {
    const x = xFor(t)
    const y = yFor(data.rotations[i])
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
}

export function renderRotationPlayhead(
  canvas: HTMLCanvasElement,
  data: RotationCurveData,
  duration: number,
  t: number,
  color: string,
): void {
  const { ctx, width, height } = setupCanvas(canvas)
  const { xFor, yFor } = computeScales(width, height, duration, data.maxRotation)

  const clampedT = Math.min(t, duration)
  const x = xFor(clampedT)

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, MARGIN_TOP)
  ctx.lineTo(x, height - MARGIN_BOTTOM)
  ctx.stroke()

  const lastT = data.times[data.times.length - 1] ?? 0
  if (data.times.length > 0 && t <= lastT) {
    const idx = Math.min(
      Math.round((t / duration) * (data.times.length - 1)),
      data.times.length - 1,
    )
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, yFor(data.rotations[idx]), 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

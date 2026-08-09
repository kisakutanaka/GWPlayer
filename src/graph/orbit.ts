import type { InspiralModel, OrbitState } from '../physics/inspiral'

export interface OrbitColors {
  body1: string
  body2: string
  merged: string
}

const BASE_RADIUS_PX = 9
// 縦方向を圧縮することで、軌道面を斜め上から見下ろしたように見せる。
const TILT_Y = 0.55
// 軌跡は「一定の時間」ではなく「一定の軌道位相(ラジアン)」さかのぼった
// 範囲で描く。固定時間だと、周回が速くなる合体直前は何重にも巻きついて
// 見づらくなり、逆に周回が遅い序盤はほとんど軌跡が見えなくなるため。
const TRAIL_PHASE_WINDOW = 1.6 // ラジアン(およそ1/4周)
const TRAIL_POINTS = 12

type Point = { x: number; y: number }

// 質量の立方根におおよそ比例させて円のサイズを決める(見た目上の目安であり、
// ブラックホールの実際の事象の地平面の大きさを縮尺で表したものではない)。
function bodyRadiusPx(mass: number, avgMass: number): number {
  return BASE_RADIUS_PX * Math.cbrt(mass / avgMass)
}

function project(x: number, y: number, cx: number, cy: number): Point {
  return { x: cx + x, y: cy + y * TILT_Y }
}

export function renderOrbit(
  canvas: HTMLCanvasElement,
  model: InspiralModel,
  t: number,
  colors: OrbitColors,
): OrbitState {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.globalAlpha = 1

  const cx = width / 2
  const cy = height / 2
  // 縦方向はTILT_Yで圧縮されるため、横幅基準と「圧縮後に縦へ収まる」
  // 基準の両方を満たす最大半径を使う。横長のコンテナでも余白を無駄にしない。
  const maxPixelRadius = Math.min(
    (width / 2) * 0.9,
    (height / 2 / TILT_Y) * 0.9,
  )
  const M = model.m1 + model.m2
  const avgMass = M / 2
  const scale = model.maxRadius > 0 ? maxPixelRadius / model.maxRadius : 0

  const state = model.stateAt(t)

  if (state.merged) {
    ctx.fillStyle = colors.merged
    ctx.beginPath()
    ctx.arc(cx, cy, bodyRadiusPx(M, avgMass), 0, Math.PI * 2)
    ctx.fill()
    return state
  }

  // theta(t)は合体まで単調増加なので、二分探索で
  // 「現在より位相がTRAIL_PHASE_WINDOWだけ小さい時刻」を求める
  function findTrailStart(targetTheta: number): number {
    let lo = 0
    let hi = t
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (model.stateAt(mid).theta < targetTheta) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  const trailStart =
    state.theta > TRAIL_PHASE_WINDOW
      ? findTrailStart(state.theta - TRAIL_PHASE_WINDOW)
      : 0

  // 天体ごとに、trailStart〜現在時刻の軌跡の座標列を作る
  function trailPositions(massRatio: number, phaseOffset: number): Point[] {
    const points: Point[] = []
    for (let i = 0; i <= TRAIL_POINTS; i++) {
      const sampleT = trailStart + ((t - trailStart) * i) / TRAIL_POINTS
      const s = model.stateAt(sampleT)
      if (s.merged) continue
      const rpx = s.r * massRatio * scale
      const angle = s.theta + phaseOffset
      points.push(project(rpx * Math.cos(angle), rpx * Math.sin(angle), cx, cy))
    }
    return points
  }

  function drawTrail(points: Point[], color: string) {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    for (let i = 1; i < points.length; i++) {
      ctx.globalAlpha = (i / points.length) * 0.5 // 古い点ほど薄くする
      ctx.beginPath()
      ctx.moveTo(points[i - 1].x, points[i - 1].y)
      ctx.lineTo(points[i].x, points[i].y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  drawTrail(trailPositions(model.m2 / M, 0), colors.body1)
  drawTrail(trailPositions(model.m1 / M, Math.PI), colors.body2)

  const r1px = state.r * (model.m2 / M) * scale
  const r2px = state.r * (model.m1 / M) * scale
  const p1 = project(
    r1px * Math.cos(state.theta),
    r1px * Math.sin(state.theta),
    cx,
    cy,
  )
  const p2 = project(
    r2px * Math.cos(state.theta + Math.PI),
    r2px * Math.sin(state.theta + Math.PI),
    cx,
    cy,
  )

  // 奥行き感: sin(theta)が負の側を「奥」とみなし、先に描いてから
  // 手前側を上に重ねる。奥側はわずかに透明度を下げる。
  const bodies = [
    { pos: p1, mass: model.m1, color: colors.body1, depth: Math.sin(state.theta) },
    { pos: p2, mass: model.m2, color: colors.body2, depth: -Math.sin(state.theta) },
  ].sort((a, b) => a.depth - b.depth)

  for (const b of bodies) {
    ctx.globalAlpha = b.depth < 0 ? 0.75 : 1
    ctx.fillStyle = b.color
    ctx.beginPath()
    ctx.arc(b.pos.x, b.pos.y, bodyRadiusPx(b.mass, avgMass), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  return state
}

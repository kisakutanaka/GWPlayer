// GW150914の質量パラメータ(Abbott et al. 2016で公表された約36+29太陽質量)から、
// リーディングオーダー(Newtonian quadrupole近似)のチャープ公式を使って
// 軌道半径・位相の時間変化を計算する。数値相対論による正確な波形ではなく、
// 教育目的の簡略化した軌道運動モデルであることに留意。
const G = 6.6743e-11 // m^3 kg^-1 s^-2
const C = 2.998e8 // m/s
const M_SUN = 1.98892e30 // kg

// この時間より合体に近づいたら、PN近似が破綻するのを避けるため
// 半径を単純に0まで直線的に絞る（簡略化）。
const MERGE_TRANSITION = 0.1 // 秒

export interface OrbitState {
  r: number // メートル
  theta: number // ラジアン（累積位相）
  merged: boolean
}

export interface InspiralModel {
  m1: number // kg
  m2: number // kg
  maxRadius: number // メートル。クリップ開始時点(t=0)の軌道半径
  stateAt(t: number): OrbitState
}

export function createInspiralModel(
  m1SolarMasses: number,
  m2SolarMasses: number,
  mergerTime: number,
  duration: number,
  resolution = 20000,
): InspiralModel {
  const m1 = m1SolarMasses * M_SUN
  const m2 = m2SolarMasses * M_SUN
  const M = m1 + m2
  const chirpMass = (m1 * m2) ** (3 / 5) / M ** (1 / 5)
  const gmc = (G * chirpMass) / C ** 3

  // f_gw(tau): 合体のtau秒前における重力波周波数(=軌道周波数の2倍)
  const fGw = (tau: number) =>
    (1 / Math.PI) * (5 / (256 * tau)) ** (3 / 8) * gmc ** (-5 / 8)
  const omegaAtTau = (tau: number) => Math.PI * fGw(tau)
  // ケプラーの第三法則: r = (G*M / omega_orb^2)^(1/3)
  const radiusAtTau = (tau: number) => (G * M / omegaAtTau(tau) ** 2) ** (1 / 3)

  const rAtTransition = radiusAtTau(MERGE_TRANSITION)
  const omegaAtTransition = omegaAtTau(MERGE_TRANSITION)

  const times = new Float64Array(resolution + 1)
  const radii = new Float64Array(resolution + 1)
  const thetas = new Float64Array(resolution + 1)
  const mergedFlags = new Uint8Array(resolution + 1)

  let theta = 0
  let prevT = 0
  for (let i = 0; i <= resolution; i++) {
    const t = (duration * i) / resolution
    const tau = mergerTime - t

    let r: number
    let omega: number
    let merged: boolean
    if (tau <= 0) {
      r = 0
      omega = 0
      merged = true
    } else if (tau <= MERGE_TRANSITION) {
      r = rAtTransition * (tau / MERGE_TRANSITION)
      omega = omegaAtTransition
      merged = false
    } else {
      r = radiusAtTau(tau)
      omega = omegaAtTau(tau)
      merged = false
    }

    if (i > 0) {
      theta += omega * (t - prevT) // 前進オイラー積分
    }

    times[i] = t
    radii[i] = r
    thetas[i] = theta
    mergedFlags[i] = merged ? 1 : 0
    prevT = t
  }

  function stateAt(t: number): OrbitState {
    const clamped = Math.max(0, Math.min(t, duration))
    const pos = (clamped / duration) * resolution
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, resolution)
    const frac = pos - i0
    return {
      r: radii[i0] + (radii[i1] - radii[i0]) * frac,
      theta: thetas[i0] + (thetas[i1] - thetas[i0]) * frac,
      merged: mergedFlags[i1] === 1,
    }
  }

  return { m1, m2, maxRadius: radii[0], stateAt }
}

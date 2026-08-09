import { fft, ifft } from './fft'
import { computePsdWelch } from './psd'
import { tukeyWindow } from './window'

// Welch法で求めたPSD(周波数分解能が粗い)を、FFT全体の周波数ビン(細かい)
// に合わせて線形補間する。
function interpolatePsd(
  frequencies: Float64Array,
  psd: Float64Array,
  f: number,
): number {
  const last = frequencies.length - 1
  if (f <= frequencies[0]) return psd[0]
  if (f >= frequencies[last]) return psd[last]

  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (frequencies[mid] <= f) lo = mid
    else hi = mid
  }
  const f0 = frequencies[lo]
  const f1 = frequencies[hi]
  const t = (f - f0) / (f1 - f0)
  return psd[lo] + (psd[hi] - psd[lo]) * t
}

// GWOSCの信号処理チュートリアルと同じ手法でホワイトニングする:
// FFT → 各周波数成分をその周波数のPSDの平方根(=ASD)で割る → IFFT。
// PSDのグラフで見えていた「山」を打ち消すことで、どの周波数も同じくらいの
// 強さになる(＝ホワイトノイズに近づく)。
//
// データ全体を1回のFFTにかけるため、区間の両端が不連続点になり
// そのままだと巨大なリンギングが端に出る。Tukey窓で両端だけ
// テーパーしてから処理することでこれを抑える。
const EDGE_TAPER_ALPHA = 0.1

export function whiten(
  samples: Float32Array,
  sampleRate: number,
  psdSegmentLength = 4096,
): Float32Array {
  const n = samples.length
  const { frequencies, psd } = computePsdWelch(
    samples,
    sampleRate,
    psdSegmentLength,
  )

  const taper = tukeyWindow(n, EDGE_TAPER_ALPHA)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let i = 0; i < n; i++) re[i] = samples[i] * taper[i]
  fft(re, im)

  const dt = 1 / sampleRate
  const norm = Math.sqrt(2 * dt)
  const half = n / 2

  for (let k = 0; k < n; k++) {
    const binFreq = (k <= half ? k : n - k) * (sampleRate / n)
    const p = interpolatePsd(frequencies, psd, binFreq)
    const scale = p > 0 ? norm / Math.sqrt(p) : 0
    re[k] *= scale
    im[k] *= scale
  }

  ifft(re, im)

  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = re[i]
  return out
}

import { fft } from './fft'
import { hannWindow } from './window'

export interface PsdResult {
  frequencies: Float64Array
  psd: Float64Array // strain^2 / Hz
}

// Welch法: セグメントに分割し、Hann窓をかけてFFTしたパワーを平均することで
// 単一FFTよりノイズの少ないPSD推定を得る。segmentLengthは2の冪であること。
export function computePsdWelch(
  samples: Float32Array,
  sampleRate: number,
  segmentLength = 4096,
): PsdResult {
  const step = segmentLength / 2 // 50% overlap
  const window = hannWindow(segmentLength)
  let windowPower = 0
  for (const w of window) windowPower += w * w

  const halfLen = segmentLength / 2
  const accum = new Float64Array(halfLen + 1)
  const re = new Float64Array(segmentLength)
  const im = new Float64Array(segmentLength)
  let segmentCount = 0

  for (
    let start = 0;
    start + segmentLength <= samples.length;
    start += step
  ) {
    for (let i = 0; i < segmentLength; i++) {
      re[i] = samples[start + i] * window[i]
      im[i] = 0
    }
    fft(re, im)
    for (let k = 0; k <= halfLen; k++) {
      accum[k] += re[k] * re[k] + im[k] * im[k]
    }
    segmentCount++
  }

  const psd = new Float64Array(halfLen + 1)
  const scale = 1 / (sampleRate * windowPower)
  for (let k = 0; k <= halfLen; k++) {
    let v = (accum[k] / segmentCount) * scale
    if (k !== 0 && k !== halfLen) v *= 2 // 片側スペクトル化
    psd[k] = v
  }

  const frequencies = new Float64Array(halfLen + 1)
  for (let k = 0; k <= halfLen; k++) {
    frequencies[k] = (k * sampleRate) / segmentLength
  }

  return { frequencies, psd }
}

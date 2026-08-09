// 波形は静止画として一度だけ描画し、再生位置インジケータは別レイヤーの
// Canvasに毎フレーム描き直す。波形全体を毎フレーム再描画しないことで
// iPhoneでの描画負荷を抑える。
export function renderWaveform(
  canvas: HTMLCanvasElement,
  samples: Float32Array,
  color: string,
): void {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  let peak = 0
  for (const v of samples) peak = Math.max(peak, Math.abs(v))
  if (peak === 0) peak = 1

  const mid = height / 2
  const scale = (mid * 0.9) / peak
  const samplesPerPixel = samples.length / width

  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()

  for (let x = 0; x < width; x++) {
    const start = Math.floor(x * samplesPerPixel)
    const end = Math.max(start + 1, Math.floor((x + 1) * samplesPerPixel))
    let min = 0
    let max = 0
    for (let i = start; i < end && i < samples.length; i++) {
      const v = samples[i]
      if (v < min) min = v
      if (v > max) max = v
    }
    ctx.moveTo(x + 0.5, mid - max * scale)
    ctx.lineTo(x + 0.5, mid - min * scale)
  }
  ctx.stroke()
}

export function renderPlayhead(
  canvas: HTMLCanvasElement,
  ratio: number,
  color: string,
): void {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const x = Math.round(Math.min(Math.max(ratio, 0), 1) * width) + 0.5
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()
}

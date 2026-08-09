// 振幅スペクトル密度(ASD = sqrt(PSD))をlog-logで描画する。
// LIGOのノイズ特性は周波数ごとに桁違いに変化するため、
// 通常の線形軸ではなくlog-logで見るのが一般的（GWOSCチュートリアルと同様）。
export function renderSpectrum(
  canvas: HTMLCanvasElement,
  frequencies: Float64Array,
  psd: Float64Array,
  color: string,
  range: { minFreq: number; maxFreq: number },
): void {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const { minFreq, maxFreq } = range

  let minAsd = Infinity
  let maxAsd = -Infinity
  for (let k = 0; k < frequencies.length; k++) {
    const f = frequencies[k]
    if (f < minFreq || f > maxFreq) continue
    const asd = Math.sqrt(psd[k])
    if (asd <= 0) continue
    if (asd < minAsd) minAsd = asd
    if (asd > maxAsd) maxAsd = asd
  }
  if (!isFinite(minAsd) || !isFinite(maxAsd)) return

  const logMinF = Math.log10(minFreq)
  const logMaxF = Math.log10(maxFreq)
  const logMinA = Math.log10(minAsd)
  const logMaxA = Math.log10(maxAsd)

  const xForFreq = (f: number) =>
    ((Math.log10(f) - logMinF) / (logMaxF - logMinF)) * width
  const yForAsd = (a: number) =>
    height - ((Math.log10(a) - logMinA) / (logMaxA - logMinA)) * height

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  let started = false
  for (let k = 0; k < frequencies.length; k++) {
    const f = frequencies[k]
    if (f < minFreq || f > maxFreq) continue
    const asd = Math.sqrt(psd[k])
    if (asd <= 0) continue
    const x = xForFreq(f)
    const y = yForAsd(asd)
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

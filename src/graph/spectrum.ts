// 振幅スペクトル密度(ASD = sqrt(PSD))をlog-logで描画する。
// LIGOのノイズ特性は周波数ごとに桁違いに変化するため、
// 通常の線形軸ではなくlog-logで見るのが一般的（GWOSCチュートリアルと同様）。
const MARGIN_LEFT = 48
const MARGIN_RIGHT = 16
const MARGIN_BOTTOM = 16
const GRID_COLOR = '#8888a055'
const LABEL_COLOR = '#8888a0'

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

  const plotWidth = width - MARGIN_LEFT - MARGIN_RIGHT
  const plotHeight = height - MARGIN_BOTTOM

  const logMinF = Math.log10(minFreq)
  const logMaxF = Math.log10(maxFreq)
  const logMinA = Math.floor(Math.log10(minAsd))
  const logMaxA = Math.ceil(Math.log10(maxAsd))

  const xForFreq = (f: number) =>
    MARGIN_LEFT +
    ((Math.log10(f) - logMinF) / (logMaxF - logMinF)) * plotWidth
  const yForAsd = (a: number) =>
    plotHeight - ((Math.log10(a) - logMinA) / (logMaxA - logMinA)) * plotHeight

  ctx.font = '10px system-ui, sans-serif'

  // y軸: 10のべき乗ごとのグリッド線と目盛りラベル(strain/√Hz)
  ctx.strokeStyle = GRID_COLOR
  ctx.fillStyle = LABEL_COLOR
  ctx.lineWidth = 1
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let e = logMinA; e <= logMaxA; e++) {
    const y = yForAsd(10 ** e)
    ctx.beginPath()
    ctx.moveTo(MARGIN_LEFT, y)
    ctx.lineTo(width - MARGIN_RIGHT, y)
    ctx.stroke()
    ctx.fillText(`1e${e}`, MARGIN_LEFT - 6, y)
  }

  // x軸: 10のべき乗ごとのグリッド線と目盛りラベル(Hz)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let e = Math.ceil(logMinF); e <= Math.floor(logMaxF); e++) {
    const f = 10 ** e
    const x = xForFreq(f)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, plotHeight)
    ctx.stroke()
    ctx.fillText(`${f}`, x, plotHeight + 3)
  }

  // 軸の単位（目盛りラベルと衝突しないよう上部の左右端に配置）
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText('strain/√Hz', MARGIN_LEFT, 0)
  ctx.textAlign = 'right'
  ctx.fillText('Hz', width, 0)

  // データ本体
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

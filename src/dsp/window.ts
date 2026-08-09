export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
  }
  return w
}

// 両端のalpha割合だけコサインでテーパーし、中央は1のままの窓。
// FFT全体を使う処理(ホワイトニングなど)で、データ端の不連続による
// リンギングを抑えるために使う。
export function tukeyWindow(n: number, alpha: number): Float64Array {
  const w = new Float64Array(n).fill(1)
  const taperLen = Math.floor((alpha * (n - 1)) / 2)
  for (let i = 0; i <= taperLen; i++) {
    const v = 0.5 * (1 + Math.cos(Math.PI * (i / taperLen - 1)))
    w[i] = v
    w[n - 1 - i] = v
  }
  return w
}

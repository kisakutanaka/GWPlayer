// 反復版Cooley-Tukey基数2 FFT（in-place）。lengthは2の冪であること。
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  if (n !== im.length) throw new Error('re/im length mismatch')
  if (n <= 0 || (n & (n - 1)) !== 0) {
    throw new Error('length must be a power of 2')
  }

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tmpRe = re[i]
      re[i] = re[j]
      re[j] = tmpRe
      const tmpIm = im[i]
      im[i] = im[j]
      im[j] = tmpIm
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len / 2
    const ang = (-2 * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k]
        const aIm = im[i + k]
        const bRe = re[i + k + half] * curRe - im[i + k + half] * curIm
        const bIm = re[i + k + half] * curIm + im[i + k + half] * curRe
        re[i + k] = aRe + bRe
        im[i + k] = aIm + bIm
        re[i + k + half] = aRe - bRe
        im[i + k + half] = aIm - bIm
        const nextRe = curRe * wRe - curIm * wIm
        const nextIm = curRe * wIm + curIm * wRe
        curRe = nextRe
        curIm = nextIm
      }
    }
  }
}

// ハイパス+ローパスを直列につないだバンドパスフィルタ。
// FFTベースの自前実装(whiten.ts)と違い、Web Audio APIのBiquadFilterNodeを
// そのまま使う。OfflineAudioContextでレンダリングして波形データを取り出す
// ことで、グラフ描画にも通常再生にも同じFloat32Arrayとして扱える。
export async function bandpass(
  samples: Float32Array,
  sampleRate: number,
  lowFreq: number,
  highFreq: number,
): Promise<Float32Array> {
  const offlineCtx = new OfflineAudioContext(1, samples.length, sampleRate)
  const buffer = offlineCtx.createBuffer(1, samples.length, sampleRate)
  const copy = new Float32Array(samples.length)
  copy.set(samples)
  buffer.copyToChannel(copy, 0)

  const source = offlineCtx.createBufferSource()
  source.buffer = buffer

  const highpass = offlineCtx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = lowFreq

  const lowpass = offlineCtx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = highFreq

  source.connect(highpass)
  highpass.connect(lowpass)
  lowpass.connect(offlineCtx.destination)
  source.start()

  const rendered = await offlineCtx.startRendering()
  return rendered.getChannelData(0).slice()
}

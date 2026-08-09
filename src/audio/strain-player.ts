// strainデータ(物理量としての振幅、~1e-21オーダー)をそのまま再生すると
// 無音に等しいため、ピーク振幅を基準に音量スケーリングのみ行う。
// フィルタ処理は行わないため「無加工」の音として扱う。
export class StrainPlayer {
  private readonly ctx: AudioContext
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private startedAt = 0
  private offset = 0
  private playing = false

  onEnded?: () => void

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  load(strain: Float32Array, sampleRate: number): void {
    const buffer = this.ctx.createBuffer(1, strain.length, sampleRate)
    const channel = buffer.getChannelData(0)
    let peak = 0
    for (const v of strain) peak = Math.max(peak, Math.abs(v))
    const gain = peak > 0 ? 0.8 / peak : 1
    for (let i = 0; i < strain.length; i++) {
      channel[i] = strain[i] * gain
    }
    this.buffer = buffer
    this.offset = 0
    this.playing = false
  }

  get duration(): number {
    return this.buffer?.duration ?? 0
  }

  get currentTime(): number {
    if (!this.buffer) return 0
    const t = this.playing
      ? this.offset + (this.ctx.currentTime - this.startedAt)
      : this.offset
    return Math.min(t, this.buffer.duration)
  }

  get isPlaying(): boolean {
    return this.playing
  }

  play(): void {
    if (!this.buffer || this.playing) return
    if (this.offset >= this.buffer.duration) this.offset = 0

    const source = this.ctx.createBufferSource()
    source.buffer = this.buffer
    source.connect(this.ctx.destination)
    source.onended = () => {
      if (this.source !== source) return
      this.playing = false
      this.offset = this.buffer!.duration
      this.source = null
      this.onEnded?.()
    }
    source.start(0, this.offset)

    this.source = source
    this.startedAt = this.ctx.currentTime
    this.playing = true
  }

  pause(): void {
    if (!this.playing || !this.source) return
    this.offset = this.currentTime
    this.source.onended = null
    this.source.stop()
    this.source = null
    this.playing = false
  }

  seek(time: number): void {
    const wasPlaying = this.playing
    if (this.playing) this.pause()
    this.offset = Math.max(0, Math.min(time, this.buffer?.duration ?? 0))
    if (wasPlaying) this.play()
  }
}

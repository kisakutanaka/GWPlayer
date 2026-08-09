import type { StrainPlayer } from '../audio/strain-player'
import { renderWaveform, renderPlayhead } from '../graph/waveform'
import { setupPlaybackControls } from './playback-controls'

export interface PlayerSectionElements {
  waveformCanvas: HTMLCanvasElement
  playheadCanvas: HTMLCanvasElement
  playPauseButton: HTMLButtonElement
  seekInput: HTMLInputElement
  timeLabel: HTMLSpanElement
}

// 波形描画＋再生/一時停止＋シークバーをまとめたセットアップ関数。
// 無加工/ホワイトニング後/バンドパス後で同じUIパターンを繰り返すため共通化する。
export function setupPlayerSection(
  ctx: AudioContext,
  elements: PlayerSectionElements,
  strain: Float32Array,
  sampleRate: number,
  waveformColor: string,
  playheadColor: string,
): StrainPlayer {
  const { waveformCanvas, playheadCanvas, playPauseButton, seekInput, timeLabel } =
    elements

  renderWaveform(waveformCanvas, strain, waveformColor)
  const duration = strain.length / sampleRate

  const render = (t: number) => {
    const ratio = duration > 0 ? t / duration : 0
    renderPlayhead(playheadCanvas, ratio, playheadColor)
  }

  const player = setupPlaybackControls(
    ctx,
    { playPauseButton, seekInput, timeLabel },
    strain,
    sampleRate,
    render,
  )

  window.addEventListener('resize', () => {
    renderWaveform(waveformCanvas, strain, waveformColor)
    render(player.currentTime)
  })

  return player
}

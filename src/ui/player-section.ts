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

export interface PlayerSectionHandle {
  player: StrainPlayer
  dispose: () => void
}

// 波形描画＋再生/一時停止＋シークバーをまとめたセットアップ関数。
// 無加工/ホワイトニング後/バンドパス後で同じUIパターンを繰り返すため共通化する。
// イベント切り替え時に呼び直せるよう、resizeリスナーを解除するdisposeを返す。
export function setupPlayerSection(
  ctx: AudioContext,
  elements: PlayerSectionElements,
  strain: Float32Array,
  sampleRate: number,
  waveformColor: string,
  playheadColor: string,
): PlayerSectionHandle {
  const { waveformCanvas, playheadCanvas, playPauseButton, seekInput, timeLabel } =
    elements

  renderWaveform(waveformCanvas, strain, waveformColor)
  const duration = strain.length / sampleRate

  const render = (t: number) => {
    const ratio = duration > 0 ? t / duration : 0
    renderPlayhead(playheadCanvas, ratio, playheadColor)
  }

  const { player, dispose: disposeControls } = setupPlaybackControls(
    ctx,
    { playPauseButton, seekInput, timeLabel },
    strain,
    sampleRate,
    render,
  )

  const onResize = () => {
    renderWaveform(waveformCanvas, strain, waveformColor)
    render(player.currentTime)
  }
  window.addEventListener('resize', onResize)

  return {
    player,
    dispose: () => {
      disposeControls()
      window.removeEventListener('resize', onResize)
    },
  }
}

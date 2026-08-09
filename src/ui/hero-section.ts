import type { StrainPlayer } from '../audio/strain-player'
import { renderWaveform, renderPlayhead } from '../graph/waveform'
import { renderOrbit } from '../graph/orbit'
import type { OrbitColors } from '../graph/orbit'
import {
  computeRotationCurve,
  renderRotationCurve,
  renderRotationPlayhead,
} from '../graph/rotation-curve'
import type { InspiralModel } from '../physics/inspiral'
import { setupPlaybackControls } from './playback-controls'

export interface HeroSectionElements {
  orbitCanvas: HTMLCanvasElement
  rotationCurveCanvas: HTMLCanvasElement
  rotationPlayheadCanvas: HTMLCanvasElement
  rotationRateLabel: HTMLParagraphElement
  waveformCanvas: HTMLCanvasElement
  playheadCanvas: HTMLCanvasElement
  playPauseButton: HTMLButtonElement
  seekInput: HTMLInputElement
  timeLabel: HTMLSpanElement
}

// アニメーション・チャープ曲線・波形を1つの共有タイムラインで同期させる
// ヒーローセクション。バンドパス後のデータを使い、この1つの再生ボタンで
// 3つの表示すべてが連動する。
export function setupHeroSection(
  ctx: AudioContext,
  elements: HeroSectionElements,
  strain: Float32Array,
  sampleRate: number,
  waveformColor: string,
  playheadColor: string,
  model: InspiralModel,
  orbitColors: OrbitColors,
  rotationCurveColor: string,
): StrainPlayer {
  const {
    orbitCanvas,
    rotationCurveCanvas,
    rotationPlayheadCanvas,
    rotationRateLabel,
    waveformCanvas,
    playheadCanvas,
    playPauseButton,
    seekInput,
    timeLabel,
  } = elements

  renderWaveform(waveformCanvas, strain, waveformColor)
  const duration = strain.length / sampleRate
  const rotationData = computeRotationCurve(model, duration)
  renderRotationCurve(rotationCurveCanvas, rotationData, duration, rotationCurveColor)

  const render = (t: number) => {
    const ratio = duration > 0 ? t / duration : 0
    renderPlayhead(playheadCanvas, ratio, playheadColor)

    const state = renderOrbit(orbitCanvas, model, t, orbitColors)
    rotationRateLabel.textContent = state.merged
      ? '回転数: 合体後'
      : `回転数: ${(state.omega / (2 * Math.PI)).toFixed(1)} 回/秒`
    renderRotationPlayhead(rotationPlayheadCanvas, rotationData, duration, t, playheadColor)
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
    renderRotationCurve(rotationCurveCanvas, rotationData, duration, rotationCurveColor)
    render(player.currentTime)
  })

  return player
}

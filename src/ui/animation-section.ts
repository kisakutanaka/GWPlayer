import type { StrainPlayer } from '../audio/strain-player'
import { renderOrbit } from '../graph/orbit'
import type { OrbitColors } from '../graph/orbit'
import {
  computeRotationCurve,
  renderRotationCurve,
  renderRotationPlayhead,
} from '../graph/rotation-curve'
import type { InspiralModel } from '../physics/inspiral'
import { setupPlaybackControls } from './playback-controls'

export interface AnimationSectionElements {
  orbitCanvas: HTMLCanvasElement
  rotationCurveCanvas: HTMLCanvasElement
  rotationPlayheadCanvas: HTMLCanvasElement
  rotationRateLabel: HTMLParagraphElement
  playPauseButton: HTMLButtonElement
  seekInput: HTMLInputElement
  timeLabel: HTMLSpanElement
}

export function setupAnimationSection(
  ctx: AudioContext,
  elements: AnimationSectionElements,
  strain: Float32Array,
  sampleRate: number,
  model: InspiralModel,
  colors: OrbitColors,
  rotationCurveColor: string,
  playheadColor: string,
): StrainPlayer {
  const {
    orbitCanvas,
    rotationCurveCanvas,
    rotationPlayheadCanvas,
    rotationRateLabel,
    playPauseButton,
    seekInput,
    timeLabel,
  } = elements

  const duration = strain.length / sampleRate
  const rotationData = computeRotationCurve(model, duration)
  renderRotationCurve(rotationCurveCanvas, rotationData, duration, rotationCurveColor)

  const render = (t: number) => {
    const state = renderOrbit(orbitCanvas, model, t, colors)
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
    renderRotationCurve(rotationCurveCanvas, rotationData, duration, rotationCurveColor)
    render(player.currentTime)
  })

  return player
}

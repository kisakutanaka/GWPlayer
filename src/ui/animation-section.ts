import type { StrainPlayer } from '../audio/strain-player'
import { renderOrbit } from '../graph/orbit'
import type { OrbitColors } from '../graph/orbit'
import type { InspiralModel } from '../physics/inspiral'
import { setupPlaybackControls } from './playback-controls'

export interface AnimationSectionElements {
  orbitCanvas: HTMLCanvasElement
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
): StrainPlayer {
  const { orbitCanvas, rotationRateLabel, playPauseButton, seekInput, timeLabel } =
    elements

  const render = (t: number) => {
    const state = renderOrbit(orbitCanvas, model, t, colors)
    rotationRateLabel.textContent = state.merged
      ? '回転数: 合体後'
      : `回転数: ${(state.omega / (2 * Math.PI)).toFixed(1)} 回/秒`
  }

  const player = setupPlaybackControls(
    ctx,
    { playPauseButton, seekInput, timeLabel },
    strain,
    sampleRate,
    render,
  )

  window.addEventListener('resize', () => render(player.currentTime))

  return player
}

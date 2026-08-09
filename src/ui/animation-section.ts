import type { StrainPlayer } from '../audio/strain-player'
import { renderOrbit } from '../graph/orbit'
import type { OrbitColors } from '../graph/orbit'
import type { InspiralModel } from '../physics/inspiral'
import { setupPlaybackControls } from './playback-controls'

export interface AnimationSectionElements {
  orbitCanvas: HTMLCanvasElement
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
  const { orbitCanvas, playPauseButton, seekInput, timeLabel } = elements

  const render = (t: number) => {
    renderOrbit(orbitCanvas, model, t, colors)
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

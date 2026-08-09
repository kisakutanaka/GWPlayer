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
  orbitWrap: HTMLDivElement
  orbitCanvas: HTMLCanvasElement
  rotationGraphWrap: HTMLDivElement
  rotationCurveCanvas: HTMLCanvasElement
  rotationPlayheadCanvas: HTMLCanvasElement
  rotationRateLabel: HTMLParagraphElement
  waveformCanvas: HTMLCanvasElement
  playheadCanvas: HTMLCanvasElement
  playPauseButton: HTMLButtonElement
  seekInput: HTMLInputElement
  timeLabel: HTMLSpanElement
}

export interface HeroSectionHandle {
  player: StrainPlayer
  dispose: () => void
}

// アニメーション・チャープ曲線・波形を1つの共有タイムラインで同期させる
// ヒーローセクション。バンドパス後のデータを使い、この1つの再生ボタンで
// 3つの表示すべてが連動する。
// modelがnull(質量パラメータが取得できなかったイベント)の場合は
// アニメーションとチャープ曲線を非表示にし、波形のみ表示する。
export function setupHeroSection(
  ctx: AudioContext,
  elements: HeroSectionElements,
  strain: Float32Array,
  sampleRate: number,
  waveformColor: string,
  playheadColor: string,
  model: InspiralModel | null,
  orbitColors: OrbitColors,
  rotationCurveColor: string,
): HeroSectionHandle {
  const {
    orbitWrap,
    orbitCanvas,
    rotationGraphWrap,
    rotationCurveCanvas,
    rotationPlayheadCanvas,
    rotationRateLabel,
    waveformCanvas,
    playheadCanvas,
    playPauseButton,
    seekInput,
    timeLabel,
  } = elements

  orbitWrap.hidden = model === null
  rotationGraphWrap.hidden = model === null
  rotationRateLabel.hidden = model === null

  renderWaveform(waveformCanvas, strain, waveformColor)
  const duration = strain.length / sampleRate
  const rotationData = model ? computeRotationCurve(model, duration) : null
  if (model && rotationData) {
    renderRotationCurve(rotationCurveCanvas, rotationData, duration, rotationCurveColor)
  }

  const render = (t: number) => {
    const ratio = duration > 0 ? t / duration : 0
    renderPlayhead(playheadCanvas, ratio, playheadColor)

    if (model && rotationData) {
      const state = renderOrbit(orbitCanvas, model, t, orbitColors)
      rotationRateLabel.textContent = state.merged
        ? '回転数: 合体後'
        : `回転数: ${(state.omega / (2 * Math.PI)).toFixed(1)} 回/秒`
      renderRotationPlayhead(rotationPlayheadCanvas, rotationData, duration, t, playheadColor)
    }
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
    if (model && rotationData) {
      renderRotationCurve(rotationCurveCanvas, rotationData, duration, rotationCurveColor)
    }
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

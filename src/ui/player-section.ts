import { StrainPlayer } from '../audio/strain-player'
import { renderWaveform, renderPlayhead } from '../graph/waveform'

export interface PlayerSectionElements {
  waveformCanvas: HTMLCanvasElement
  playheadCanvas: HTMLCanvasElement
  playPauseButton: HTMLButtonElement
  seekInput: HTMLInputElement
  timeLabel: HTMLSpanElement
}

const formatTime = (t: number) => t.toFixed(1)

// 波形描画・再生/一時停止・シークバーの配線をまとめたセットアップ関数。
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

  const player = new StrainPlayer(ctx)
  player.load(strain, sampleRate)

  seekInput.max = String(player.duration)
  timeLabel.textContent = `0.0 / ${formatTime(player.duration)} 秒`
  renderWaveform(waveformCanvas, strain, waveformColor)

  const drawPlayhead = () => {
    const ratio = player.duration > 0 ? player.currentTime / player.duration : 0
    renderPlayhead(playheadCanvas, ratio, playheadColor)
  }
  drawPlayhead()

  let draggingSeek = false

  const updateLoop = () => {
    if (!draggingSeek) {
      seekInput.value = String(player.currentTime)
      timeLabel.textContent = `${formatTime(player.currentTime)} / ${formatTime(player.duration)} 秒`
      drawPlayhead()
    }
    if (player.isPlaying) {
      requestAnimationFrame(updateLoop)
    }
  }

  player.onEnded = () => {
    playPauseButton.textContent = '再生'
    seekInput.value = String(player.duration)
    timeLabel.textContent = `${formatTime(player.duration)} / ${formatTime(player.duration)} 秒`
    drawPlayhead()
  }

  playPauseButton.addEventListener('click', () => {
    void ctx.resume()
    if (player.isPlaying) {
      player.pause()
      playPauseButton.textContent = '再生'
    } else {
      player.play()
      playPauseButton.textContent = '一時停止'
      requestAnimationFrame(updateLoop)
    }
  })

  seekInput.addEventListener('pointerdown', () => {
    draggingSeek = true
  })
  seekInput.addEventListener('input', () => {
    timeLabel.textContent = `${formatTime(Number(seekInput.value))} / ${formatTime(player.duration)} 秒`
    const ratio =
      player.duration > 0 ? Number(seekInput.value) / player.duration : 0
    renderPlayhead(playheadCanvas, ratio, playheadColor)
  })
  seekInput.addEventListener('change', () => {
    player.seek(Number(seekInput.value))
    draggingSeek = false
  })

  window.addEventListener('resize', () => {
    renderWaveform(waveformCanvas, strain, waveformColor)
    drawPlayhead()
  })

  return player
}

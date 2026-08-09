import { StrainPlayer } from '../audio/strain-player'

export interface PlaybackControlElements {
  playPauseButton: HTMLButtonElement
  seekInput: HTMLInputElement
  timeLabel: HTMLSpanElement
}

const formatTime = (t: number) => t.toFixed(1)

// 再生/一時停止ボタン・シークバー・時間表示の配線をまとめた共通ロジック。
// 波形のプレイヘッド、軌道アニメーションなど「再生位置に応じて何を描くか」は
// renderコールバックとして呼び出し側が渡す。
export function setupPlaybackControls(
  ctx: AudioContext,
  elements: PlaybackControlElements,
  strain: Float32Array,
  sampleRate: number,
  render: (currentTime: number) => void,
): StrainPlayer {
  const { playPauseButton, seekInput, timeLabel } = elements

  const player = new StrainPlayer(ctx)
  player.load(strain, sampleRate)

  seekInput.max = String(player.duration)
  timeLabel.textContent = `0.0 / ${formatTime(player.duration)} 秒`
  render(0)

  let draggingSeek = false

  const updateLoop = () => {
    if (!draggingSeek) {
      seekInput.value = String(player.currentTime)
      timeLabel.textContent = `${formatTime(player.currentTime)} / ${formatTime(player.duration)} 秒`
      render(player.currentTime)
    }
    if (player.isPlaying) {
      requestAnimationFrame(updateLoop)
    }
  }

  player.onEnded = () => {
    playPauseButton.textContent = '再生'
    seekInput.value = String(player.duration)
    timeLabel.textContent = `${formatTime(player.duration)} / ${formatTime(player.duration)} 秒`
    render(player.duration)
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
    const t = Number(seekInput.value)
    timeLabel.textContent = `${formatTime(t)} / ${formatTime(player.duration)} 秒`
    render(t)
  })
  seekInput.addEventListener('change', () => {
    player.seek(Number(seekInput.value))
    draggingSeek = false
  })

  return player
}

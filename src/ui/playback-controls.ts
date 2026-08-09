import { StrainPlayer } from '../audio/strain-player'

export interface PlaybackControlElements {
  playPauseButton: HTMLButtonElement
  seekInput: HTMLInputElement
  timeLabel: HTMLSpanElement
}

export interface PlaybackControlsHandle {
  player: StrainPlayer
  dispose: () => void
}

const formatTime = (t: number) => t.toFixed(1)

// 再生/一時停止ボタン・シークバー・時間表示の配線をまとめた共通ロジック。
// 波形のプレイヘッド、軌道アニメーションなど「再生位置に応じて何を描くか」は
// renderコールバックとして呼び出し側が渡す。
//
// ボタン/シークバーのDOM要素はイベント切り替え時にも使い回すため、
// 呼び出すたびにラベルをリセットし、disposeで今回分のリスナーだけを
// 確実に取り除けるようにする(取り除かないと、古いイベントの
// AudioContextを操作するリスナーが残り続けてしまう)。
export function setupPlaybackControls(
  ctx: AudioContext,
  elements: PlaybackControlElements,
  strain: Float32Array,
  sampleRate: number,
  render: (currentTime: number) => void,
): PlaybackControlsHandle {
  const { playPauseButton, seekInput, timeLabel } = elements

  const player = new StrainPlayer(ctx)
  player.load(strain, sampleRate)

  playPauseButton.textContent = '再生'
  seekInput.value = '0'
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

  const onPlayPauseClick = () => {
    void ctx.resume()
    if (player.isPlaying) {
      player.pause()
      playPauseButton.textContent = '再生'
    } else {
      player.play()
      playPauseButton.textContent = '一時停止'
      requestAnimationFrame(updateLoop)
    }
  }
  const onSeekPointerDown = () => {
    draggingSeek = true
  }
  const onSeekInput = () => {
    const t = Number(seekInput.value)
    timeLabel.textContent = `${formatTime(t)} / ${formatTime(player.duration)} 秒`
    render(t)
  }
  const onSeekChange = () => {
    player.seek(Number(seekInput.value))
    draggingSeek = false
  }

  playPauseButton.addEventListener('click', onPlayPauseClick)
  seekInput.addEventListener('pointerdown', onSeekPointerDown)
  seekInput.addEventListener('input', onSeekInput)
  seekInput.addEventListener('change', onSeekChange)

  return {
    player,
    dispose: () => {
      player.pause()
      playPauseButton.removeEventListener('click', onPlayPauseClick)
      seekInput.removeEventListener('pointerdown', onSeekPointerDown)
      seekInput.removeEventListener('input', onSeekInput)
      seekInput.removeEventListener('change', onSeekChange)
    },
  }
}

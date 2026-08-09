import './style.css'
import { loadGw150914 } from './data/gw150914'
import { StrainPlayer } from './audio/strain-player'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <h1>重力波プレイヤー</h1>
  <p id="status">GW150914のデータを読み込み中...</p>
  <div id="player" class="player" hidden>
    <button id="play-pause" type="button">再生</button>
    <input id="seek" type="range" min="0" max="1" step="0.001" value="0" />
    <span id="time">0.0 / 0.0 秒</span>
  </div>
`

const status = document.querySelector<HTMLParagraphElement>('#status')!
const playerEl = document.querySelector<HTMLDivElement>('#player')!
const playPauseButton = document.querySelector<HTMLButtonElement>('#play-pause')!
const seekInput = document.querySelector<HTMLInputElement>('#seek')!
const timeLabel = document.querySelector<HTMLSpanElement>('#time')!

const formatTime = (t: number) => t.toFixed(1)

loadGw150914()
  .then(({ meta, strain }) => {
    status.textContent = `${meta.event} (${meta.detector} / ${meta.sampleRate}Hz)`

    const ctx = new AudioContext()
    const player = new StrainPlayer(ctx)
    player.load(strain, meta.sampleRate)

    seekInput.max = String(player.duration)
    timeLabel.textContent = `0.0 / ${formatTime(player.duration)} 秒`
    playerEl.hidden = false

    let draggingSeek = false

    const updateLoop = () => {
      if (!draggingSeek) {
        seekInput.value = String(player.currentTime)
        timeLabel.textContent = `${formatTime(player.currentTime)} / ${formatTime(player.duration)} 秒`
      }
      if (player.isPlaying) {
        requestAnimationFrame(updateLoop)
      }
    }

    player.onEnded = () => {
      playPauseButton.textContent = '再生'
      seekInput.value = String(player.duration)
      timeLabel.textContent = `${formatTime(player.duration)} / ${formatTime(player.duration)} 秒`
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
    })
    seekInput.addEventListener('change', () => {
      player.seek(Number(seekInput.value))
      draggingSeek = false
    })
  })
  .catch((err: unknown) => {
    status.textContent = 'データの読み込みに失敗しました。'
    console.error(err)
  })

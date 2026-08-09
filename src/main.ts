import './style.css'
import { loadGw150914 } from './data/gw150914'
import { StrainPlayer } from './audio/strain-player'
import { renderWaveform, renderPlayhead } from './graph/waveform'
import { computePsdWelch } from './dsp/psd'
import { renderSpectrum } from './graph/spectrum'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <h1>重力波プレイヤー</h1>
  <p id="status">GW150914のデータを読み込み中...</p>
  <div class="waveform-wrap" id="waveform-wrap" hidden>
    <canvas id="waveform-canvas"></canvas>
    <canvas id="playhead-canvas"></canvas>
  </div>
  <div id="player" class="player" hidden>
    <button id="play-pause" type="button">再生</button>
    <input id="seek" type="range" min="0" max="1" step="0.001" value="0" />
    <span id="time">0.0 / 0.0 秒</span>
  </div>
  <div id="spectrum-section" hidden>
    <h2>周波数成分（PSD）</h2>
    <p class="explain">
      PSD（パワースペクトル密度）は、信号にどの周波数がどれくらい強く
      含まれているかを表すグラフです。山になっている部分は検出器自身の
      ノイズが大きい周波数帯を示しています。次のステップの
      「ホワイトニング」では、この山を平らにならすことでノイズの影響を
      抑え、重力波の信号を見つけやすくします。
    </p>
    <div class="graph-wrap">
      <canvas id="spectrum-canvas"></canvas>
    </div>
  </div>
`

const status = document.querySelector<HTMLParagraphElement>('#status')!
const waveformWrap = document.querySelector<HTMLDivElement>('#waveform-wrap')!
const waveformCanvas =
  document.querySelector<HTMLCanvasElement>('#waveform-canvas')!
const playheadCanvas =
  document.querySelector<HTMLCanvasElement>('#playhead-canvas')!
const playerEl = document.querySelector<HTMLDivElement>('#player')!
const playPauseButton = document.querySelector<HTMLButtonElement>('#play-pause')!
const seekInput = document.querySelector<HTMLInputElement>('#seek')!
const timeLabel = document.querySelector<HTMLSpanElement>('#time')!
const spectrumSection = document.querySelector<HTMLDivElement>('#spectrum-section')!
const spectrumCanvas =
  document.querySelector<HTMLCanvasElement>('#spectrum-canvas')!

const formatTime = (t: number) => t.toFixed(1)
const PLAYHEAD_COLOR = '#e63946'
const WAVEFORM_COLOR = '#3a5ba0'
const SPECTRUM_COLOR = '#3a5ba0'
const SPECTRUM_MIN_FREQ = 10 // Hz。これより低い帯域は地面振動などのノイズが支配的
const SPECTRUM_MAX_FREQ = 2000 // Hz (Nyquist=2048未満の見やすい範囲)

loadGw150914()
  .then(({ meta, strain }) => {
    status.textContent = `${meta.event} (${meta.detector} / ${meta.sampleRate}Hz)`

    const ctx = new AudioContext()
    const player = new StrainPlayer(ctx)
    player.load(strain, meta.sampleRate)

    seekInput.max = String(player.duration)
    timeLabel.textContent = `0.0 / ${formatTime(player.duration)} 秒`
    playerEl.hidden = false
    waveformWrap.hidden = false
    renderWaveform(waveformCanvas, strain, WAVEFORM_COLOR)

    const { frequencies, psd } = computePsdWelch(strain, meta.sampleRate)
    spectrumSection.hidden = false
    renderSpectrum(spectrumCanvas, frequencies, psd, SPECTRUM_COLOR, {
      minFreq: SPECTRUM_MIN_FREQ,
      maxFreq: SPECTRUM_MAX_FREQ,
    })

    const drawPlayhead = () => {
      const ratio = player.duration > 0 ? player.currentTime / player.duration : 0
      renderPlayhead(playheadCanvas, ratio, PLAYHEAD_COLOR)
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
      renderPlayhead(playheadCanvas, ratio, PLAYHEAD_COLOR)
    })
    seekInput.addEventListener('change', () => {
      player.seek(Number(seekInput.value))
      draggingSeek = false
    })

    window.addEventListener('resize', () => {
      renderWaveform(waveformCanvas, strain, WAVEFORM_COLOR)
      drawPlayhead()
      renderSpectrum(spectrumCanvas, frequencies, psd, SPECTRUM_COLOR, {
        minFreq: SPECTRUM_MIN_FREQ,
        maxFreq: SPECTRUM_MAX_FREQ,
      })
    })
  })
  .catch((err: unknown) => {
    status.textContent = 'データの読み込みに失敗しました。'
    console.error(err)
  })

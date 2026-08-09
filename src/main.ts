import './style.css'
import { loadGw150914 } from './data/gw150914'
import { computePsdWelch } from './dsp/psd'
import { whiten } from './dsp/whiten'
import { renderSpectrum } from './graph/spectrum'
import { setupPlayerSection } from './ui/player-section'
import type { PlayerSectionElements } from './ui/player-section'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <h1>重力波プレイヤー</h1>
  <p id="status">GW150914のデータを読み込み中...</p>

  <div class="waveform-wrap" id="raw-waveform-wrap" hidden>
    <canvas id="raw-waveform-canvas"></canvas>
    <canvas id="raw-playhead-canvas"></canvas>
  </div>
  <div id="raw-player" class="player" hidden>
    <button id="raw-play-pause" type="button">再生</button>
    <input id="raw-seek" type="range" min="0" max="1" step="0.001" value="0" />
    <span id="raw-time">0.0 / 0.0 秒</span>
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
    <h3>無加工データのPSD</h3>
    <div class="graph-wrap">
      <canvas id="spectrum-canvas"></canvas>
    </div>
  </div>

  <div id="whiten-section" hidden>
    <h2>ホワイトニング後の音声</h2>
    <p class="explain">
      ホワイトニングは、上のPSDグラフで見えていた「山」を打ち消すように
      各周波数の強さを均一にする処理です。検出器特有のノイズが減り、
      重力波信号がより聞き取りやすく・見やすくなります。
    </p>
    <div class="waveform-wrap" id="whiten-waveform-wrap">
      <canvas id="whiten-waveform-canvas"></canvas>
      <canvas id="whiten-playhead-canvas"></canvas>
    </div>
    <div id="whiten-player" class="player">
      <button id="whiten-play-pause" type="button">再生</button>
      <input id="whiten-seek" type="range" min="0" max="1" step="0.001" value="0" />
      <span id="whiten-time">0.0 / 0.0 秒</span>
    </div>
    <h3>ホワイトニング後のPSD</h3>
    <div class="graph-wrap">
      <canvas id="whiten-spectrum-canvas"></canvas>
    </div>
  </div>
`

const status = document.querySelector<HTMLParagraphElement>('#status')!

function getPlayerSectionElements(prefix: string): PlayerSectionElements {
  return {
    waveformCanvas: document.querySelector<HTMLCanvasElement>(
      `#${prefix}-waveform-canvas`,
    )!,
    playheadCanvas: document.querySelector<HTMLCanvasElement>(
      `#${prefix}-playhead-canvas`,
    )!,
    playPauseButton: document.querySelector<HTMLButtonElement>(
      `#${prefix}-play-pause`,
    )!,
    seekInput: document.querySelector<HTMLInputElement>(`#${prefix}-seek`)!,
    timeLabel: document.querySelector<HTMLSpanElement>(`#${prefix}-time`)!,
  }
}

const rawWaveformWrap = document.querySelector<HTMLDivElement>('#raw-waveform-wrap')!
const rawPlayerEl = document.querySelector<HTMLDivElement>('#raw-player')!
const spectrumSection = document.querySelector<HTMLDivElement>('#spectrum-section')!
const spectrumCanvas =
  document.querySelector<HTMLCanvasElement>('#spectrum-canvas')!
const whitenSection = document.querySelector<HTMLDivElement>('#whiten-section')!
const whitenSpectrumCanvas = document.querySelector<HTMLCanvasElement>(
  '#whiten-spectrum-canvas',
)!

const WAVEFORM_COLOR = '#3a5ba0'
const WHITEN_WAVEFORM_COLOR = '#3a8a5b'
const PLAYHEAD_COLOR = '#e63946'
const SPECTRUM_COLOR = '#3a5ba0'
const WHITEN_SPECTRUM_COLOR = '#3a8a5b'
const SPECTRUM_MIN_FREQ = 10 // Hz。これより低い帯域は地面振動などのノイズが支配的
const SPECTRUM_MAX_FREQ = 2000 // Hz (Nyquist=2048未満の見やすい範囲)

loadGw150914()
  .then(({ meta, strain }) => {
    status.textContent = `${meta.event} (${meta.detector} / ${meta.sampleRate}Hz)`

    const ctx = new AudioContext()

    rawPlayerEl.hidden = false
    rawWaveformWrap.hidden = false
    setupPlayerSection(
      ctx,
      getPlayerSectionElements('raw'),
      strain,
      meta.sampleRate,
      WAVEFORM_COLOR,
      PLAYHEAD_COLOR,
    )

    const { frequencies, psd } = computePsdWelch(strain, meta.sampleRate)
    spectrumSection.hidden = false
    renderSpectrum(spectrumCanvas, frequencies, psd, SPECTRUM_COLOR, {
      minFreq: SPECTRUM_MIN_FREQ,
      maxFreq: SPECTRUM_MAX_FREQ,
    })

    const whitened = whiten(strain, meta.sampleRate)
    whitenSection.hidden = false
    setupPlayerSection(
      ctx,
      getPlayerSectionElements('whiten'),
      whitened,
      meta.sampleRate,
      WHITEN_WAVEFORM_COLOR,
      PLAYHEAD_COLOR,
    )

    const whitenSpectrum = computePsdWelch(whitened, meta.sampleRate)
    renderSpectrum(
      whitenSpectrumCanvas,
      whitenSpectrum.frequencies,
      whitenSpectrum.psd,
      WHITEN_SPECTRUM_COLOR,
      { minFreq: SPECTRUM_MIN_FREQ, maxFreq: SPECTRUM_MAX_FREQ },
    )

    window.addEventListener('resize', () => {
      renderSpectrum(spectrumCanvas, frequencies, psd, SPECTRUM_COLOR, {
        minFreq: SPECTRUM_MIN_FREQ,
        maxFreq: SPECTRUM_MAX_FREQ,
      })
      renderSpectrum(
        whitenSpectrumCanvas,
        whitenSpectrum.frequencies,
        whitenSpectrum.psd,
        WHITEN_SPECTRUM_COLOR,
        { minFreq: SPECTRUM_MIN_FREQ, maxFreq: SPECTRUM_MAX_FREQ },
      )
    })
  })
  .catch((err: unknown) => {
    status.textContent = 'データの読み込みに失敗しました。'
    console.error(err)
  })

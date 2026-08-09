import './style.css'
import { loadGw150914 } from './data/gw150914'
import { computePsdWelch } from './dsp/psd'
import { whiten } from './dsp/whiten'
import { bandpass } from './dsp/bandpass'
import { renderSpectrum } from './graph/spectrum'
import { setupPlayerSection } from './ui/player-section'
import type { PlayerSectionElements } from './ui/player-section'
import { createInspiralModel } from './physics/inspiral'
import { setupAnimationSection } from './ui/animation-section'
import type { AnimationSectionElements } from './ui/animation-section'

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

  <div id="bandpass-section" hidden>
    <h2>バンドパス後の音声</h2>
    <p class="explain">
      バンドパスは、指定した周波数帯だけを通すフィルタです。GW150914の
      ようなブラックホール合体の重力波信号は主に35〜350Hzの帯域にあるため、
      それ以外の周波数を取り除くことで、重力波の「チャープ音」がさらに
      はっきり聞こえるようになります。
    </p>
    <div class="waveform-wrap" id="bandpass-waveform-wrap">
      <canvas id="bandpass-waveform-canvas"></canvas>
      <canvas id="bandpass-playhead-canvas"></canvas>
    </div>
    <div id="bandpass-player" class="player">
      <button id="bandpass-play-pause" type="button">再生</button>
      <input id="bandpass-seek" type="range" min="0" max="1" step="0.001" value="0" />
      <span id="bandpass-time">0.0 / 0.0 秒</span>
    </div>
    <h3>バンドパス後のPSD</h3>
    <div class="graph-wrap">
      <canvas id="bandpass-spectrum-canvas"></canvas>
    </div>
  </div>

  <div id="animation-section" hidden>
    <h2>ブラックホール合体のアニメーション</h2>
    <p class="explain">
      GW150914は、太陽の約36倍と29倍の質量を持つ2つのブラックホールが
      合体したときに発生した重力波です。バンドパス後の音声に合わせて、
      実際の質量から計算した軌道の様子を表示しています（数値相対論による
      厳密なシミュレーションではなく、教育目的の簡略化した模式図です）。
    </p>
    <div class="orbit-wrap">
      <canvas id="orbit-canvas"></canvas>
    </div>
    <div id="orbit-player" class="player">
      <button id="orbit-play-pause" type="button">再生</button>
      <input id="orbit-seek" type="range" min="0" max="1" step="0.001" value="0" />
      <span id="orbit-time">0.0 / 0.0 秒</span>
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
const bandpassSection =
  document.querySelector<HTMLDivElement>('#bandpass-section')!
const bandpassSpectrumCanvas = document.querySelector<HTMLCanvasElement>(
  '#bandpass-spectrum-canvas',
)!
const animationSection =
  document.querySelector<HTMLDivElement>('#animation-section')!

const WAVEFORM_COLOR = '#3a5ba0'
const WHITEN_WAVEFORM_COLOR = '#3a8a5b'
const BANDPASS_WAVEFORM_COLOR = '#a0653a'
const PLAYHEAD_COLOR = '#e63946'
const SPECTRUM_COLOR = '#3a5ba0'
const WHITEN_SPECTRUM_COLOR = '#3a8a5b'
const BANDPASS_SPECTRUM_COLOR = '#a0653a'
const SPECTRUM_MIN_FREQ = 10 // Hz。これより低い帯域は地面振動などのノイズが支配的
const SPECTRUM_MAX_FREQ = 2000 // Hz (Nyquist=2048未満の見やすい範囲)
// GW150914の信号が主に含まれる帯域（GWOSCチュートリアル等で使われる代表的な値）
const BANDPASS_LOW_FREQ = 35
const BANDPASS_HIGH_FREQ = 350

// GW150914の質量パラメータと合体時刻(Abbott et al. 2016で公表された値)
const GW150914_M1_SOLAR_MASSES = 36
const GW150914_M2_SOLAR_MASSES = 29
const GW150914_MERGER_GPS = 1126259462.423
const ORBIT_COLORS = { body1: '#3a5ba0', body2: '#a0653a', merged: '#6b3a8a' }

function getAnimationSectionElements(): AnimationSectionElements {
  return {
    orbitCanvas: document.querySelector<HTMLCanvasElement>('#orbit-canvas')!,
    playPauseButton: document.querySelector<HTMLButtonElement>(
      '#orbit-play-pause',
    )!,
    seekInput: document.querySelector<HTMLInputElement>('#orbit-seek')!,
    timeLabel: document.querySelector<HTMLSpanElement>('#orbit-time')!,
  }
}

function drawAllSpectra(
  spectra: {
    canvas: HTMLCanvasElement
    frequencies: Float64Array
    psd: Float64Array
    color: string
  }[],
) {
  for (const s of spectra) {
    renderSpectrum(s.canvas, s.frequencies, s.psd, s.color, {
      minFreq: SPECTRUM_MIN_FREQ,
      maxFreq: SPECTRUM_MAX_FREQ,
    })
  }
}

async function main() {
  const { meta, strain } = await loadGw150914()
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

  const rawSpectrum = computePsdWelch(strain, meta.sampleRate)
  spectrumSection.hidden = false

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

  const bandpassed = await bandpass(
    whitened,
    meta.sampleRate,
    BANDPASS_LOW_FREQ,
    BANDPASS_HIGH_FREQ,
  )
  bandpassSection.hidden = false
  setupPlayerSection(
    ctx,
    getPlayerSectionElements('bandpass'),
    bandpassed,
    meta.sampleRate,
    BANDPASS_WAVEFORM_COLOR,
    PLAYHEAD_COLOR,
  )
  const bandpassSpectrum = computePsdWelch(bandpassed, meta.sampleRate)

  const mergerTime = GW150914_MERGER_GPS - meta.gpsStart
  const inspiralModel = createInspiralModel(
    GW150914_M1_SOLAR_MASSES,
    GW150914_M2_SOLAR_MASSES,
    mergerTime,
    meta.duration,
  )
  animationSection.hidden = false
  setupAnimationSection(
    ctx,
    getAnimationSectionElements(),
    bandpassed,
    meta.sampleRate,
    inspiralModel,
    ORBIT_COLORS,
  )

  const spectra = [
    { canvas: spectrumCanvas, ...rawSpectrum, color: SPECTRUM_COLOR },
    {
      canvas: whitenSpectrumCanvas,
      ...whitenSpectrum,
      color: WHITEN_SPECTRUM_COLOR,
    },
    {
      canvas: bandpassSpectrumCanvas,
      ...bandpassSpectrum,
      color: BANDPASS_SPECTRUM_COLOR,
    },
  ]
  drawAllSpectra(spectra)
  window.addEventListener('resize', () => drawAllSpectra(spectra))
}

main().catch((err: unknown) => {
  status.textContent = 'データの読み込みに失敗しました。'
  console.error(err)
})

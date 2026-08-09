import './style.css'
import { loadGw150914 } from './data/gw150914'
import { resolveEvent } from './data/gwosc-api'
import { fetchStrainFromGwosc } from './data/remote-strain'
import { EVENT_CATALOG, DEFAULT_EVENT_ID } from './data/catalog'
import type { StrainData } from './data/types'
import { computePsdWelch } from './dsp/psd'
import { whiten } from './dsp/whiten'
import { bandpass } from './dsp/bandpass'
import { renderSpectrum } from './graph/spectrum'
import { setupPlayerSection } from './ui/player-section'
import type { PlayerSectionElements } from './ui/player-section'
import { createInspiralModel, estimateMergerFrequency } from './physics/inspiral'
import { setupHeroSection } from './ui/hero-section'
import type { HeroSectionElements } from './ui/hero-section'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <h1>重力波プレイヤー</h1>

  <div class="event-picker">
    <label for="event-select">重力波イベント</label>
    <select id="event-select">
      ${EVENT_CATALOG.map((e) => `<option value="${e.id}">${e.label} — ${e.hint}</option>`).join('')}
    </select>
    <p id="event-blurb" class="explain"></p>
  </div>

  <p id="status">GW150914のデータを読み込み中...</p>

  <div id="hero-section" hidden>
    <h2 id="hero-heading">見る・聴く</h2>
    <p id="hero-explain" class="explain"></p>
    <div class="orbit-wrap" id="hero-orbit-wrap">
      <canvas id="hero-orbit-canvas"></canvas>
      <p id="hero-rotation-rate" class="rotation-rate-overlay">回転数: - 回/秒</p>
    </div>
    <div class="rotation-graph-wrap" id="hero-rotation-graph-wrap">
      <canvas id="hero-rotation-curve-canvas"></canvas>
      <canvas id="hero-rotation-playhead-canvas"></canvas>
    </div>
    <div class="waveform-wrap" id="hero-waveform-wrap">
      <canvas id="hero-waveform-canvas"></canvas>
      <canvas id="hero-playhead-canvas"></canvas>
    </div>
    <div id="hero-player" class="player">
      <button id="hero-play-pause" type="button">再生</button>
      <input id="hero-seek" type="range" min="0" max="1" step="0.001" value="0" />
      <span id="hero-time">0.0 / 0.0 秒</span>
    </div>
  </div>

  <h2>重力波信号を取り出す4つのステップ</h2>
  <p class="explain">
    ここからは、無加工の観測データから重力波の「チャープ音」を取り出す
    手順を、実際のデータを見聴きしながら順番に確認していきます。
  </p>

  <h3>1. 無加工データ</h3>
  <p id="raw-explain" class="explain"></p>
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
    <h3>2. 周波数成分（PSD）</h3>
    <p class="explain">
      PSD（パワースペクトル密度）は、信号にどの周波数がどれくらい強く
      含まれているかを表すグラフです。山になっている部分は検出器自身の
      ノイズが大きい周波数帯を示しています。次のステップの
      「ホワイトニング」では、この山を平らにならすことでノイズの影響を
      抑え、重力波の信号を見つけやすくします。
    </p>
    <h4>無加工データのPSD</h4>
    <div class="graph-wrap">
      <canvas id="spectrum-canvas"></canvas>
    </div>
  </div>

  <div id="whiten-section" hidden>
    <h3>3. ホワイトニング</h3>
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
    <h4>ホワイトニング後のPSD</h4>
    <div class="graph-wrap">
      <canvas id="whiten-spectrum-canvas"></canvas>
    </div>
  </div>

  <div id="bandpass-section" hidden>
    <h3>4. バンドパス</h3>
    <p id="bandpass-explain" class="explain"></p>
    <div class="waveform-wrap" id="bandpass-waveform-wrap">
      <canvas id="bandpass-waveform-canvas"></canvas>
      <canvas id="bandpass-playhead-canvas"></canvas>
    </div>
    <div id="bandpass-player" class="player">
      <button id="bandpass-play-pause" type="button">再生</button>
      <input id="bandpass-seek" type="range" min="0" max="1" step="0.001" value="0" />
      <span id="bandpass-time">0.0 / 0.0 秒</span>
    </div>
    <h4>バンドパス後のPSD</h4>
    <div class="graph-wrap">
      <canvas id="bandpass-spectrum-canvas"></canvas>
    </div>
  </div>
`

const status = document.querySelector<HTMLParagraphElement>('#status')!
const eventSelect = document.querySelector<HTMLSelectElement>('#event-select')!
const eventBlurb = document.querySelector<HTMLParagraphElement>('#event-blurb')!
const heroHeading = document.querySelector<HTMLHeadingElement>('#hero-heading')!
const heroExplain = document.querySelector<HTMLParagraphElement>('#hero-explain')!
const rawExplain = document.querySelector<HTMLParagraphElement>('#raw-explain')!
const bandpassExplain =
  document.querySelector<HTMLParagraphElement>('#bandpass-explain')!

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

function getHeroSectionElements(): HeroSectionElements {
  return {
    orbitWrap: document.querySelector<HTMLDivElement>('#hero-orbit-wrap')!,
    orbitCanvas: document.querySelector<HTMLCanvasElement>('#hero-orbit-canvas')!,
    rotationGraphWrap: document.querySelector<HTMLDivElement>(
      '#hero-rotation-graph-wrap',
    )!,
    rotationCurveCanvas: document.querySelector<HTMLCanvasElement>(
      '#hero-rotation-curve-canvas',
    )!,
    rotationPlayheadCanvas: document.querySelector<HTMLCanvasElement>(
      '#hero-rotation-playhead-canvas',
    )!,
    rotationRateLabel: document.querySelector<HTMLParagraphElement>(
      '#hero-rotation-rate',
    )!,
    waveformCanvas: document.querySelector<HTMLCanvasElement>(
      '#hero-waveform-canvas',
    )!,
    playheadCanvas: document.querySelector<HTMLCanvasElement>(
      '#hero-playhead-canvas',
    )!,
    playPauseButton: document.querySelector<HTMLButtonElement>('#hero-play-pause')!,
    seekInput: document.querySelector<HTMLInputElement>('#hero-seek')!,
    timeLabel: document.querySelector<HTMLSpanElement>('#hero-time')!,
  }
}

const heroSection = document.querySelector<HTMLDivElement>('#hero-section')!
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

const WAVEFORM_COLOR = '#3a5ba0'
const WHITEN_WAVEFORM_COLOR = '#3a8a5b'
const BANDPASS_WAVEFORM_COLOR = '#a0653a'
const PLAYHEAD_COLOR = '#e63946'
const SPECTRUM_COLOR = '#3a5ba0'
const WHITEN_SPECTRUM_COLOR = '#3a8a5b'
const BANDPASS_SPECTRUM_COLOR = '#a0653a'
const SPECTRUM_MIN_FREQ = 10 // Hz。これより低い帯域は地面振動などのノイズが支配的
const SPECTRUM_MAX_FREQ = 2000 // Hz (Nyquist=2048未満の見やすい範囲)
// GW150914は発見論文で「0.2秒で35→250Hz」と公表された著名な値をそのまま使う
const GW150914_BANDPASS = { low: 35, high: 350 }

// GW150914の質量パラメータと合体時刻(Abbott et al. 2016で公表された値)。
// 起動直後に表示する既定イベントのため、GWOSCへの追加リクエストなしで
// 即座に描画できるようこの値を使う。
const GW150914_M1_SOLAR_MASSES = 36
const GW150914_M2_SOLAR_MASSES = 29
const GW150914_MERGER_GPS = 1126259462.423
const ORBIT_COLORS = { body1: '#3a5ba0', body2: '#a0653a', merged: '#6b3a8a' }

// 中性子星(質量が数太陽質量以下)は整数に丸めると差が消えてしまうため、
// 小さい値は小数第1位まで表示する。
function formatSolarMasses(mass: number): string {
  return mass < 10 ? mass.toFixed(1) : mass.toFixed(0)
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

// GW150914以外のイベントは質量が様々なため、バンドパスの上限を
// そのイベントのおおよその合体時周波数から見積もる。下限は検出器の
// 低周波ノイズの壁による部分が大きく、事象によらずおおむね一定なので固定値を使う。
function getBandpassRange(
  eventId: string,
  masses: { m1: number; m2: number } | null,
  sampleRate: number,
): { low: number; high: number } {
  if (eventId === DEFAULT_EVENT_ID || !masses) {
    return GW150914_BANDPASS
  }
  const nyquist = sampleRate / 2
  const fPeak = estimateMergerFrequency(masses.m1, masses.m2)
  const low = GW150914_BANDPASS.low
  const high = Math.min(nyquist * 0.9, fPeak * 1.2)
  return { low, high: Math.max(high, low + 50) }
}

interface EventLoadResult {
  data: StrainData
  masses: { m1: number; m2: number } | null
  gpsMerger: number | null
}

async function loadEventStrain(eventId: string): Promise<EventLoadResult> {
  if (eventId === DEFAULT_EVENT_ID) {
    const data = await loadGw150914()
    return {
      data,
      masses: { m1: GW150914_M1_SOLAR_MASSES, m2: GW150914_M2_SOLAR_MASSES },
      gpsMerger: GW150914_MERGER_GPS,
    }
  }
  const resolved = await resolveEvent(eventId)
  const data = await fetchStrainFromGwosc(eventId, resolved.detector, resolved.downloadUrl)
  const masses =
    resolved.m1SolarMasses !== null && resolved.m2SolarMasses !== null
      ? { m1: resolved.m1SolarMasses, m2: resolved.m2SolarMasses }
      : null
  return { data, masses, gpsMerger: resolved.gpsMerger }
}

let activeAudioContext: AudioContext | null = null
let disposers: Array<() => void> = []
// loadAndRenderが完了する前に別のイベントが選択された場合、古い呼び出しが
// 後から結果を上書きしないようにするための世代カウンタ。
let loadToken = 0

function teardownPrevious() {
  for (const dispose of disposers) dispose()
  disposers = []
  if (activeAudioContext) {
    void activeAudioContext.close()
    activeAudioContext = null
  }
}

async function loadAndRender(eventId: string) {
  const myToken = ++loadToken
  teardownPrevious()
  eventSelect.disabled = true

  const catalogEntry = EVENT_CATALOG.find((e) => e.id === eventId)
  eventBlurb.textContent = catalogEntry?.blurb ?? ''

  heroSection.hidden = true
  rawPlayerEl.hidden = true
  rawWaveformWrap.hidden = true
  spectrumSection.hidden = true
  whitenSection.hidden = true
  bandpassSection.hidden = true
  status.textContent =
    eventId === DEFAULT_EVENT_ID
      ? `${eventId}のデータを読み込み中...`
      : `${eventId}のデータをGWOSCからダウンロード中...`

  try {
    const { data, masses, gpsMerger } = await loadEventStrain(eventId)
    if (myToken !== loadToken) return // 新しい選択が割り込んだので破棄

    const { meta, strain } = data
    status.textContent = `${meta.event} (${meta.detector} / ${meta.sampleRate}Hz)`

    const ctx = new AudioContext()
    activeAudioContext = ctx

    rawExplain.textContent = `${meta.event}をとらえた観測データそのものです。物理的な振幅のままでは小さすぎて聞こえないため、音量だけを調整しています(周波数などの加工はしていません)。`

    rawPlayerEl.hidden = false
    rawWaveformWrap.hidden = false
    const rawHandle = setupPlayerSection(
      ctx,
      getPlayerSectionElements('raw'),
      strain,
      meta.sampleRate,
      WAVEFORM_COLOR,
      PLAYHEAD_COLOR,
    )
    disposers.push(rawHandle.dispose)

    const rawSpectrum = computePsdWelch(strain, meta.sampleRate)
    spectrumSection.hidden = false

    const whitened = whiten(strain, meta.sampleRate)
    whitenSection.hidden = false
    const whitenHandle = setupPlayerSection(
      ctx,
      getPlayerSectionElements('whiten'),
      whitened,
      meta.sampleRate,
      WHITEN_WAVEFORM_COLOR,
      PLAYHEAD_COLOR,
    )
    disposers.push(whitenHandle.dispose)
    const whitenSpectrum = computePsdWelch(whitened, meta.sampleRate)

    const { low: bandpassLow, high: bandpassHigh } = getBandpassRange(
      eventId,
      masses,
      meta.sampleRate,
    )
    bandpassExplain.textContent = `バンドパスは、指定した周波数帯だけを通すフィルタです。${meta.event}の重力波信号は主に${bandpassLow}〜${Math.round(bandpassHigh)}Hzの帯域にあるため、それ以外の周波数を取り除くことで、重力波の「チャープ音」がさらにはっきり聞こえるようになります。この結果が、一番上のアニメーションで流れている音です。`

    const bandpassed = await bandpass(
      whitened,
      meta.sampleRate,
      bandpassLow,
      bandpassHigh,
    )
    if (myToken !== loadToken) return // 新しい選択が割り込んだので破棄
    bandpassSection.hidden = false
    const bandpassHandle = setupPlayerSection(
      ctx,
      getPlayerSectionElements('bandpass'),
      bandpassed,
      meta.sampleRate,
      BANDPASS_WAVEFORM_COLOR,
      PLAYHEAD_COLOR,
    )
    disposers.push(bandpassHandle.dispose)
    const bandpassSpectrum = computePsdWelch(bandpassed, meta.sampleRate)

    const inspiralModel =
      masses && gpsMerger !== null
        ? createInspiralModel(masses.m1, masses.m2, gpsMerger - meta.gpsStart, meta.duration)
        : null

    heroHeading.textContent = `${meta.event}を見る・聴く`
    heroExplain.textContent = masses
      ? `${meta.event}は、太陽の約${formatSolarMasses(masses.m1)}倍と${formatSolarMasses(masses.m2)}倍の質量を持つ2つの天体が合体したときに発生した重力波です。合体の様子・周波数の変化(チャープ)・音を、バンドパス後のデータで一緒に確認してみましょう。`
      : `${meta.event}の重力波データです。質量パラメータが取得できなかったため、合体アニメーションは表示していません。バンドパス後のデータで音と波形を確認してみましょう。`

    heroSection.hidden = false
    const heroHandle = setupHeroSection(
      ctx,
      getHeroSectionElements(),
      bandpassed,
      meta.sampleRate,
      BANDPASS_WAVEFORM_COLOR,
      PLAYHEAD_COLOR,
      inspiralModel,
      ORBIT_COLORS,
      ORBIT_COLORS.merged,
    )
    disposers.push(heroHandle.dispose)

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
    const onResize = () => drawAllSpectra(spectra)
    window.addEventListener('resize', onResize)
    disposers.push(() => window.removeEventListener('resize', onResize))
  } catch (err) {
    if (myToken !== loadToken) return // 古い呼び出しの失敗は無視
    status.textContent = `${eventId}のデータの読み込みに失敗しました。`
    console.error(err)
  } finally {
    if (myToken === loadToken) eventSelect.disabled = false
  }
}

eventSelect.value = DEFAULT_EVENT_ID
eventSelect.addEventListener('change', () => {
  void loadAndRender(eventSelect.value)
})

void loadAndRender(DEFAULT_EVENT_ID)

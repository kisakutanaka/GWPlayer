// GWOSCからGW150914の無加工strainデータ（H1, 4096Hz, 32秒）を取得し、
// ブラウザで扱いやすいFloat32バイナリ + メタデータJSONに変換する。
// ビルド時ではなく手動実行するデータ準備スクリプト（ランタイムはブラウザのみで完結させる）。
import { gunzipSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'

const SOURCE_URL =
  'https://gwosc.org/eventapi/json/GWTC-1-confident/GW150914/v3/H-H1_GWOSC_4KHZ_R1-1126259447-32.txt.gz'
const OUT_DIR = new URL('../public/data/gw150914/', import.meta.url)
const DETECTOR = 'H1'
const SAMPLE_RATE = 4096
const GPS_START = 1126259447
const DURATION = 32

async function main() {
  console.log(`Downloading ${SOURCE_URL}`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  }
  const gzipped = Buffer.from(await res.arrayBuffer())
  const text = gunzipSync(gzipped).toString('utf-8')

  const samples = text
    .split('\n')
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map(Number)

  const expected = SAMPLE_RATE * DURATION
  if (samples.length !== expected) {
    throw new Error(`Expected ${expected} samples, got ${samples.length}`)
  }

  const strain = new Float32Array(samples)

  await writeFile(new URL('h1-raw.f32', OUT_DIR), Buffer.from(strain.buffer))
  await writeFile(
    new URL('meta.json', OUT_DIR),
    JSON.stringify(
      {
        event: 'GW150914',
        detector: DETECTOR,
        sampleRate: SAMPLE_RATE,
        gpsStart: GPS_START,
        duration: DURATION,
        sampleCount: strain.length,
        strainFile: 'h1-raw.f32',
        strainFormat: 'float32le',
        source: SOURCE_URL,
      },
      null,
      2,
    ) + '\n',
  )

  console.log(`Wrote ${strain.length} samples to public/data/gw150914/h1-raw.f32`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

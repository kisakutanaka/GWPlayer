import type { StrainData } from './types'

// GWOSCのASCII strainファイル(*.txt.gz)を取得し、ブラウザ標準のDecompressionStream
// (Safari 16.4以降で利用可)で解凍してパースする。ヘッダの3行にサンプリングレートと
// 開始GPS時刻・長さが書かれているため、そこから実際の値を読み取る
// (ファイル名に含まれる"4KHZ"等は概算のラベルで、実際は4096Hzのように端数を持つため)。
export async function fetchStrainFromGwosc(
  eventName: string,
  detector: string,
  downloadUrl: string,
): Promise<StrainData> {
  const res = await fetch(downloadUrl)
  if (!res.ok || !res.body) {
    throw new Error(`ダウンロードに失敗しました: ${res.status} ${downloadUrl}`)
  }

  const decompressed = res.body.pipeThrough(new DecompressionStream('gzip'))
  const text = await new Response(decompressed).text()

  let sampleRate = 0
  let gpsStart = 0
  let duration = 0
  const samples: number[] = []

  for (const line of text.split('\n')) {
    if (line.length === 0) continue
    if (line.startsWith('#')) {
      const rateMatch = /(\d+(?:\.\d+)?)\s*samples per second/.exec(line)
      if (rateMatch) sampleRate = Number(rateMatch[1])
      const gpsMatch = /starting GPS (\d+) duration (\d+)/.exec(line)
      if (gpsMatch) {
        gpsStart = Number(gpsMatch[1])
        duration = Number(gpsMatch[2])
      }
      continue
    }
    samples.push(Number(line))
  }

  if (sampleRate === 0 || samples.length === 0) {
    throw new Error('strainファイルのヘッダまたはデータを解釈できませんでした')
  }

  return {
    meta: {
      event: eventName,
      detector,
      sampleRate,
      gpsStart,
      duration,
      sampleCount: samples.length,
    },
    strain: Float32Array.from(samples),
  }
}

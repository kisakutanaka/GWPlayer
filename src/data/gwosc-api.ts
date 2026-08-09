// GWOSCの公開API(gwosc.org/api/v2/...)からイベントのstrainファイルURLと
// 質量パラメータを解決する。GWOSCはCORSを全許可(access-control-allow-origin: *)
// しているため、ブラウザから直接fetchできる(検証済み)。
//
// 1つのイベントは複数の「バージョン」(カタログ改訂)を持ち、パラメータは版が
// 進むごとに更新されるが、strainファイル(観測データそのもの)は必ずしも
// 全バージョンに紐づいていない(後発の版がパラメータ更新のみで、実データは
// 旧版にしか登録されていないことがある)。そのため
// 「strainファイルは実際に存在する最新版、パラメータは存在する最新版」を
// それぞれ別々に、新しい方から探して採用する。

const API_BASE = 'https://gwosc.org/api/v2'
// 4kHz(実際は4096Hz)を優先。データ量が少なく、131072サンプルは2の冪でFFTに都合が良い
const PREFERRED_RATES_KHZ = [4, 16]
const PREFERRED_DETECTORS = ['H1', 'L1', 'V1']

export interface ResolvedEvent {
  eventName: string
  gpsMerger: number
  detector: string
  downloadUrl: string
  m1SolarMasses: number | null
  m2SolarMasses: number | null
}

interface EventVersionSummary {
  version: number
  detail_url: string
}

interface EventListResponse {
  name: string
  versions: EventVersionSummary[]
}

interface EventVersionDetail {
  gps: number
  strain_files_url: string
  parameters_url: string
}

interface StrainFileEntry {
  gps_start: number
  detector: string
  sample_rate_kHz: number
  duration: number
  file_format: string
  download_url: string
}

interface StrainFilesResponse {
  results: StrainFileEntry[]
  next: string | null
}

interface ParameterValue {
  name: string
  best: number
}

interface ParameterSet {
  is_preferred: boolean
  parameters: ParameterValue[]
}

interface ParametersResponse {
  results: ParameterSet[]
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`GWOSC APIエラー: ${res.status} ${url}`)
  }
  return (await res.json()) as T
}

async function fetchAllStrainFiles(url: string): Promise<StrainFileEntry[]> {
  const files: StrainFileEntry[] = []
  let next: string | null = url
  while (next) {
    const page: StrainFilesResponse = await fetchJson(next)
    files.push(...page.results)
    next = page.next
  }
  return files
}

function pickStrainFile(files: StrainFileEntry[]): StrainFileEntry | null {
  const candidates = files.filter((f) => f.duration === 32 && f.file_format === 'TXT')
  for (const rateKHz of PREFERRED_RATES_KHZ) {
    for (const detector of PREFERRED_DETECTORS) {
      const found = candidates.find(
        (f) => f.sample_rate_kHz === rateKHz && f.detector === detector,
      )
      if (found) return found
    }
    const anyDetector = candidates.find((f) => f.sample_rate_kHz === rateKHz)
    if (anyDetector) return anyDetector
  }
  return null
}

export async function resolveEvent(eventName: string): Promise<ResolvedEvent> {
  const event = await fetchJson<EventListResponse>(`${API_BASE}/events/${eventName}`)
  const versionsDesc = [...event.versions].sort((a, b) => b.version - a.version)

  let mergerGps: number | null = null
  let strainFile: StrainFileEntry | null = null
  let masses: { m1: number; m2: number } | null = null

  for (const v of versionsDesc) {
    const detail = await fetchJson<EventVersionDetail>(v.detail_url)

    if (!strainFile) {
      const files = await fetchAllStrainFiles(detail.strain_files_url)
      const picked = pickStrainFile(files)
      if (picked) {
        strainFile = picked
        mergerGps = detail.gps
      }
    }

    if (!masses) {
      const paramsResp = await fetchJson<ParametersResponse>(detail.parameters_url)
      if (paramsResp.results.length > 0) {
        const preferred =
          paramsResp.results.find((r) => r.is_preferred) ?? paramsResp.results[0]
        const byName = new Map(preferred.parameters.map((p) => [p.name, p.best]))
        const m1 = byName.get('mass_1_source')
        const m2 = byName.get('mass_2_source')
        if (m1 !== undefined && m2 !== undefined) {
          masses = { m1, m2 }
        }
      }
    }

    if (strainFile && masses) break
  }

  if (!strainFile || mergerGps === null) {
    throw new Error(`${eventName}: 32秒のstrainデータ(TXT形式)が見つかりませんでした`)
  }

  return {
    eventName,
    gpsMerger: mergerGps,
    detector: strainFile.detector,
    downloadUrl: strainFile.download_url,
    m1SolarMasses: masses?.m1 ?? null,
    m2SolarMasses: masses?.m2 ?? null,
  }
}

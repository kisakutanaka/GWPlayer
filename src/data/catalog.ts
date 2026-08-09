export interface CatalogEntry {
  id: string // GWOSCのイベント名
  label: string // プルダウンの表示名
  blurb?: string // 有名イベント向けの短い補足コメント
}

// GWOSCのAPIで実在・32秒のstrainデータ(TXT形式)が取得可能であることを確認済みのイベント。
export const EVENT_CATALOG: CatalogEntry[] = [
  {
    id: 'GW150914',
    label: 'GW150914 (2015)',
    blurb: '人類初の重力波直接検出。太陽の約36倍と29倍のブラックホールの合体。',
  },
  {
    id: 'GW151226',
    label: 'GW151226 (2015)',
    blurb: '2例目の検出（愛称「Boxing Day event」）。GW150914より軽いブラックホール連星。',
  },
  {
    id: 'GW170608',
    label: 'GW170608 (2017)',
    blurb: 'これまでで最も軽い部類のブラックホール連星の合体。',
  },
  {
    id: 'GW170817',
    label: 'GW170817 (2017)',
    blurb: '中性子星同士の合体。重力波と光（ガンマ線バースト等）が同時に観測された史上初のマルチメッセンジャー観測。',
  },
  {
    id: 'GW190521',
    label: 'GW190521 (2019)',
    blurb: 'これまでで最も重い部類のブラックホール合体。中間質量ブラックホールが誕生したとされる。',
  },
]

export const DEFAULT_EVENT_ID = 'GW150914'

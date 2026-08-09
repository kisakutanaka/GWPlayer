import './style.css'
import { loadGw150914 } from './data/gw150914'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <h1>重力波プレイヤー</h1>
  <p id="status">GW150914のデータを読み込み中...</p>
`

const status = document.querySelector<HTMLParagraphElement>('#status')!

loadGw150914()
  .then(({ meta, strain }) => {
    status.textContent = `${meta.event} (${meta.detector}) のデータを読み込みました: ${strain.length}サンプル / ${meta.sampleRate}Hz`
  })
  .catch((err: unknown) => {
    status.textContent = 'データの読み込みに失敗しました。'
    console.error(err)
  })

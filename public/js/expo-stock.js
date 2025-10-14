// expo-stock.js — 展場庫存管理
// v1.0.0 — 2025-10-14 (Asia/Taipei)
// 需求：
// 1) 搜尋 SKU / 名稱
// 2) 三種操作：搬去展場、退回店內、展場售出
// 3) Firestore 即時同步（onSnapshot）
// 4) 操作採 runTransaction，避免多人同時操作造成覆寫
// 5) 採 Rabbithome 既有 firebase.js (v11.10.0)，且以 window.onload 啟動（支援 iframe 載入）

import { 
  collection, doc, onSnapshot, query, orderBy, runTransaction, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const db = window.__RABBIT_DB__

const TPE = 'Asia/Taipei'
const dtFmt = new Intl.DateTimeFormat('zh-TW', { timeZone: TPE, month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })

let allItems = []   // 快取：全部商品
let filtered = []   // 搜尋結果

const $ = (s, r=document) => r.querySelector(s)
const tbody = $('#tbody')
const searchInput = $('#searchInput')
const countBadge = $('#countBadge')

window.onload = () => {
  bootstrap()
}

function bootstrap() {
  bindSearch()
  listenStocks()
  bindOps()
}

function bindSearch() {
  let timer = null
  searchInput.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const kw = searchInput.value.trim().toLowerCase()
      if (!kw) {
        filtered = [...allItems]
      } else {
        filtered = allItems.filter(it => {
          const sku = String(it.sku || '').toLowerCase()
          const name = String(it.name || '').toLowerCase()
          return sku.includes(kw) || name.includes(kw)
        })
      }
      render()
    }, 120)
  })
}

function listenStocks() {
  const q = query(collection(db, 'stocks'), orderBy('sku'))
  onSnapshot(q, (snap) => {
    allItems = snap.docs.map(d => ({ id:d.id, ...safeData(d.data()) }))
    // 預設顯示全部（不輸入關鍵字時）
    const kw = searchInput.value.trim().toLowerCase()
    if (!kw) filtered = [...allItems]
    else {
      filtered = allItems.filter(it => {
        const sku = String(it.sku || '').toLowerCase()
        const name = String(it.name || '').toLowerCase()
        return sku.includes(kw) || name.includes(kw)
      })
    }
    render()
  }, (err) => {
    console.error('stocks onSnapshot error:', err)
    tbody.innerHTML = `<tr><td colspan="7" class="empty">讀取失敗：${escapeHTML(err.message || err)}</td></tr>`
  })
}

function render() {
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">查無資料</td></tr>`
    countBadge.textContent = '0 項'
    return
  }
  const rows = []
  for (const it of filtered) {
    const store = n0(it.storeQty)
    const expo  = n0(it.expoQty)
    const sold  = n0(it.soldQty)
    const t = it.updatedAt && it.updatedAt.seconds ? new Date(it.updatedAt.seconds * 1000) : null
    const timeText = t ? dtFmt.format(t) : '-'

    rows.push(`<tr data-sku="${escapeHTML(it.sku || it.id)}">
      <td class="col-sku"><span class="tag">${escapeHTML(it.sku || it.id)}</span></td>
      <td class="col-name">${escapeHTML(it.name || '')}</td>
      <td class="col-num"><span class="qty store">${store}</span></td>
      <td class="col-num"><span class="qty expo">${expo}</span></td>
      <td class="col-num"><span class="qty sold">${sold}</span></td>
      <td class="col-op">
        <div class="ops">
          <button class="btn btn-move"   data-op="move"   ${store<=0?'disabled':''}>➕ 搬去展場</button>
          <button class="btn btn-return" data-op="return" ${expo<=0?'disabled':''}>➖ 退回店內</button>
          <button class="btn btn-sell"   data-op="sell"   ${expo<=0?'disabled':''}>💰 展場售出</button>
        </div>
      </td>
      <td class="col-time"><span class="time">${timeText}</span></td>
    </tr>`)
  }
  tbody.innerHTML = rows.join('\n')
  countBadge.textContent = `${filtered.length} 項`
}

function bindOps() {
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-op]')
    if (!btn) return
    const tr = e.target.closest('tr')
    if (!tr) return
    const sku = tr.getAttribute('data-sku')
    const op = btn.getAttribute('data-op')

    btn.disabled = true
    try {
      if (op === 'move') await moveToExpo(sku)
      else if (op === 'return') await returnToStore(sku)
      else if (op === 'sell') await sellFromExpo(sku)
    } catch (err) {
      alert(err.message || String(err))
      console.error(err)
    } finally {
      btn.disabled = false
    }
  })
}

// --- Firestore 交易操作 ---
async function moveToExpo(sku) {
  const ref = doc(db, 'stocks', sku)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    const d = safeData(snap.data())
    const store = n0(d.storeQty)
    const expo  = n0(d.expoQty)
    if (store <= 0) throw new Error('店內庫存不足，無法搬貨')
    tx.update(ref, {
      storeQty: store - 1,
      expoQty:  expo + 1,
      updatedAt: serverTimestamp()
    })
  })
}

async function returnToStore(sku) {
  const ref = doc(db, 'stocks', sku)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    const d = safeData(snap.data())
    const store = n0(d.storeQty)
    const expo  = n0(d.expoQty)
    if (expo <= 0) throw new Error('展場沒有庫存可退回')
    tx.update(ref, {
      storeQty: store + 1,
      expoQty:  expo - 1,
      updatedAt: serverTimestamp()
    })
  })
}

async function sellFromExpo(sku) {
  const ref = doc(db, 'stocks', sku)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    const d = safeData(snap.data())
    const expo = n0(d.expoQty)
    const sold = n0(d.soldQty)
    if (expo <= 0) throw new Error('展場庫存不足，無法銷售')
    tx.update(ref, {
      expoQty: expo - 1,
      soldQty: sold + 1,
      updatedAt: serverTimestamp()
    })
  })
}

// --- Utilities ---
function n0(x){ return Number.isFinite(+x) ? +x : 0 }
function safeData(d){ return d || {} }
function escapeHTML(s=''){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;')
}

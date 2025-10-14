// expo-stock.js — 展場庫存管理（含新增商品＋每列操作數量）
// v1.1.0 — 2025-10-14 (Asia/Taipei)
import { 
  collection, doc, onSnapshot, query, orderBy, runTransaction, serverTimestamp,
  getDoc, setDoc
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

// Add dialog handles
const addDialog = document.getElementById('addDialog')
const btnAdd = document.getElementById('btnAdd')
const btnCancelAdd = document.getElementById('btnCancelAdd')
const btnConfirmAdd = document.getElementById('btnConfirmAdd')
const fSku = document.getElementById('f_sku')
const fName = document.getElementById('f_name')
const fStore = document.getElementById('f_store')
const fExpo = document.getElementById('f_expo')
const fSold = document.getElementById('f_sold')
const fPrice = document.getElementById('f_price')

window.onload = () => {
  bootstrap()
}

function bootstrap() {
  bindSearch()
  listenStocks()
  bindOps()
  bindAddProduct()
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

    // 每列提供一個數量 input，預設 1
    const qtyInput = `<input class="qty-input" type="number" min="1" value="1" data-qty />`

    rows.push(`<tr data-sku="${escapeHTML(it.sku || it.id)}">
      <td class="col-sku"><span class="tag">${escapeHTML(it.sku || it.id)}</span></td>
      <td class="col-name">${escapeHTML(it.name || '')}</td>
      <td class="col-num"><span class="qty store">${store}</span></td>
      <td class="col-num"><span class="qty expo">${expo}</span></td>
      <td class="col-num"><span class="qty sold">${sold}</span></td>
      <td class="col-op">
        <div class="ops">
          ${qtyInput}
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
    const qtyEl = tr.querySelector('[data-qty]')
    let qty = Math.max(1, parseInt(qtyEl?.value || '1', 10))

    btn.disabled = true
    try {
      if (op === 'move') await moveToExpo(sku, qty)
      else if (op === 'return') await returnToStore(sku, qty)
      else if (op === 'sell') await sellFromExpo(sku, qty)
    } catch (err) {
      alert(err.message || String(err))
      console.error(err)
    } finally {
      btn.disabled = false
    }
  })
}

// --- Firestore 交易操作（支援批量數量） ---
async function moveToExpo(sku, qty=1) {
  const ref = doc(db, 'stocks', sku)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    const d = safeData(snap.data())
    const store = n0(d.storeQty)
    const expo  = n0(d.expoQty)
    if (store < qty) throw new Error(`店內庫存不足（可用 ${store}）`)
    tx.update(ref, {
      storeQty: store - qty,
      expoQty:  expo + qty,
      updatedAt: serverTimestamp()
    })
  })
}

async function returnToStore(sku, qty=1) {
  const ref = doc(db, 'stocks', sku)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    const d = safeData(snap.data())
    const store = n0(d.storeQty)
    const expo  = n0(d.expoQty)
    if (expo < qty) throw new Error(`展場可退回不足（可用 ${expo}）`)
    tx.update(ref, {
      storeQty: store + qty,
      expoQty:  expo - qty,
      updatedAt: serverTimestamp()
    })
  })
}

async function sellFromExpo(sku, qty=1) {
  const ref = doc(db, 'stocks', sku)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    const d = safeData(snap.data())
    const expo = n0(d.expoQty)
    const sold = n0(d.soldQty)
    if (expo < qty) throw new Error(`展場庫存不足（可售 ${expo}）`)
    tx.update(ref, {
      expoQty: expo - qty,
      soldQty: sold + qty,
      updatedAt: serverTimestamp()
    })
  })
}

// --- 新增商品 ---
function bindAddProduct(){
  if (btnAdd) btnAdd.addEventListener('click', () => { openAddDialog() })
  if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeAddDialog)
  if (btnConfirmAdd) btnConfirmAdd.addEventListener('click', confirmAddProduct)
}

function openAddDialog(){
  fSku.value = ''
  fName.value = ''
  fStore.value = 0
  fExpo.value = 0
  fSold.value = 0
  fPrice.value = ''
  addDialog.classList.remove('hide')
  fSku.focus()
}

function closeAddDialog(){
  addDialog.classList.add('hide')
}

async function confirmAddProduct(){
  const sku = (fSku.value || '').trim().toUpperCase()
  const name = (fName.value || '').trim()
  const storeQty = Math.max(0, parseInt(fStore.value || 0, 10))
  const expoQty  = Math.max(0, parseInt(fExpo.value  || 0, 10))
  const soldQty  = Math.max(0, parseInt(fSold.value  || 0, 10))
  const priceNum = fPrice.value === '' ? null : Math.max(0, parseFloat(fPrice.value))

  if (!sku) return alert('請輸入 SKU（文件 ID）')
  if (!name) return alert('請輸入商品名稱')

  const ref = doc(db, 'stocks', sku)
  const existed = await getDoc(ref)
  if (existed.exists()) {
    const ok = confirm('此 SKU 已存在，要覆蓋更新嗎？')
    if (!ok) return
  }
  const payload = {
    sku, name,
    storeQty, expoQty, soldQty,
    updatedAt: serverTimestamp()
  }
  if (priceNum !== null && Number.isFinite(priceNum)) payload.price = priceNum

  await setDoc(ref, payload, { merge:false })
  closeAddDialog()
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

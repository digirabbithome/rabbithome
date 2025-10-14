// expo-stock.js — v1.3.0
// 品牌（目錄）欄位 + SKU 可空白 + 品牌分組顯示 + 搜尋含品牌
// 展場售出會寫入 expoSales 集合（含 dateKey），供每日匯出報表使用
import { 
  collection, doc, addDoc, onSnapshot, query, orderBy, runTransaction, serverTimestamp,
  getDoc, setDoc, where, getDocs
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const db = window.__RABBIT_DB__

const TPE = 'Asia/Taipei'
const dtFmt = new Intl.DateTimeFormat('zh-TW', { timeZone: TPE, month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })

let allItems = []   // 快取：全部商品（含 id）
let filtered = []   // 搜尋結果
let editStoreId = null // 目前哪個 docId 在編輯店內數量
let brandSet = new Set()

const $ = (s, r=document) => r.querySelector(s)
const tbody = $('#tbody')
const searchInput = $('#searchInput')
const countBadge = $('#countBadge')

// Report
const reportDate = document.getElementById('reportDate')
const btnExport = document.getElementById('btnExport')
const reportSummary = document.getElementById('reportSummary')

// Add dialog handles
const addDialog = document.getElementById('addDialog')
const btnAdd = document.getElementById('btnAdd')
const btnCancelAdd = document.getElementById('btnCancelAdd')
const btnConfirmAdd = document.getElementById('btnConfirmAdd')
const fBrand = document.getElementById('f_brand')
const fSku = document.getElementById('f_sku')
const fName = document.getElementById('f_name')
const fStore = document.getElementById('f_store')
const fExpo = document.getElementById('f_expo')
const fSold = document.getElementById('f_sold')
const fPrice = document.getElementById('f_price')
const brandList = document.getElementById('brandList')

window.onload = () => {
  bootstrap()
}

function bootstrap() {
  // default report date = today in local timezone
  reportDate.valueAsDate = new Date()
  bindSearch()
  listenStocks()
  bindOps()
  bindAddProduct()
  bindReport()
}

function bindSearch() {
  let timer = null
  searchInput.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      filterAndRender()
    }, 120)
  })
}

function listenStocks() {
  const q = query(collection(db, 'stocks'), orderBy('brand'), orderBy('name'))
  onSnapshot(q, (snap) => {
    brandSet = new Set()
    allItems = snap.docs.map(d => {
      const data = safeData(d.data())
      if (data.brand) brandSet.add(data.brand)
      return { id:d.id, ...data }
    })
    refreshBrandDatalist()
    filterAndRender()
  }, (err) => {
    console.error('stocks onSnapshot error:', err)
    tbody.innerHTML = `<tr><td colspan="8" class="empty">讀取失敗：${escapeHTML(err.message || err)}</td></tr>`
  })
}

function filterAndRender(){
  const kw = searchInput.value.trim().toLowerCase()
  if (!kw) filtered = [...allItems]
  else {
    filtered = allItems.filter(it => {
      const brand = String(it.brand || '').toLowerCase()
      const sku = String(it.sku || '').toLowerCase()
      const name = String(it.name || '').toLowerCase()
      return brand.includes(kw) || sku.includes(kw) || name.includes(kw)
    })
  }
  render()
}

function render() {
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">查無資料</td></tr>`
    countBadge.textContent = '0 項'
    return
  }

  // group by brand
  const groups = {}
  for (const it of filtered) {
    const brand = it.brand || '(未指定品牌)'
    if (!groups[brand]) groups[brand] = []
    groups[brand].push(it)
  }

  const rows = []
  for (const brand of Object.keys(groups)) {
    rows.push(`<tr class="group-row"><th colspan="8">📦 ${escapeHTML(brand)}</th></tr>`)
    for (const it of groups[brand]) {
      const id = String(it.id)
      const store = n0(it.storeQty)
      const expo  = n0(it.expoQty)
      const sold  = n0(it.soldQty)
      const skuText = it.sku || ''
      const t = it.updatedAt && it.updatedAt.seconds ? new Date(it.updatedAt.seconds * 1000) : null
      const timeText = t ? dtFmt.format(t) : '-'

      const qtyInput = `<input class="qty-input" type="number" min="1" value="1" data-qty />`

      // store cell
      let storeCell = ''
      if (editStoreId === id) {
        storeCell = `<span class="store-edit-wrap">
          <input class="store-input" type="number" min="0" value="${store}" data-store-input />
          <button class="btn-icon btn-ok" title="儲存" data-act="save-store">✔</button>
          <button class="btn-icon btn-cancel" title="取消" data-act="cancel-store">✖</button>
        </span>`
      } else {
        storeCell = `<span class="qty store">${store}</span>
          <button class="btn-icon" title="修改店內數量" data-edit="store">✏️</button>`
      }

      rows.push(`<tr data-id="${escapeHTML(id)}">
        <td class="col-brand">${escapeHTML(it.brand || '')}</td>
        <td class="col-sku"><span class="tag">${escapeHTML(skuText)}</span></td>
        <td class="col-name">${escapeHTML(it.name || '')}</td>
        <td class="col-num">${storeCell}</td>
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
  }
  tbody.innerHTML = rows.join('\n')
  countBadge.textContent = `${filtered.length} 項`
}

function bindOps() {
  tbody.addEventListener('click', async (e) => {
    const btnOp = e.target.closest('button[data-op]')
    const btnEdit = e.target.closest('button[data-edit]')
    const btnAct = e.target.closest('button[data-act]')
    const tr = e.target.closest('tr')
    if (!tr) return
    const id = tr.getAttribute('data-id')

    if (btnOp) {
      const op = btnOp.getAttribute('data-op')
      const qtyEl = tr.querySelector('[data-qty]')
      let qty = Math.max(1, parseInt(qtyEl?.value || '1', 10))
      btnOp.disabled = true
      try {
        if (op === 'move') await moveToExpo(id, qty)
        else if (op === 'return') await returnToStore(id, qty)
        else if (op === 'sell') await sellFromExpo(id, qty)
      } catch (err) {
        alert(err.message || String(err))
        console.error(err)
      } finally {
        btnOp.disabled = false
      }
      return
    }

    if (btnEdit && btnEdit.getAttribute('data-edit') === 'store') {
      editStoreId = id
      render()
      const input = tr.querySelector('[data-store-input]')
      input?.focus()
      input?.select()
      return
    }

    if (btnAct) {
      const act = btnAct.getAttribute('data-act')
      if (act === 'cancel-store') {
        editStoreId = null
        render()
        return
      }
      if (act === 'save-store') {
        const input = tr.querySelector('[data-store-input]')
        const v = Math.max(0, parseInt(input?.value || '0', 10))
        try {
          await setStoreQty(id, v)
          editStoreId = null
          render()
        } catch (err) {
          alert(err.message || String(err))
          console.error(err)
        }
        return
      }
    }
  })
}

// --- Firestore 交易操作（用 docId；支援批量數量） ---
async function moveToExpo(id, qty=1) {
  const ref = doc(db, 'stocks', id)
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

async function returnToStore(id, qty=1) {
  const ref = doc(db, 'stocks', id)
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

async function sellFromExpo(id, qty=1) {
  const ref = doc(db, 'stocks', id)
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
  // 紀錄銷售（單筆）
  const snap = await getDoc(ref)
  const data = safeData(snap.data())
  await addDoc(collection(db, 'expoSales'), {
    stockId: id,
    sku: data.sku || '',
    brand: data.brand || '',
    name: data.name || '',
    qty: qty,
    price: data.price || null,
    ts: serverTimestamp(),
    dateKey: dateKeyToday() // 以當地時區今天字串，供搜尋
  })
}

// 直接設定店內數量
async function setStoreQty(id, newQty) {
  const ref = doc(db, 'stocks', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    if (!Number.isFinite(newQty) || newQty < 0) throw new Error('數量需為 0 或正整數')
    tx.update(ref, {
      storeQty: Math.floor(newQty),
      updatedAt: serverTimestamp()
    })
  })
}

// --- 新增商品（SKU 可空白；留空則 autoId） ---
function bindAddProduct(){
  if (btnAdd) btnAdd.addEventListener('click', () => { openAddDialog() })
  if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeAddDialog)
  if (btnConfirmAdd) btnConfirmAdd.addEventListener('click', confirmAddProduct)
}

function refreshBrandDatalist(){
  if (!brandList) return
  brandList.innerHTML = Array.from(brandSet).sort().map(b => `<option value="${escapeHTML(b)}"/>`).join('')
}

function openAddDialog(){
  fBrand.value = ''
  fSku.value = ''
  fName.value = ''
  fStore.value = 0
  fExpo.value = 0
  fSold.value = 0
  fPrice.value = ''
  addDialog.classList.remove('hide')
  fBrand.focus()
}

function closeAddDialog(){
  addDialog.classList.add('hide')
}

async function confirmAddProduct(){
  const brand = (fBrand.value || '').trim()
  const sku = (fSku.value || '').trim().toUpperCase()
  const name = (fName.value || '').trim()
  const storeQty = Math.max(0, parseInt(fStore.value || 0, 10))
  const expoQty  = Math.max(0, parseInt(fExpo.value  || 0, 10))
  const soldQty  = Math.max(0, parseInt(fSold.value  || 0, 10))
  const priceNum = fPrice.value === '' ? null : Math.max(0, parseFloat(fPrice.value))

  if (!brand) return alert('請輸入品牌（目錄）')
  if (!name) return alert('請輸入商品名稱')

  const payload = {
    brand, sku, name,
    storeQty, expoQty, soldQty,
    updatedAt: serverTimestamp()
  }
  if (priceNum !== null && Number.isFinite(priceNum)) payload.price = priceNum

  if (sku) {
    // 指定 SKU 當 docId（若存在則覆蓋詢問可在 UI 再加，這裡直接 merge:false）
    await setDoc(doc(db, 'stocks', sku), payload, { merge:false })
  } else {
    // 讓 Firestore 自動產生 docId
    await addDoc(collection(db, 'stocks'), payload)
  }
  closeAddDialog()
}

// --- 報表（每日銷售匯出 CSV + 畫面彙總） ---
function bindReport(){
  btnExport?.addEventListener('click', exportDailyCSV)
}

function dateKeyToday(){
  // 產生 yyyy-mm-dd 的本地日期字串
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth()+1).padStart(2,'0')
  const dd = String(now.getDate()).padStart(2,'0')
  return `${yyyy}-${mm}-${dd}`
}

function dateKeyOf(input){
  // input: <input type=date> value (yyyy-mm-dd)
  const v = (input?.value || '').trim()
  if (!v) return dateKeyToday()
  return v
}

async function exportDailyCSV(){
  const dkey = dateKeyOf(reportDate)
  // 查詢 expoSales where dateKey == dkey
  const q = query(collection(db, 'expoSales'), where('dateKey','==', dkey))
  const snap = await getDocs(q)
  if (snap.empty) {
    alert(`當日（${dkey}）沒有銷售紀錄`)
    reportSummary.classList.add('hide')
    reportSummary.innerHTML = ''
    return
  }
  // 彙總：brand + name（同品項合併），統計 qty 與金額
  const map = new Map()
  for (const docu of snap.docs) {
    const d = safeData(docu.data())
    const key = `${d.brand || ''}||${d.name || ''}`
    const prev = map.get(key) || { brand:d.brand||'', name:d.name||'', qty:0, amount:0, price:d.price||0 }
    prev.qty += n0(d.qty)
    if (Number.isFinite(+d.price)) prev.amount += n0(d.qty) * (+d.price)
    map.set(key, prev)
  }
  const rows = Array.from(map.values()).sort((a,b)=> a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name))

  // 畫面表格
  const totalQty = rows.reduce((s,r)=>s+r.qty,0)
  const totalAmt = rows.reduce((s,r)=>s+r.amount,0)
  const html = [`<table class="report-table"><thead><tr><th>品牌</th><th>品名</th><th>數量</th><th>金額</th></tr></thead><tbody>`]
  for (const r of rows) html.push(`<tr><td>${escapeHTML(r.brand)}</td><td>${escapeHTML(r.name)}</td><td>${r.qty}</td><td>${r.amount}</td></tr>`)
  html.push(`<tr><td colspan="2"><b>合計</b></td><td><b>${totalQty}</b></td><td><b>${totalAmt}</b></td></tr>`)
  html.push(`</tbody></table>`)
  reportSummary.innerHTML = html.join('')
  reportSummary.classList.remove('hide')

  // CSV 下載
  let csv = '品牌,品名,數量,金額\n'
  for (const r of rows) {
    csv += `${csvSafe(r.brand)},${csvSafe(r.name)},${r.qty},${r.amount}\n`
  }
  csv += `合計, ,${totalQty},${totalAmt}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `expo-sales-${dkey}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// --- Utils ---
function csvSafe(s=''){
  return String(s).replaceAll('"','""').includes(',') ? `"${String(s).replaceAll('"','""')}"` : String(s)
}
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

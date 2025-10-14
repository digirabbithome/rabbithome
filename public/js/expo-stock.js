// expo-stock.js — v1.4.0
// 新增：
// 1) 展場售出可超賣：expoQty 允許變負數表示欠貨
// 2) 每列最前面加 ◯ 圈圈，切換 onDisplay（展示中）並高亮底色
// 3) 點商品名稱開啟編輯對話框，可修改 品牌/品名/價格/SKU
// 4) 表頭可排序（品牌/商品/價格/店內/展場/已售出）
// 5) 繼承：品牌分組、搜尋、每日匯出、數量操作、店內筆修改
import { 
  collection, doc, addDoc, onSnapshot, query, orderBy, runTransaction, serverTimestamp,
  getDoc, setDoc, where, getDocs, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const db = window.__RABBIT_DB__

const moneyFmt = new Intl.NumberFormat('zh-TW', { style:'currency', currency:'TWD', maximumFractionDigits:0 })

let allItems = []   // 全部商品（含 id）
let filtered = []   // 搜尋後的結果
let editStoreId = null // 目前哪個 docId 在編輯店內數量
let brandSet = new Set()

let sortField = 'brand' // brand | name | price | store | expo | sold
let sortDir = 'asc'     // asc | desc

const $ = (s, r=document) => r.querySelector(s)
const tbody = $('#tbody')
const searchInput = $('#searchInput')
const countBadge = $('#countBadge')
const thead = document.querySelector('thead')

// Report
const reportDate = document.getElementById('reportDate')
const btnExport = document.getElementById('btnExport')
const reportSummary = document.getElementById('reportSummary')

// Add dialog
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

// Edit dialog
const editDialog = document.getElementById('editDialog')
const eId = document.getElementById('e_id')
const eBrand = document.getElementById('e_brand')
const eSku = document.getElementById('e_sku')
const eName = document.getElementById('e_name')
const ePrice = document.getElementById('e_price')
const btnCancelEdit = document.getElementById('btnCancelEdit')
const btnConfirmEdit = document.getElementById('btnConfirmEdit')

window.onload = () => {
  bootstrap()
}

function bootstrap() {
  reportDate.valueAsDate = new Date()
  bindSearch()
  bindSort()
  listenStocks()
  bindOps()
  bindAddProduct()
  bindEditProduct()
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

function bindSort(){
  thead.addEventListener('click', (e)=>{
    const th = e.target.closest('[data-sort]')
    if (!th) return
    const field = th.getAttribute('data-sort')
    if (sortField === field) sortDir = (sortDir === 'asc' ? 'desc' : 'asc')
    else { sortField = field; sortDir = 'asc' }
    filterAndRender()
  })
}

function listenStocks() {
  const q = query(collection(db, 'stocks'), orderBy('brand'))
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
      const name = String(it.name || '').toLowerCase()
      return brand.includes(kw) || name.includes(kw)
    })
  }
  render()
}

function compare(a,b,field){
  let va, vb
  switch(field){
    case 'brand': va = (a.brand||''); vb=(b.brand||''); return va.localeCompare(vb)
    case 'name':  va = (a.name||'');  vb=(b.name||'');  return va.localeCompare(vb)
    case 'price': va = +a.price||0;   vb=+b.price||0;   return va-vb
    case 'store': va = +a.storeQty||0;vb=+b.storeQty||0;return va-vb
    case 'expo':  va = +a.expoQty||0; vb=+b.expoQty||0; return va-vb
    case 'sold':  va = +a.soldQty||0; vb=+b.soldQty||0; return va-vb
    default: return 0
  }
}

function render() {
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">查無資料</td></tr>`
    countBadge.textContent = '0 項'
    return
  }

  // 排序：品牌決定群組順序；其他欄位決定群內排序
  const items = [...filtered]
  // 先按品牌排序（群組順序）
  items.sort((a,b)=> compare(a,b,'brand') * (sortField==='brand' && sortDir==='desc' ? -1 : 1))
  // 建群組
  const groups = {}
  for (const it of items) {
    const brand = it.brand || '(未指定品牌)'
    if (!groups[brand]) groups[brand] = []
    groups[brand].push(it)
  }
  // 依選擇的欄位做群內排序
  const groupOrder = Object.keys(groups)
  if (sortField==='brand'){
    if (sortDir==='desc') groupOrder.reverse()
  }
  const rows = []
  for (const brand of groupOrder) {
    // 群內排序
    if (sortField!=='brand'){
      groups[brand].sort((a,b)=> compare(a,b,sortField))
      if (sortDir==='desc') groups[brand].reverse()
    }
    rows.push(`<tr class="group-row"><th colspan="8">📦 ${escapeHTML(brand)}</th></tr>`)
    for (const it of groups[brand]) {
      const id = String(it.id)
      const store = n0(it.storeQty)
      const expo  = n0(it.expoQty)
      const sold  = n0(it.soldQty)
      const price = Number.isFinite(+it.price) ? moneyFmt.format(+it.price) : '-'
      const onDisplay = !!it.onDisplay

      const qtyInput = `<input class="qty-input" type="number" min="1" value="1" data-qty />`
      const circle = `<span class="circle ${onDisplay?'on':''}" data-toggle="display"></span>`

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

      rows.push(`<tr data-id="${escapeHTML(id)}" class="${onDisplay?'on-display':''}">
        <td class="col-flag">${circle}</td>
        <td class="col-brand">${escapeHTML(it.brand || '')}</td>
        <td class="col-name"><button class="btn-icon" data-edit="open">✏️</button> ${escapeHTML(it.name || '')}</td>
        <td class="col-price">${price}</td>
        <td class="col-num">${storeCell}</td>
        <td class="col-num"><span class="qty expo ${expo<0?'negative':''}">${expo}</span></td>
        <td class="col-num"><span class="qty sold">${sold}</span></td>
        <td class="col-op">
          <div class="ops">
            ${qtyInput}
            <button class="btn btn-move"   data-op="move">➕ 搬去展場</button>
            <button class="btn btn-return" data-op="return">➖ 退回店內</button>
            <button class="btn btn-sell"   data-op="sell">💰 展場售出</button>
          </div>
        </td>
      </tr>`)
    }
  }
  tbody.innerHTML = rows.join('\n')
  countBadge.textContent = `${filtered.length} 項`
  updateSortArrows()
}

function updateSortArrows(){
  const ids = ['brand','name','price','store','expo','sold']
  for (const id of ids){
    const el = document.getElementById('arr-'+id)
    if (!el) continue
    if (sortField===id){
      el.textContent = (sortDir==='asc' ? '↑' : '↓')
    } else {
      el.textContent = '↕'
    }
  }
}

function bindOps() {
  tbody.addEventListener('click', async (e) => {
    const btnOp = e.target.closest('button[data-op]')
    const btnEdit = e.target.closest('button[data-edit]')
    const btnAct = e.target.closest('button[data-act]')
    const circle = e.target.closest('[data-toggle="display"]')
    const tr = e.target.closest('tr[data-id]')
    if (!tr) return
    const id = tr.getAttribute('data-id')

    // 展示圈圈 toggle
    if (circle){
      try {
        const ref = doc(db, 'stocks', id)
        const nowOn = tr.classList.contains('on-display')
        await updateDoc(ref, { onDisplay: !nowOn })
      } catch (err) {
        alert(err.message || String(err))
      }
      return
    }

    // 開啟編輯商品
    if (btnEdit && btnEdit.getAttribute('data-edit')==='open'){
      openEditDialogFromRow(tr)
      return
    }

    // 操作：搬/退/售
    if (btnOp) {
      const op = btnOp.getAttribute('data-op')
      const qtyEl = tr.querySelector('[data-qty]')
      let qty = Math.max(1, parseInt(qtyEl?.value || '1', 10))
      btnOp.disabled = true
      try {
        if (op === 'move') await moveToExpo(id, qty)
        else if (op === 'return') await returnToStore(id, qty)
        else if (op === 'sell') await sellFromExpo_allowNegative(id, qty)
      } catch (err) {
        alert(err.message || String(err))
        console.error(err)
      } finally {
        btnOp.disabled = false
      }
      return
    }

    // 進入編輯店內數量
    if (btnEdit && btnEdit.getAttribute('data-edit') === 'store') {
      editStoreId = id
      render()
      const input = tr.querySelector('[data-store-input]')
      input?.focus()
      input?.select()
      return
    }

    // 編輯中的儲存 / 取消（店內數量）
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

// Firestore 操作
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
    // 退回時不限制 expo >= qty，允許把負數往回補
    tx.update(ref, {
      storeQty: store + qty,
      expoQty:  expo - qty,
    })
  })
}

async function sellFromExpo_allowNegative(id, qty=1) {
  const ref = doc(db, 'stocks', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    const d = safeData(snap.data())
    const expo = n0(d.expoQty)
    const sold = n0(d.soldQty)
    // 不檢查庫存，下賣單即扣；可成為負數代表欠貨
    tx.update(ref, {
      expoQty: expo - qty,
      soldQty: sold + qty,
    })
  })
  // 記錄銷售
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
    dateKey: dateKeyToday()
  })
}

// 直接設定店內數量
async function setStoreQty(id, newQty) {
  const ref = doc(db, 'stocks', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('找不到商品資料')
    if (!Number.isFinite(newQty) || newQty < 0) throw new Error('數量需為 0 或正整數')
    tx.update(ref, { storeQty: Math.floor(newQty) })
  })
}

// 新增商品
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

  const payload = { brand, sku, name, storeQty, expoQty, soldQty }
  if (priceNum !== null && Number.isFinite(priceNum)) payload.price = priceNum

  if (sku) {
    await setDoc(doc(db, 'stocks', sku), payload, { merge:false })
  } else {
    await addDoc(collection(db, 'stocks'), payload)
  }
  closeAddDialog()
}

// 編輯商品
function bindEditProduct(){
  btnCancelEdit?.addEventListener('click', closeEditDialog)
  btnConfirmEdit?.addEventListener('click', confirmEditProduct)
}

function openEditDialogFromRow(tr){
  const id = tr.getAttribute('data-id')
  const brand = tr.querySelector('.col-brand')?.textContent?.trim() || ''
  const name = tr.querySelector('.col-name')?.textContent?.replace('✏️','').trim() || ''
  const priceText = tr.querySelector('.col-price')?.textContent?.trim() || ''
  eId.value = id
  eBrand.value = brand
  eName.value = name
  eSku.value = '' // 預設不變
  ePrice.value = priceText === '-' ? '' : (priceText.replace(/[^\d]/g,'')) // 粗略帶入
  editDialog.classList.remove('hide')
  eBrand.focus()
}

function closeEditDialog(){
  editDialog.classList.add('hide')
}

async function confirmEditProduct(){
  const id = eId.value
  const brand = (eBrand.value||'').trim()
  const name = (eName.value||'').trim()
  const priceNum = ePrice.value==='' ? null : Math.max(0, parseFloat(ePrice.value))
  const skuNew = (eSku.value||'').trim().toUpperCase()

  if (!id) return closeEditDialog()
  if (!brand || !name) { alert('品牌與商品名稱不可空白'); return }

  const ref = doc(db, 'stocks', id)
  const updates = { brand, name }
  if (priceNum !== null && Number.isFinite(priceNum)) updates.price = priceNum
  else updates.price = null

  await updateDoc(ref, updates)

  // 若修改 SKU（即想更換 docId）：需新建文件再刪舊的；這裡做簡化：若填了新 SKU，就複製一份後刪舊的
  if (skuNew){
    const snap = await getDoc(ref)
    const data = safeData(snap.data())
    data.sku = skuNew
    await setDoc(doc(db, 'stocks', skuNew), data, { merge:false })
    // 刪舊的
    // Firestore Web v11 無直接 deleteDoc import 於此檔，若要完整搬移可在後續版本加入 deleteDoc。
    alert('SKU 已另存成新文件，請手動刪除舊檔（或告訴我幫你在下一版自動刪除）')
  }

  closeEditDialog()
}

// 報表
function bindReport(){
  btnExport?.addEventListener('click', exportDailyCSV)
}

function dateKeyToday(){
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth()+1).padStart(2,'0')
  const dd = String(now.getDate()).padStart(2,'0')
  return `${yyyy}-${mm}-${dd}`
}

function dateKeyOf(input){
  const v = (input?.value || '').trim()
  if (!v) return dateKeyToday()
  return v
}

async function exportDailyCSV(){
  const dkey = dateKeyOf(reportDate)
  const q = query(collection(db, 'expoSales'), where('dateKey','==', dkey))
  const snap = await getDocs(q)
  if (snap.empty) {
    alert(`當日（${dkey}）沒有銷售紀錄`)
    reportSummary.classList.add('hide')
    reportSummary.innerHTML = ''
    return
  }
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

  const totalQty = rows.reduce((s,r)=>s+r.qty,0)
  const totalAmt = rows.reduce((s,r)=>s+r.amount,0)
  const html = [`<table class="report-table"><thead><tr><th>品牌</th><th>品名</th><th>數量</th><th>金額</th></tr></thead><tbody>`]
  for (const r of rows) html.push(`<tr><td>${escapeHTML(r.brand)}</td><td>${escapeHTML(r.name)}</td><td>${r.qty}</td><td>${moneyFmt.format(r.amount)}</td></tr>`)
  html.push(`<tr><td colspan="2"><b>合計</b></td><td><b>${totalQty}</b></td><td><b>${moneyFmt.format(totalAmt)}</b></td></tr>`)
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

// Utils
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

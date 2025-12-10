// /js/invoice.js

import { db } from '/js/firebase.js'
import { openSmilepayPrint } from '/js/smilepay-print.js';
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

// === Firebase Cloud Functions base URL ===
const FUNCTIONS_BASE = 'https://us-central1-rabbithome-auth.cloudfunctions.net'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))

let cachedInvoices = []
let invoicesUnsub = null

// 列表排序 / 分頁
let currentSortField = 'date'
let currentSortDir = 'desc'
let currentPage = 1
const ROWS_PER_PAGE = 50
let pagerEl = null

// 📊 統計用公司
const STATS_COMPANIES = [
  { id: 'rabbit', label: '數位小兔' },
  { id: 'focus', label: '聚焦數位' },
  { id: 'neversleep', label: '免睡攝影' }
]

const STATS_PERIODS = [
  { key: '1-2', label: '1 / 2 月', months: [1,2] },
  { key: '3-4', label: '3 / 4 月', months: [3,4] },
  { key: '5-6', label: '5 / 6 月', months: [5,6] },
  { key: '7-8', label: '7 / 8 月', months: [7,8] },
  { key: '9-10', label: '9 / 10 月', months: [9,10] },
  { key: '11-12', label: '11 / 12 月', months: [11,12] }
]

// === 初始化 ===
window.onload = () => {
  setupForm()
  setupList()
  listenInvoices()
}

// === 表單 ===
function setupForm() {
  $('#addItemBtn')?.addEventListener('click', e => {
    e.preventDefault()
    addItemRow()
    addItemRow()
    addItemRow()
  })

  $('#issueBtn')?.addEventListener('click', issueInvoice)
  $('#refreshListBtn')?.addEventListener('click', reloadInvoices)

  $('#filterStatus')?.addEventListener('change', () => {
    currentPage = 1
    reloadInvoices()
  })

  $('#searchKeyword')?.addEventListener('input', () => {
    currentPage = 1
    reloadInvoices()
  })

  $('#parsePosBtn')?.addEventListener('click', e => {
    e.preventDefault()
    parsePosAndFill()
  })

  // 預設一列
  addItemRow()
}

// === 商品列 ===
function addItemRow(prefill=null) {
  const tbody = $('#itemsBody')
  if (!tbody) return

  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td class="item-index"></td>
    <td><input class="item-name"></td>
    <td><input class="item-qty" type="number" min="1" value="1"></td>
    <td><input class="item-price" type="number" min="0" value="0"></td>
    <td class="item-amount">0</td>
    <td><button type="button" class="btn-small danger">刪除</button></td>
  `
  tbody.appendChild(tr)

  const nameInput  = tr.querySelector('.item-name')
  const qtyInput   = tr.querySelector('.item-qty')
  const priceInput = tr.querySelector('.item-price')
  const delBtn     = tr.querySelector('button')

  if (prefill) {
    nameInput.value = prefill.name
    qtyInput.value = prefill.qty
    priceInput.value = prefill.price
  }

  const recalc = () => {
    const qty = Number(qtyInput.value)||0
    const price = Number(priceInput.value)||0
    tr.querySelector('.item-amount').textContent = qty*price
    recalcTotal()
  }

  nameInput.addEventListener('input', recalc)
  qtyInput.addEventListener('input', recalc)
  priceInput.addEventListener('input', recalc)

  delBtn.addEventListener('click', () => {
    tr.remove()
    recalcTotal()
  })

  recalc()
}

function updateItemIndices() {
  $$('#itemsBody tr').forEach((tr,i)=>{
    tr.querySelector('.item-index').textContent = i+1
  })
}

function recalcTotal() {
  let total = 0
  $$('#itemsBody tr').forEach(tr => {
    total += Number(tr.querySelector('.item-amount').textContent)||0
  })
  $('#totalAmount').textContent = total
  updateItemIndices()
}

// === POS 解析 ===
function parsePosAndFill() {
  const raw = $('#posPaste')?.value.trim()
  if (!raw) return alert('請先貼上 POS 明細')

  const { items, total } = parsePosText(raw)
  if (!items.length) return alert('解析失敗，可能需要調整格式')

  const tbody = $('#itemsBody')
  tbody.innerHTML = ''
  items.forEach(it => addItemRow(it))

  recalcTotal()
  if (total > 0) $('#totalAmount').textContent = total

  alert(`解析出 ${items.length} 個品項`)
}

function parsePosText(text) {
  const resultItems = []
  const cleaned = text.replace(/\r/g,'')

  const itemRegex =
    /(\d+)\.\s*([\s\S]*?)\$\s*([\d,]+)[\s\S]*?x\s*(\d+)\s*=\s*([\d,]+)/g
  let m
  while ((m = itemRegex.exec(cleaned))!==null) {
    resultItems.push({
      name: m[2].trim().replace(/\s+/g,' '),
      price: Number(m[3].replace(/,/g,'')),
      qty: Number(m[4]),
      amount: Number(m[5].replace(/,/g,'')),
    })
  }

  let total = 0
  const totalMatch = /總額\s*([\d,]+)/.exec(cleaned)
  if (totalMatch) total = Number(totalMatch[1].replace(/,/g,''))

  return { items: resultItems, total }
}

// === 載具 ===
function detectCarrierType(v) {
  if (!v) return 'NONE'
  if (v.startsWith('/')) return 'MOBILE'
  return 'NATURAL'
}

// === 開立發票 ===
async function issueInvoice() {
  const sEl = $('#issueStatus')
  if (sEl) sEl.textContent = '發票開立中…'

  const companyId   = $('#companySelect')?.value
  const orderId     = $('#orderId')?.value.trim()
  const buyerGUI    = $('#buyerGUI')?.value.trim()
  const buyerTitle  = $('#buyerTitle')?.value.trim()
  const contactName = $('#contactName')?.value.trim()
  const contactPhone= $('#contactPhone')?.value.trim()
  const contactEmail= $('#contactEmail')?.value.trim()
  const carrierValue= $('#carrierValue')?.value.trim()


  // ⭐ 新增這一行：預開發票 checkbox
  const preInvoice = !!document.getElementById('preInvoice')?.checked
  
  const carrierType = detectCarrierType(carrierValue)

  if (carrierType==='MOBILE' && carrierValue && carrierValue.length!==8) {
    if (!confirm('手機條碼不是8碼，確定送出？')) {
      sEl.textContent = '取消送出'
      return
    }
  }

  const items = $$('#itemsBody tr').map(tr=>{
    const name = tr.querySelector('.item-name').value.trim()
    const qty  = Number(tr.querySelector('.item-qty').value)||0
    const price= Number(tr.querySelector('.item-price').value)||0
    return {name, qty, price, amount: qty*price}
  }).filter(i=>i.name && i.qty>0)

  if (!items.length) {
    sEl.textContent = '請至少輸入一項商品'
    return
  }

  const amount = items.reduce((s,it)=>s+it.amount,0)

  try {
    const res = await fetch(`${FUNCTIONS_BASE}/createInvoice`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        companyId, orderId, buyerGUI, buyerTitle,
        contactName, contactPhone, contactEmail,
        amount, items, carrierType, carrierValue,
        donateMark:'0', donateCode:'',
    // ⭐ 加這兩個
    preInvoice,
    unpaid: preInvoice   // 勾預開 = 未收款
        
      })
    })

    const data = await res.json()
    if (!data.success) {
      sEl.textContent = `開立失敗：${data.message}`
      return
    }

    sEl.textContent =
      `開立成功：${data.invoiceNumber}（隨機碼 ${data.randomNumber}）`

    openSmilepayPrint({
      companyId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      randomNumber: data.randomNumber
    })

    reloadInvoices()

  } catch(err) {
    console.error(err)
    sEl.textContent = '開立失敗：伺服器錯誤'
  }
}

// === Firestore 監聽 ===
function listenInvoices() {
  const listBody = $('#invoiceListBody')
  if (!listBody) return

  const qRef = query(collection(db,'invoices'), orderBy('createdAt','desc'))

  invoicesUnsub = onSnapshot(qRef, snap => {
    cachedInvoices = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    reloadInvoices()
  })
}


// === 列表相關 ===
function setupList() {
  const headerCells = $$('.list-table thead th')
  if (!headerCells.length) return

  const dateTh    = headerCells[0] // 日期
  const companyTh = headerCells[1] // 公司
  const statusTh  = headerCells[6] // 狀態

  ;[dateTh, companyTh, statusTh].forEach(th => {
    if (!th) return
    th.style.cursor = 'pointer'
  })

  dateTh?.addEventListener('click', () => toggleSort('date'))
  companyTh?.addEventListener('click', () => toggleSort('company'))
  statusTh?.addEventListener('click', () => toggleSort('status'))

  // 📊 發票統計按鈕（toggle 顯示 / 隱藏）
  const statsBtn = $('#statsBtn')
  if (statsBtn) {
    statsBtn.addEventListener('click', () => {
      renderStatsTable()
    })
  }

  // 分頁列
  const table = $('.list-table')
  if (table) {
    pagerEl = document.createElement('div')
    pagerEl.className = 'invoice-pagination'
    pagerEl.innerHTML = `
      <button type="button" class="btn-small" data-page="prev">上一頁</button>
      <span class="page-info"></span>
      <button type="button" class="btn-small" data-page="next">下一頁</button>
    `
    table.insertAdjacentElement('afterend', pagerEl)

    pagerEl.addEventListener('click', e => {
      const btn = e.target.closest('button[data-page]')
      if (!btn) return
      const all = getFilteredSortedInvoices()
      const totalPages = Math.max(1, Math.ceil(all.length / ROWS_PER_PAGE))

      if (btn.dataset.page === 'prev') {
        if (currentPage > 1) {
          currentPage--
          reloadInvoices()
        }
      } else if (btn.dataset.page === 'next') {
        if (currentPage < totalPages) {
          currentPage--
          reloadInvoices()
        }
      }
    })
  }
}

function toggleSort(field) {
  if (currentSortField === field) {
    currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc'
  } else {
    currentSortField = field
    currentSortDir = field === 'date' ? 'desc' : 'asc'
  }
  currentPage = 1
  reloadInvoices()
}

// === 預開 / 未收款判斷 ===
function isUnpaid(inv) {
  // 任一 flag 為 true 都視為未收款
  return !!(inv.preInvoice || inv.unpaid || inv.preInvoiceFlag)
}

function getInvoiceTime(inv) {
  if (inv.createdAt?.toDate) {
    return inv.createdAt.toDate().getTime()
  }
  if (inv.invoiceDate) {
    const d = new Date(inv.invoiceDate.replace(/\//g, '-') + 'T00:00:00')
    return d.getTime()
  }
  return 0
}

function statusOrder(inv) {
  const s = inv.status || ''
  if (s === 'ISSUED') return 1
  if (s === 'VOIDED') return 2
  return 99
}

function statusToText(inv) {
  const s = inv.status || ''
  const unpaid = isUnpaid(inv)
  if (s === 'ISSUED') {
    return unpaid ? '已開立（未收款）' : '已開立'
  }
  if (s === 'VOIDED') return '已作廢'
  return s || '-'
}

function formatDateTime(inv) {
  let d = null
  if (inv.createdAt?.toDate) {
    d = inv.createdAt.toDate()
  } else if (inv.invoiceDate) {
    d = new Date(inv.invoiceDate.replace(/\//g, '-') + 'T00:00:00')
  }
  if (!d) return '-'
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

// === 發票日期 → 月份（1~12） ===
function getInvoiceMonth(inv) {
  if (inv.invoiceDate) {
    const parts = inv.invoiceDate.replace(/-/g, '/').split('/')
    if (parts.length >= 2) {
      const m = Number(parts[1])
      if (m >= 1 && m <= 12) return m
    }
  }
  if (inv.createdAt && typeof inv.createdAt.toDate === 'function') {
    const d = inv.createdAt.toDate()
    return d.getMonth() + 1
  }
  return null
}

// 月份決定雙月份區間 index（0~5）
function getPeriodIndexByMonth(month) {
  if (!month || month < 1 || month > 12) return -1
  return Math.floor((month - 1) / 2) // 1~12 → 0~5
}

// === 產生 / 隱藏 發票統計表（列：公司；欄：雙月份 + 總金額） ===
function renderStatsTable() {
  const area = $('#statsArea')
  if (!area) return

  // toggle：已顯示就清空 + 關閉
  if (area.dataset.visible === '1') {
    area.innerHTML = ''
    area.dataset.visible = '0'
    return
  }

  if (!cachedInvoices || !cachedInvoices.length) {
    area.innerHTML = '<p class="stats-hint">目前沒有發票資料可以統計。</p>'
    area.dataset.visible = '1'
    return
  }

  // stats[companyId][periodIdx] = 金額
  const stats = {}
  STATS_COMPANIES.forEach(c => {
    stats[c.id] = STATS_PERIODS.map(() => 0)
  })

  // 只統計「已開立成功」而且未作廢的
  for (const inv of cachedInvoices) {
    if (inv.status !== 'ISSUED') continue

    const cid = inv.companyId || ''
    if (!stats[cid]) continue // 限定三家公司

    const month = getInvoiceMonth(inv)
    const periodIdx = getPeriodIndexByMonth(month)
    if (periodIdx < 0) continue

    const amount = Number(inv.amount || 0) || 0
    stats[cid][periodIdx] += amount
  }

  let bodyHtml = ''

  STATS_COMPANIES.forEach(c => {
    const row = stats[c.id] || STATS_PERIODS.map(() => 0)
    const total = row.reduce((s, v) => s + v, 0)

    bodyHtml += `
      <tr>
        <td class="stats-company" style="border:1px solid #ccc; padding:4px;">${c.label}</td>
        ${row.map(v => `
          <td class="amount-cell"
              style="border:1px solid #ccc; padding:4px; text-align:center;">
            ${v.toLocaleString()}
          </td>
        `).join('')}
        <td class="amount-cell total-cell"
            style="border:1px solid #ccc; padding:4px; font-weight:bold; text-align:center;">
          ${total.toLocaleString()}
        </td>
      </tr>
    `
  })

  area.innerHTML = `
    <div class="stats-card">
      <h3>📊 發票金額統計（只含已開立發票）</h3>
      <table class="stats-table"
             style="border-collapse:collapse; width:100%; text-align:center;">
        <thead>
          <tr>
            <th style="border:1px solid #ccc; padding:4px;">公司</th>
            ${STATS_PERIODS.map(p => `
              <th style="border:1px solid #ccc; padding:4px;">${p.label}</th>
            `).join('')}
            <th style="border:1px solid #ccc; padding:4px;">總金額</th>
          </tr>
        </thead>
        <tbody>
          ${bodyHtml}
        </tbody>
      </table>
    </div>
  `
  area.dataset.visible = '1'
}

// === 篩選 + 排序後的列表 ===
function getFilteredSortedInvoices() {
  const keyword = $('#searchKeyword')?.value.trim().toLowerCase() || ''
  const statusFilter = $('#filterStatus')?.value || 'ALL'

  let filtered = cachedInvoices.filter(inv => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false
    if (!keyword) return true
    const s = `${inv.invoiceNumber || ''} ${inv.orderId || ''} ${inv.buyerTitle || ''}`.toLowerCase()
    return s.includes(keyword)
  })

  const sorted = filtered.slice().sort((a, b) => {
    // 1️⃣ 先讓「未收款」排最前面
    const ua = isUnpaid(a) ? 1 : 0
    const ub = isUnpaid(b) ? 1 : 0
    if (ua !== ub) return ub - ua

    // 2️⃣ 其餘依照目前排序欄位
    let av, bv
    switch (currentSortField) {
      case 'company':
        av = (a.companyName || a.companyId || '').toString()
        bv = (b.companyName || b.companyId || '').toString()
        break
      case 'status':
        av = statusOrder(a)
        bv = statusOrder(b)
        break
      case 'date':
      default:
        av = getInvoiceTime(a)
        bv = getInvoiceTime(b)
        break
    }

    if (av < bv) return currentSortDir === 'asc' ? -1 : 1
    if (av > bv) return currentSortDir === 'asc' ? 1 : -1
    return 0
  })

  return sorted
}

// === 重新渲染下方列表 ===
function reloadInvoices() {
  const tbody = $('#invoiceListBody')
  if (!tbody) return

  tbody.innerHTML = ''

  const all = getFilteredSortedInvoices()
  const totalPages = Math.max(1, Math.ceil(all.length / ROWS_PER_PAGE))
  if (currentPage > totalPages) currentPage = totalPages

  const start = (currentPage - 1) * ROWS_PER_PAGE
  const pageItems = all.slice(start, start + ROWS_PER_PAGE)

  for (const inv of pageItems) {
    const tr = document.createElement('tr')

    const dText = formatDateTime(inv)

    const creator =
      inv.createdByNickname ||
      inv.createdBy ||
      inv.nickname ||
      ''

    const companyBase = inv.companyName || inv.companyId || ''
    const companyText = creator ? `${companyBase}（${creator}）` : companyBase

    const statusText = statusToText(inv)
    const unpaid = isUnpaid(inv)

    // 列上的按鈕：
    // - 一律有「列印」
    // - 若狀態 = ISSUED：
    //     * 未收款 → 顯示「已收款」＋「作廢」
    //     * 已收款 → 只顯示「作廢」
    let actionButtons = `<button class="btn-small" data-action="print">列印</button>`

    if (inv.status === 'ISSUED') {
      if (unpaid) {
        actionButtons += `
          <button class="btn-small success" data-action="paid">已收款</button>
        `
      }
      actionButtons += `
        <button class="btn-small danger" data-action="void">作廢</button>
      `
    }

    tr.innerHTML = `
      <td>${dText}</td>
      <td>${companyText}</td>
      <td>${inv.invoiceNumber || '-'}</td>
      <td>${inv.orderId || '-'}</td>
      <td>${inv.buyerTitle || '-'}</td>
      <td>${inv.amount || 0}</td>
      <td>${statusText}</td>
      <td>${actionButtons}</td>
    `

    tr.dataset.id = inv.id
    tbody.appendChild(tr)
  }

  // 綁定列上的按鈕事件
  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', handleRowAction)
  })

  // 分頁資訊
  if (pagerEl) {
    const info = pagerEl.querySelector('.page-info')
    if (info) {
      info.textContent = `${currentPage} / ${totalPages} 頁（共 ${all.length} 筆）`
    }
  }
}

// === 開啟發票預覽／列印（速買配官方頁面） ===
function openInvoicePreview(inv) {
  if (!inv || !inv.invoiceNumber) {
    alert('這筆資料沒有發票號碼，無法列印')
    return
  }

  const companyId = inv.companyId || document.getElementById('companySelect')?.value || ''

  const invoiceData = {
    companyId,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate || inv.invoiceDateRaw || '',
    randomNumber: inv.randomNumber || inv.randomNumberRaw || ''
  }

  openSmilepayPrint(invoiceData)
}

// === 列表按鈕事件 ===
async function handleRowAction(e) {
  const btn = e.currentTarget
  const action = btn.dataset.action
  const tr = btn.closest('tr')
  const id = tr.dataset.id
  const inv = cachedInvoices.find(i => i.id === id)
  if (!inv) return

  if (action === 'print') {
    if (inv.carrierValue) {
      const goOn = confirm('這張是「載具發票」，一般不需要列印實體。若只是要留存內部紀錄，可以按「確定」繼續列印。')
      if (!goOn) return
    }
    openInvoicePreview(inv)

  } else if (action === 'void') {
    await voidInvoice(inv)

  } else if (action === 'paid') {
    await markInvoicePaid(inv)
  }
}

// === 查詢（保留 function，雖然目前沒有按鈕） ===
async function queryInvoice(inv) {
  const ok = confirm(`查詢發票狀態？\n發票號碼：${inv.invoiceNumber}`)
  if (!ok) return

  try {
    const res = await fetch(`${FUNCTIONS_BASE}/queryInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: inv.companyId,
        invoiceNumber: inv.invoiceNumber
      })
    })
    const data = await res.json()
    alert(`查詢結果：${data.statusText || JSON.stringify(data)}`)
  } catch (err) {
    console.error(err)
    alert('查詢失敗，請稍後再試')
  }
}

// === 作廢 ===
async function voidInvoice(inv) {
  const reason = prompt(
    `請輸入作廢原因：\n發票號碼：${inv.invoiceNumber}`,
    '客戶取消訂單'
  )
  if (!reason) return

  try {
    const res = await fetch(`${FUNCTIONS_BASE}/voidInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: inv.companyId,
        invoiceNumber: inv.invoiceNumber,
        reason
      })
    })
    const data = await res.json()
    if (!data.success) {
      alert(`作廢失敗：${data.message || ''}`)
      return
    }
    alert('作廢成功')
  } catch (err) {
    console.error(err)
    alert('作廢失敗，請稍後再試')
  }
}

// === 已收款（從「預開 / 未收款」變成一般發票） ===
async function markInvoicePaid(inv) {
  if (!inv || !inv.id) return

  const ok = confirm(
    `確認將這張發票標記為「已收款」？\n\n發票號碼：${inv.invoiceNumber || ''}`
  )
  if (!ok) return

  try {
    const ref = doc(db, 'invoices', inv.id)
    await updateDoc(ref, {
      preInvoice: false,
      unpaid: false,
      preInvoiceFlag: false,
      paidAt: serverTimestamp()
    })

    alert('已標記為「已收款」')
  } catch (err) {
    console.error(err)
    alert('設定已收款失敗，請稍後再試')
  }
}

// === 列印區：電子發票證明聯 +（必要時）明細 ===
function buildPrintArea(inv) {
  const area = $('#printArea')
  if (!area) return

  let d
  if (inv.invoiceDate) {
    d = new Date(inv.invoiceDate + 'T00:00:00')
  } else if (inv.createdAt?.toDate) {
    d = inv.createdAt.toDate()
  } else {
    d = new Date()
  }

  const year = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')

  const rocYear = year - 1911
  const periodStart = m % 2 === 1 ? m : m - 1
  const periodEnd = periodStart + 1
  const periodText =
    `${rocYear}年${periodStart.toString().padStart(2, '0')}` +
    `-${periodEnd.toString().padStart(2, '0')}月`

  const invoiceNo    = inv.invoiceNumber || ''
  const randomNumber = inv.randomNumber || ''
  const amount       = inv.amount || 0
  const sellerGUI    = inv.sellerGUI || '48594728'
  const buyerGUI     = inv.buyerGUI || ''

  const printDetailCheckbox = document.querySelector('#printDetail')
  const mustShowDetailByGUI = !!(buyerGUI && buyerGUI.trim())
  const wantDetailByCheckbox = !!(printDetailCheckbox && printDetailCheckbox.checked)
  const showDetail =
    (inv.items && inv.items.length) &&
    (mustShowDetailByGUI || wantDetailByCheckbox)

  let detailHtml = ''
  if (showDetail) {
    const items = inv.items || []
    const rows = items.map((it, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${it.name}</td>
        <td style="text-align:center;">${it.qty}</td>
        <td style="text-align:right;">${it.price}</td>
        <td style="text-align:right;">${it.amount}</td>
      </tr>
    `).join('')

    detailHtml = `
      <hr class="einv-sep">
      <table class="einv-detail-table">
        <thead>
          <tr>
            <th>#</th>
            <th>品名</th>
            <th>數量</th>
            <th>單價</th>
            <th>小計</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="text-align:right;">銷售額合計：${amount} 元</td>
          </tr>
        </tfoot>
      </table>
    `
  }

  area.innerHTML = `
    <div class="einv-card">
      <div class="einv-header">
        <div class="einv-logo-ch">數位小兔</div>
        <div class="einv-logo-en">Digital Rabbit</div>
      </div>

      <div class="einv-title">電子發票證明聯</div>
      <div class="einv-period">${periodText}</div>
      <div class="einv-number">${invoiceNo}</div>

      <div class="einv-datetime">
        ${year}-${m.toString().padStart(2, '0')}-${day}
        ${hh}:${mm}:${ss}
      </div>

      <div class="einv-row">
        <span>隨機碼 ${randomNumber || '----'}</span>
        <span>總計 ${amount}</span>
      </div>

      <div class="einv-row">
        <span>賣方</span>
        <span>買方</span>
      </div>
      <div class="einv-row">
        <span>${sellerGUI}</span>
        <span>${buyerGUI || '—'}</span>
      </div>

      <div class="einv-barcode" id="einv-barcode"></div>

      <div class="einv-qrs">
        <div class="einv-qr" id="einv-qr-left"></div>
        <div class="einv-qr" id="einv-qr-right"></div>
      </div>
    </div>

    ${detailHtml}
  `
}

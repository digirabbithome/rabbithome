// /js/invoice.js

import { db } from '/js/firebase.js'
import { openSmilepayPrint } from '/js/smilepay-print.js';
import {
  collection, onSnapshot, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

// === ✅ Firebase Functions base URL（你的專案） ===
const FUNCTIONS_BASE = 'https://us-central1-rabbithome-auth.cloudfunctions.net'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))

let cachedInvoices = []
let invoicesUnsub = null

// === 列表排序 / 分頁狀態 ===
let currentSortField = 'date'   // 'date' | 'company' | 'status'
let currentSortDir = 'desc'     // 'asc' | 'desc'
let currentPage = 1
const ROWS_PER_PAGE = 50
let pagerEl = null

// === 初始化 ===
window.onload = () => {
  setupForm()
  setupList()
  listenInvoices()
}

// === 表單區 ===
function setupForm() {
  const addBtn = $('#addItemBtn')
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.preventDefault()
      addItemRow()
      addItemRow()
      addItemRow()
    })
  }

  const issueBtn = $('#issueBtn')
  if (issueBtn) {
    issueBtn.addEventListener('click', issueInvoice)
  }

  const refreshListBtn = $('#refreshListBtn')
  if (refreshListBtn) {
    refreshListBtn.addEventListener('click', () => {
      // 重整列表其實是用 Firestore 即時監聽，但保留按鈕手感
      reloadInvoices()
    })
  }

  const filterStatus = $('#filterStatus')
  if (filterStatus) {
    filterStatus.addEventListener('change', () => {
      currentPage = 1
      reloadInvoices()
    })
  }

  const searchKeyword = $('#searchKeyword')
  if (searchKeyword) {
    searchKeyword.addEventListener('input', () => {
      currentPage = 1
      reloadInvoices()
    })
  }

  const parsePosBtn = $('#parsePosBtn')
  if (parsePosBtn) {
    parsePosBtn.addEventListener('click', (e) => {
      e.preventDefault()
      parsePosAndFill()
    })
  }

  // 預設一列
  addItemRow()
}

// === 商品列 ===
function addItemRow(prefill = null) {
  const tbody = $('#itemsBody')
  if (!tbody) return

  const tr = document.createElement('tr')

  tr.innerHTML = `
    <td class="item-index"></td>
    <td><input class="item-name" /></td>
    <td><input class="item-qty" type="number" min="1" value="1" /></td>
    <td><input class="item-price" type="number" min="0" value="0" /></td>
    <td class="item-amount">0</td>
    <td><button type="button" class="btn-small danger">刪除</button></td>
  `

  tbody.appendChild(tr)

  const nameInput = tr.querySelector('.item-name')
  const qtyInput = tr.querySelector('.item-qty')
  const priceInput = tr.querySelector('.item-price')
  const delBtn = tr.querySelector('button')

  if (prefill) {
    nameInput.value = prefill.name || ''
    qtyInput.value = prefill.qty || 1
    priceInput.value = prefill.price || 0
  }

  const recalc = () => {
    const qty = Number(qtyInput.value) || 0
    const price = Number(priceInput.value) || 0
    const amt = qty * price
    tr.querySelector('.item-amount').textContent = amt
    recalcTotal()
  }

  qtyInput.addEventListener('input', recalc)
  priceInput.addEventListener('input', recalc)
  nameInput.addEventListener('input', recalc)

  delBtn.addEventListener('click', () => {
    tr.remove()
    recalcTotal()
  })

  recalc()
}

function updateItemIndices() {
  $$('#itemsBody tr').forEach((tr, idx) => {
    const cell = tr.querySelector('.item-index')
    if (cell) cell.textContent = idx + 1
  })
}

function recalcTotal() {
  let total = 0
  $$('#itemsBody tr').forEach(tr => {
    const amt = Number(tr.querySelector('.item-amount').textContent) || 0
    total += amt
  })
  const totalEl = $('#totalAmount')
  if (totalEl) totalEl.textContent = total
  updateItemIndices()
}

// === POS 內容解析 ===
function parsePosAndFill() {
  const textarea = $('#posPaste')
  if (!textarea) return

  const raw = textarea.value.trim()
  if (!raw) {
    alert('請先在上方貼上 POS 明細文字')
    return
  }

  const { items, total } = parsePosText(raw)
  if (!items.length) {
    alert('無法從貼上的內容解析出商品，可能格式不同，可以再一起調整解析規則。')
    return
  }

  const tbody = $('#itemsBody')
  tbody.innerHTML = ''
  for (const it of items) {
    addItemRow(it)
  }
  recalcTotal()

  if (total > 0) {
    const totalEl = $('#totalAmount')
    if (totalEl) totalEl.textContent = total
  }

  alert(`已解析出 ${items.length} 個品項${total ? `，總額：${total} 元` : ''}`)
}

function parsePosText(text) {
  const resultItems = []
  const cleaned = text.replace(/\r/g, '')

  // 依照你之前 POS 的樣式規則
  const itemRegex = /(\d+)\.\s*([\s\S]*?)\$\s*([\d,]+)[\s\S]*?x\s*(\d+)\s*=\s*([\d,]+)/g
  let m
  while ((m = itemRegex.exec(cleaned)) !== null) {
    const nameRaw = m[2].trim().replace(/\s+/g, ' ')
    const price = parseInt(m[3].replace(/,/g, ''), 10) || 0
    const qty = parseInt(m[4], 10) || 1
    const amt = parseInt(m[5].replace(/,/g, ''), 10) || price * qty
    resultItems.push({
      name: nameRaw,
      qty,
      price,
      amount: amt
    })
  }

  let total = 0
  const totalMatch = /總額\s*([\d,]+)/.exec(cleaned)
  if (totalMatch) {
    total = parseInt(totalMatch[1].replace(/,/g, ''), 10) || 0
  } else if (resultItems.length) {
    total = resultItems.reduce((s, it) => s + it.amount, 0)
  }

  return { items: resultItems, total }
}

// === 載具類型判斷 ===
function detectCarrierType(value) {
  if (!value) return 'NONE'
  if (value.startsWith('/')) return 'MOBILE'
  return 'NATURAL'
}

// === 呼叫 Cloud Functions 開立發票 ===
async function issueInvoice() {
  const statusEl = $('#issueStatus')
  if (statusEl) statusEl.textContent = '發票開立中…'

  const companyId = $('#companySelect')?.value
  const orderId = $('#orderId')?.value.trim()
  const buyerGUI = $('#buyerGUI')?.value.trim()
  const buyerTitle = $('#buyerTitle')?.value.trim()
  const contactName = $('#contactName')?.value.trim()
  const contactPhone = $('#contactPhone')?.value.trim()
  const contactEmail = $('#contactEmail')?.value.trim()
  const carrierValue = $('#carrierValue')?.value.trim()

  const carrierType = detectCarrierType(carrierValue)

  if (carrierType === 'MOBILE' && carrierValue && carrierValue.length !== 8) {
    const goOn = confirm('載具好像不是 8 碼（一般手機條碼是 8 碼、開頭為 /），確定要送出嗎？')
    if (!goOn) {
      if (statusEl) statusEl.textContent = '已取消送出，請確認載具內容'
      return
    }
  }

  const items = $$('#itemsBody tr').map(tr => {
    const name = tr.querySelector('.item-name').value.trim()
    const qty = Number(tr.querySelector('.item-qty').value) || 0
    const price = Number(tr.querySelector('.item-price').value) || 0
    const amount = qty * price
    return { name, qty, price, amount }
  }).filter(i => i.name && i.qty > 0)

  if (!items.length) {
    if (statusEl) statusEl.textContent = '請至少輸入或解析出一項商品'
    return
  }

  const amount = items.reduce((s, it) => s + it.amount, 0)

  // 捐贈功能已移除，統一當「不捐贈」
  const donateMark = '0'
  const donateCode = ''

  try {
    const res = await fetch(`${FUNCTIONS_BASE}/createInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        orderId,
        buyerGUI,
        buyerTitle,
        contactName,
        contactPhone,
        contactEmail,
        amount,
        items,
        carrierType,
        carrierValue,
        donateMark,
        donateCode
      })
    })
    const data = await res.json()

    if (!res.ok || !data.success) {
      console.error(data)
      if (statusEl) statusEl.textContent = `開立失敗：${data.message || res.statusText}`
      return
    }

    // ✅ 開立成功
    if (statusEl) {
      statusEl.textContent =
        `開立成功：${data.invoiceNumber}（隨機碼  ${data.randomNumber}）`
    }

    // ⭐⭐⭐ 開立成功後 → 直接呼叫速買配官方列印
    const companyIdForPrint =
      companyId || document.getElementById('companySelect')?.value || ''

    const invoiceData = {
      companyId: companyIdForPrint,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      randomNumber: data.randomNumber
    }
    openSmilepayPrint(invoiceData)

    // 重新載入下方發票列表
    reloadInvoices()

  } catch (err) {
    console.error(err)
    if (statusEl) statusEl.textContent = '開立失敗：網路或伺服器錯誤'
  }
}

// === 實時監聽 Firestore 中的發票 ===
function listenInvoices() {
  const listBody = $('#invoiceListBody')
  if (!listBody) return

  const qRef = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'))
  invoicesUnsub = onSnapshot(qRef, snap => {
    const rows = []
    snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }))
    cachedInvoices = rows
    reloadInvoices()
  })
}

// === 列表相關 ===
function setupList() {
  const headerCells = $$('.list-table thead th')
  if (!headerCells.length) return

  const dateTh = headerCells[0]    // 日期
  const companyTh = headerCells[1] // 公司
  const statusTh = headerCells[6]  // 狀態

  ;[dateTh, companyTh, statusTh].forEach(th => {
    if (!th) return
    th.style.cursor = 'pointer'
  })

  if (dateTh) {
    dateTh.addEventListener('click', () => {
      toggleSort('date')
    })
  }
  if (companyTh) {
    companyTh.addEventListener('click', () => {
      toggleSort('company')
    })
  }
  if (statusTh) {
    statusTh.addEventListener('click', () => {
      toggleSort('status')
    })
  }

  // 建立簡單分頁列
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

    pagerEl.addEventListener('click', (e) => {
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
          currentPage++
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

function isUnpaid(inv) {
  // 支援幾種欄位名，預設 preInvoice 為「預開 / 未付款」
  return !!(inv.preInvoice || inv.unpaid || inv.preInvoiceFlag)
}

function getInvoiceTime(inv) {
  if (inv.createdAt?.toDate) {
    return inv.createdAt.toDate().getTime()
  }
  if (inv.invoiceDate) {
    // invoiceDate 會是 2025/12/10 這種
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
    // 先讓「未付款」的排最前面
    const ua = isUnpaid(a) ? 1 : 0
    const ub = isUnpaid(b) ? 1 : 0
    if (ua !== ub) return ub - ua

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

// 重新渲染下方列表
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

    tr.innerHTML = `
      <td>${dText}</td>
      <td>${companyText}</td>
      <td>${inv.invoiceNumber || '-'}</td>
      <td>${inv.orderId || '-'}</td>
      <td>${inv.buyerTitle || '-'}</td>
      <td>${inv.amount || 0}</td>
      <td>${statusText}</td>
      <td>
        <button class="btn-small" data-action="print">列印</button>
        ${
          inv.status === 'ISSUED'
            ? '<button class="btn-small danger" data-action="void">作廢</button>'
            : ''
        }
      </td>
    `

    tr.dataset.id = inv.id
    tbody.appendChild(tr)
  }

  // 綁定列上的按鈕事件
  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', handleRowAction)
  })

  // 更新分頁資訊
  if (pagerEl) {
    const info = pagerEl.querySelector('.page-info')
    if (info) {
      info.textContent = `${currentPage} / ${totalPages} 頁（共 ${all.length} 筆）`
    }
  }
}

// === 開啟發票預覽／列印 ===
function openInvoicePreview(inv) {
  if (!inv || !inv.invoiceNumber) {
    alert('這筆資料沒有發票號碼，無法列印')
    return
  }

  // 優先用這筆發票記錄裡的 companyId，沒有的話再退而求其次用畫面上的選擇
  const companyId = inv.companyId || document.getElementById('companySelect')?.value || ''

  // 直接呼叫速買配官方列印
  const invoiceData = {
    companyId,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate || inv.invoiceDateRaw || '',
    randomNumber: inv.randomNumber || inv.randomNumberRaw || ''
  }

  openSmilepayPrint(invoiceData)
}

// === 列表按鈕 ===
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
  }
}

// === 查詢（保留 function，雖然按鈕已拿掉） ===
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

// === 列印區：電子發票證明聯 +（必要時）明細 ===
function buildPrintArea(inv) {
  const area = $('#printArea')
  if (!area) return

  // 1. 日期時間
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

  const invoiceNo = inv.invoiceNumber || ''
  const randomNumber = inv.randomNumber || ''
  const amount = inv.amount || 0
  const sellerGUI = inv.sellerGUI || '48594728'
  const buyerGUI = inv.buyerGUI || ''

  const printDetailCheckbox = document.querySelector('#printDetail')
  const mustShowDetailByGUI = !!(buyerGUI && buyerGUI.trim())
  const wantDetailByCheckbox = !!(printDetailCheckbox && printDetailCheckbox.checked)
  const showDetail = (inv.items && inv.items.length) && (mustShowDetailByGUI || wantDetailByCheckbox)

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
      <hr class="einv-sep" />
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

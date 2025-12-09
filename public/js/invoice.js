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
    refreshListBtn.addEventListener('click', () => reloadInvoices())
  }

  const filterStatus = $('#filterStatus')
  if (filterStatus) {
    filterStatus.addEventListener('change', reloadInvoices)
  }

  const searchKeyword = $('#searchKeyword')
  if (searchKeyword) {
    searchKeyword.addEventListener('input', () => reloadInvoices())
  }

  const donateMark = $('#donateMark')
  if (donateMark) {
    donateMark.addEventListener('change', handleDonateChange)
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
  handleDonateChange()
}

function handleDonateChange() {
  const v = $('#donateMark')?.value
  const label = $('#donateCodeLabel')
  if (!label) return
  // 有勾「捐贈」才顯示愛心碼欄位
  label.style.display = v === '1' ? 'flex' : 'none'
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
  const donateMark = $('#donateMark')?.value || '0'
  const donateCode = $('#donateCode')?.value.trim()

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

if (statusEl) {
  statusEl.textContent =
    `開立成功：${data.invoiceNumber}（隨機碼  ${data.randomNumber}）`

  // ⭐⭐⭐ 開立成功後 → 立即跳出發票預覽
  const companyId = document.getElementById('companySelect').value
  // 官方列印
  const invoiceData = {
    companyId,
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    randomNumber: data.randomNumber
  };
  openSmilepayPrint(invoiceData);
  // const previewUrl =
    `/invoice-preview.html?invoiceNumber=${encodeURIComponent(data.invoiceNumber)}&companyId=${encodeURIComponent(companyId)}`
  window.open(previewUrl, "_blank")
}

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

// 預留（有需要再加功能）
function setupList() {}

// 重新渲染下方列表
function reloadInvoices() {
  const tbody = $('#invoiceListBody')
  if (!tbody) return

  tbody.innerHTML = ''

  const keyword = $('#searchKeyword')?.value.trim().toLowerCase() || ''
  const statusFilter = $('#filterStatus')?.value || 'ALL'

  const filtered = cachedInvoices.filter(inv => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false
    if (!keyword) return true
    const s = `${inv.invoiceNumber || ''} ${inv.orderId || ''} ${inv.buyerTitle || ''}`.toLowerCase()
    return s.includes(keyword)
  })

  for (const inv of filtered) {
    const tr = document.createElement('tr')
    const d = inv.invoiceDate ||
      (inv.createdAt?.toDate?.().toLocaleDateString('zh-TW') ?? '')

    tr.innerHTML = `
      <td>${d}</td>
      <td>${inv.companyName || inv.companyId}</td>
      <td>${inv.invoiceNumber || '-'}</td>
      <td>${inv.orderId || '-'}</td>
      <td>${inv.buyerTitle || '-'}</td>
      <td>${inv.amount || 0}</td>
      <td>${inv.status}</td>
      <td>
        <button class="btn-small" data-action="print">列印</button>
        <button class="btn-small" data-action="query">查詢</button>
        ${inv.status === 'ISSUED'
          ? '<button class="btn-small danger" data-action="void">作廢</button>'
          : ''}
      </td>
    `

    tr.dataset.id = inv.id
    tbody.appendChild(tr)
  }

  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', handleRowAction)
  })
}


// === 開啟發票預覽頁 ===
function openInvoicePreview(inv) {
  if (!inv || !inv.invoiceNumber) {
    alert('這筆資料沒有發票號碼，無法列印')
    return
  }

  // 優先用這筆發票記錄裡的 companyId，沒有的話再退而求其次用畫面上的選擇
  const companyId = inv.companyId || document.getElementById('companySelect')?.value || '';

  // 直接呼叫速買配官方列印
  const invoiceData = {
    companyId,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate || inv.invoiceDateRaw || '',
    randomNumber: inv.randomNumber || inv.randomNumberRaw || ''
  };

  openSmilepayPrint(invoiceData);
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
    //buildPrintArea(inv)
    //window.print()

    // ✅ 改成用預覽頁顯示＆列印
    openInvoicePreview(inv)

    
  } else if (action === 'query') {
    await queryInvoice(inv)
  } else if (action === 'void') {
    await voidInvoice(inv)
  }
}

// === 查詢 ===
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
  const sellerGUI = inv.sellerGUI || '48594728' // TODO: 換成你自己的統編
  const buyerGUI = inv.buyerGUI || ''

  // 2. 是否顯示明細
  const printDetailCheckbox = document.querySelector('#printDetail')
  const mustShowDetailByGUI = !!(buyerGUI && buyerGUI.trim())
  const wantDetailByCheckbox = !!(printDetailCheckbox && printDetailCheckbox.checked)
  const showDetail = (inv.items && inv.items.length) && (mustShowDetailByGUI || wantDetailByCheckbox)

  // 3. 明細表 HTML（有需要才產）
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

  // 4. 主體卡片
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

      <div class="einv-barcode" id="einv-barcode">
        <!-- TODO: 之後放條碼 -->
      </div>

      <div class="einv-qrs">
        <div class="einv-qr" id="einv-qr-left"></div>
        <div class="einv-qr" id="einv-qr-right"></div>
      </div>
    </div>

    ${detailHtml}
  `

  // 目前條碼 / QR 先留白，之後再一起接 SmilePay 回傳欄位 + JsBarcode / QRCode
}
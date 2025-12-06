import { db } from '/js/firebase.js'
import {
  collection, onSnapshot, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const FUNCTIONS_BASE = 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net' // TODO: 換成實際 Functions URL

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))

let cachedInvoices = []
let invoicesUnsub = null

window.onload = () => {
  setupForm()
  setupList()
  listenInvoices()
}

function setupForm() {
  $('#addItemBtn').addEventListener('click', (e) => {
    e.preventDefault()
    addItemRow()
  })

  $('#issueBtn').addEventListener('click', issueInvoice)
  $('#refreshListBtn').addEventListener('click', () => reloadInvoices())
  $('#filterStatus').addEventListener('change', reloadInvoices)
  $('#searchKeyword').addEventListener('input', () => reloadInvoices())

  $('#carrierType').addEventListener('change', handleCarrierChange)
  $('#donateMark').addEventListener('change', handleDonateChange)
  $('#parsePosBtn').addEventListener('click', (e) => {
    e.preventDefault()
    parsePosAndFill()
  })

  addItemRow()
  handleCarrierChange()
  handleDonateChange()
}

function handleCarrierChange() {
  const type = $('#carrierType').value
  $('#carrierValueLabel').style.display = type === 'NONE' ? 'none' : 'flex'
}

function handleDonateChange() {
  const v = $('#donateMark').value
  $('#donateCodeLabel').style.display = v === '1' ? 'flex' : 'none'
}

function addItemRow(prefill = null) {
  const tbody = $('#itemsBody')
  const tr = document.createElement('tr')

  tr.innerHTML = `
    <td><input class="item-name" placeholder="品名" /></td>
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

function recalcTotal() {
  let total = 0
  $$('#itemsBody tr').forEach(tr => {
    const amt = Number(tr.querySelector('.item-amount').textContent) || 0
    total += amt
  })
  $('#totalAmount').textContent = total
}

function parsePosAndFill() {
  const raw = $('#posPaste').value.trim()
  if (!raw) {
    alert('請先在上方貼上 POS 明細文字')
    return
  }

  const { items, total } = parsePosText(raw)
  if (!items.length) {
    alert('無法從貼上的內容解析出商品，可能格式不同，可以再一起調整解析規則。')
    return
  }

  $('#itemsBody').innerHTML = ''
  for (const it of items) {
    addItemRow(it)
  }
  recalcTotal()

  if (total > 0) {
    $('#totalAmount').textContent = total
  }

  alert(`已解析出 ${items.length} 個品項${total ? `，總額：${total} 元` : ''}`)
}

function parsePosText(text) {
  const resultItems = []
  const cleaned = text.replace(/\r/g, '')
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

async function issueInvoice() {
  const statusEl = $('#issueStatus')
  statusEl.textContent = '發票開立中…'

  const companyId = $('#companySelect').value
  const orderId = $('#orderId').value.trim()
  const buyerGUI = $('#buyerGUI').value.trim()
  const buyerTitle = $('#buyerTitle').value.trim()
  const contactName = $('#contactName').value.trim()
  const contactPhone = $('#contactPhone').value.trim()
  const contactEmail = $('#contactEmail').value.trim()
  const carrierType = $('#carrierType').value
  const carrierValue = $('#carrierValue').value.trim()
  const donateMark = $('#donateMark').value
  const donateCode = $('#donateCode').value.trim()

  const items = $$('#itemsBody tr').map(tr => {
    const name = tr.querySelector('.item-name').value.trim()
    const qty = Number(tr.querySelector('.item-qty').value) || 0
    const price = Number(tr.querySelector('.item-price').value) || 0
    const amount = qty * price
    return { name, qty, price, amount }
  }).filter(i => i.name && i.qty > 0)

  if (!items.length) {
    statusEl.textContent = '請至少輸入或解析出一項商品'
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
      statusEl.textContent = `開立失敗：${data.message || res.statusText}`
      return
    }

    statusEl.textContent = `開立成功：${data.invoiceNumber}（隨機碼 ${data.randomNumber}）`
    reloadInvoices()
  } catch (err) {
    console.error(err)
    statusEl.textContent = '開立失敗：網路或伺服器錯誤'
  }
}

function listenInvoices() {
  const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'))
  invoicesUnsub = onSnapshot(q, snap => {
    const rows = []
    snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }))
    cachedInvoices = rows
    reloadInvoices()
  })
}

function reloadInvoices() {
  const tbody = $('#invoiceListBody')
  tbody.innerHTML = ''

  const keyword = $('#searchKeyword').value.trim().toLowerCase()
  const statusFilter = $('#filterStatus').value

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

async function handleRowAction(e) {
  const btn = e.currentTarget
  const action = btn.dataset.action
  const tr = btn.closest('tr')
  const id = tr.dataset.id
  const inv = cachedInvoices.find(i => i.id === id)
  if (!inv) return

  if (action === 'print') {
    buildPrintArea(inv)
    window.print()
  } else if (action === 'query') {
    await queryInvoice(inv)
  } else if (action === 'void') {
    await voidInvoice(inv)
  }
}

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

function buildPrintArea(inv) {
  const area = $('#printArea')
  const itemsHtml = (inv.items || []).map(it => `
    <tr>
      <td>${it.name}</td>
      <td style="text-align:center;">${it.qty}</td>
      <td style="text-align:right;">${it.price}</td>
      <td style="text-align:right;">${it.amount}</td>
    </tr>
  `).join('')

  area.innerHTML = `
    <div style="text-align:center;margin-bottom:0.3cm;">
      <div style="font-size:14pt;font-weight:bold;">電子發票證明聯</div>
      <div style="font-size:10pt;">${inv.companyName || ''}</div>
    </div>
    <p>發票號碼：${inv.invoiceNumber || ''}</p>
    <p>開立日期：${inv.invoiceDate || ''}</p>
    <p>訂單編號：${inv.orderId || ''}</p>
    <p>買受人：${inv.buyerTitle || ''}${inv.buyerGUI ? '（統編：' + inv.buyerGUI + '）' : ''}</p>
    <p>聯絡人：${inv.contactName || ''}　電話：${inv.contactPhone || ''}</p>
    <p>E-mail：${inv.contactEmail || ''}</p>
    <hr />
    <table style="width:100%;border-collapse:collapse;font-size:10pt;">
      <thead>
        <tr>
          <th style="border-bottom:1px solid #000;text-align:left;">品名</th>
          <th style="border-bottom:1px solid #000;">數量</th>
          <th style="border-bottom:1px solid #000;text-align:right;">單價</th>
          <th style="border-bottom:1px solid #000;text-align:right;">小計</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    <p style="text-align:right;margin-top:0.3cm;">
      銷售額合計：${inv.amount || 0} 元
    </p>
  `
}

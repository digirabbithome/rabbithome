// /js/invoice-preview.js — Rabbithome 電子發票預覽 v2025-12-07
import { db } from '/js/firebase.js'
import {
  collection,
  query,
  where,
  getDocs,
  limit
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))

window.onload = async () => {
  setupButtons()
  await loadInvoiceAndRender()
}

function setupButtons () {
  const backBtn = $('#backBtn')
  const printBtn = $('#printBtn')
  const detailCheckbox = $('#printDetail')
  const detailSection = $('#detailSection')

  if (backBtn) backBtn.onclick = () => window.history.back()
  if (printBtn) printBtn.onclick = () => window.print()

  if (detailCheckbox && detailSection) {
    detailCheckbox.addEventListener('change', () => {
      detailSection.style.display = detailCheckbox.checked ? 'block' : 'none'
    })
  }
}

function getQueryParam (name) {
  const url = new URL(window.location.href)
  return url.searchParams.get(name)
}

async function loadInvoiceAndRender () {
  const invoiceNumber = getQueryParam('invoiceNumber')
  const companyId = getQueryParam('companyId')

  if (!invoiceNumber) {
    alert('缺少 invoiceNumber 參數')
    return
  }

  try {
    let invoice = null
    if (companyId) {
      const qRef = query(
        collection(db, 'invoices'),
        where('invoiceNumber', '==', invoiceNumber),
        where('companyId', '==', companyId),
        limit(1)
      )
      const snap = await getDocs(qRef)
      if (!snap.empty) {
        invoice = { id: snap.docs[0].id, ...snap.docs[0].data() }
      }
    }

    if (!invoice) {
      const qRef = query(
        collection(db, 'invoices'),
        where('invoiceNumber', '==', invoiceNumber),
        limit(1)
      )
      const snap = await getDocs(qRef)
      if (snap.empty) {
        alert('找不到此發票資料')
        return
      }
      invoice = { id: snap.docs[0].id, ...snap.docs[0].data() }
    }

    renderInvoice(invoice)
  } catch (err) {
    console.error(err)
    alert('載入發票資料時發生錯誤')
  }
}

function renderInvoice (inv) {
  const invNo = inv.invoiceNumber || ''
  const randomNumber = inv.randomNumber || ''
  const amount = inv.amount || 0
  const sellerGUI = inv.sellerGUI || '48594728'
  const buyerGUI = inv.buyerGUI || ''

  let d
  if (inv.invoiceDate) {
    d = new Date(inv.invoiceDate.replace(/\//g, '-') + 'T00:00:00')
  } else if (inv.createdAt?.toDate) {
    d = inv.createdAt.toDate()
  } else {
    d = new Date()
  }

  const year = d.getFullYear()
  const rocYear = year - 1911
  const m = d.getMonth() + 1
  const day = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')

  const periodStart = m % 2 === 1 ? m : m - 1
  const periodEnd = periodStart + 1
  const periodText =
    `${rocYear}年${periodStart.toString().padStart(2, '0')}` +
    `-${periodEnd.toString().padStart(2, '0')}月`

  $('#invoiceNumber').textContent = invNo
  $('#periodText').textContent = periodText
  $('#datetimeText').textContent =
    `${year}-${m.toString().padStart(2, '0')}-${day} ${hh}:${mm}`
  $('#randomNumber').textContent = randomNumber || '----'
  $('#totalAmount').textContent = amount
  $('#sellerGUI').textContent = sellerGUI

  const buyerRows = $$('.seller-buyer-row')
  if (!buyerGUI || buyerGUI === '00000000') {
    buyerRows.forEach(el => { el.style.display = 'none' })
  } else {
    $('#buyerGUI').textContent = buyerGUI
  }

  buildBarcode(invNo)
  buildQRCodes(invNo, randomNumber, rocYear, m, amount)
  renderDetails(inv)
}

function buildBarcode (invNo) {
  const svg = document.getElementById('barcode')
  if (!svg || !window.JsBarcode) return
  try {
    window.JsBarcode(svg, invNo || 'NO-DATA', {
      format: 'CODE128',
      displayValue: false,
      lineColor: '#000000',
      width: 1.4,
      height: 70,
      margin: 0
    })
  } catch (err) {
    console.error('Barcode error', err)
  }
}

function buildQRCodes (invNo, random, rocYear, month, amount) {
  if (!window.QRCode) return

  const leftEl = document.getElementById('qrLeft')
  const rightEl = document.getElementById('qrRight')
  leftEl.innerHTML = ''
  rightEl.innerHTML = ''

  const leftPayload = `DR:${invNo}:${random}:${rocYear}${month
    .toString()
    .padStart(2, '0')}:${amount}`
  const rightPayload = `https://rabbithome.vercel.app/invoice-preview.html?invoiceNumber=${encodeURIComponent(invNo)}`

  new window.QRCode(leftEl, {
    text: leftPayload,
    width: 180,
    height: 180
  })

  new window.QRCode(rightEl, {
    text: rightPayload,
    width: 180,
    height: 180
  })
}

function renderDetails (inv) {
  const tbody = $('#detailBody')
  const totalCell = $('#detailTotalCell')
  if (!tbody || !totalCell) return

  const items = inv.items || []
  tbody.innerHTML = ''
  let runningTotal = 0

  items.forEach((it, idx) => {
    const tr = document.createElement('tr')
    const name = it.name || ''
    const qty = Number(it.qty) || 0
    const price = Number(it.price) || 0
    const amt = Number(it.amount) || qty * price
    runningTotal += amt

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${name}</td>
      <td>${qty}</td>
      <td>${price}</td>
      <td>${amt}</td>
    `
    tbody.appendChild(tr)
  })

  totalCell.textContent = `總計：${runningTotal} 元`
}

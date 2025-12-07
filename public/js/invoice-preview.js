// /js/invoice-preview.js
(function () {
  const params = new URLSearchParams(window.location.search)
  const invoiceNumber = params.get('invoiceNumber') || ''
  const companyId = params.get('companyId') || ''

  const invoiceNumberEl = document.getElementById('invoiceNumber')
  const periodEl = document.getElementById('invoicePeriod')
  const dateTimeEl = document.getElementById('invoiceDateTime')
  const randomEl = document.getElementById('randomNumber')
  const totalEl = document.getElementById('totalAmount')
  const sellerEl = document.getElementById('sellerGUI')
  const buyerEl = document.getElementById('buyerGUI')

  const backBtn = document.getElementById('backBtn')
  const printBtn = document.getElementById('printBtn')

  if (backBtn) backBtn.addEventListener('click', () => window.close())
  if (printBtn) printBtn.addEventListener('click', () => window.print())

  if (invoiceNumberEl && invoiceNumber) {
    invoiceNumberEl.textContent = invoiceNumber
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const rocYear = year - 1911
  const periodStart = month % 2 === 1 ? month : month - 1
  const periodEnd = periodStart + 1
  const periodText = `${rocYear}年${String(periodStart).padStart(2, '0')}-${String(periodEnd).padStart(2, '0')}月`
  if (periodEl) periodEl.textContent = periodText

  const dateText = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (dateTimeEl) dateTimeEl.textContent = dateText

  if (randomEl) randomEl.textContent = '隨機碼 ----'
  if (totalEl) totalEl.textContent = '總計 0'
  if (sellerEl) sellerEl.textContent = '48594728'
  if (buyerEl) buyerEl.textContent = '00000000'

  try {
    if (window.JsBarcode) {
      JsBarcode('#barcode', invoiceNumber || '0000000000', {
        format: 'CODE128',
        lineColor: '#333',
        width: 2,
        height: 60,
        displayValue: false,
        margin: 0
      })
    } else {
      document.getElementById('barcode').textContent = 'Barcode Generator Error'
    }
  } catch (err) {
    console.error('Barcode error:', err)
  }

  try {
    if (window.QRCode) {
      new QRCode(document.getElementById('qrLeft'), {
        text: invoiceNumber || 'NO-DATA',
        width: 170,
        height: 170
      })
      new QRCode(document.getElementById('qrRight'), {
        text: `https://rabbithome.vercel.app/invoice-preview.html?invoiceNumber=${encodeURIComponent(invoiceNumber)}&companyId=${encodeURIComponent(companyId)}`,
        width: 170,
        height: 170
      })
    }
  } catch (err) {
    console.error('QR error:', err)
  }
})()

const url = new URL(window.location.href)
const invoiceNumber = url.searchParams.get("invoiceNumber")
const companyId = url.searchParams.get("companyId")

const invoiceInfoEl = document.getElementById("invoiceInfo")
const barcodeEl = document.getElementById("barcode")

document.getElementById("backBtn").onclick = () => history.back()
document.getElementById("printBtn").onclick = () => window.print()

if (!invoiceNumber || !companyId) {
  invoiceInfoEl.textContent = "缺少參數，無法顯示發票。"
  throw new Error("missing parameters")
}

async function loadInvoice() {
  invoiceInfoEl.textContent = "載入中..."

  const res = await fetch(
    "https://us-central1-rabbithome-auth.cloudfunctions.net/queryInvoice",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceNumber, companyId })
    }
  )

  const data = await res.json()
  console.log("Query result:", data)

  if (!data.success) {
    invoiceInfoEl.textContent = "查詢失敗：" + (data.message || "未知錯誤")
    return
  }

  const xml = data.raw
  function pick(tag) {
    return xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1] || ""
  }

  const invNo = pick("InvoiceNumber")
  const date = pick("InvoiceDate")
  const time = pick("InvoiceTime")
  const amt = pick("TotalAmount") || pick("AllAmount")
  const seller = pick("SellerId") || "48594728"
  const buyer = pick("BuyerId") || "00000000"
  const random = pick("RandomNumber")

  invoiceInfoEl.innerHTML = `
    電子發票證明聯<br>
    ${date}<br>
    <b>${invNo}</b><br>
    ${date} ${time}<br>
    隨機碼 ${random}　總計 ${amt}<br>
    賣方 ${seller}<br>
    買方 ${buyer}
  `

  barcodeEl.innerHTML =
    `<img src="https://barcode.tec-it.com/barcode.ashx?translate-esc=true&code=Code128&data=${invNo}${random}">`

  new QRCode(document.getElementById("qrLeft"), invNo + random)
  new QRCode(document.getElementById("qrRight"), xml.substring(0, 120))
}

loadInvoice()

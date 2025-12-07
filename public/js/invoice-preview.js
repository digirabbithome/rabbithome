// --- 取得 URL 參數 ---
const url = new URL(window.location.href);
const invoiceNumberFromUrl = url.searchParams.get("invoiceNumber") || "";
const companyId = url.searchParams.get("companyId") || "";
const randomFromUrl = url.searchParams.get("randomNumber") || "";

// DOM
const periodLineEl = document.getElementById("periodLine");
const invNumberLineEl = document.getElementById("invNumberLine");
const dateTimeLineEl = document.getElementById("dateTimeLine");
const randomAmountLineEl = document.getElementById("randomAmountLine");
const buyerSellerLineEl = document.getElementById("buyerSellerLine");
const barcodeSvgEl = document.getElementById("barcodeSvg");

document.getElementById("backBtn").onclick = () => history.back();
document.getElementById("printBtn").onclick = () => window.print();

// 沒參數就不用玩了
if (!invoiceNumberFromUrl || !companyId) {
  invNumberLineEl.textContent = "缺少參數，無法顯示發票";
  throw new Error("missing parameters");
}

// 小工具：從 XML 抓某個 tag
function pick(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "i"));
  return match ? match[1] : "";
}

async function loadInvoice() {
  // 先秀個基本資料（避免全空）
  invNumberLineEl.textContent = invoiceNumberFromUrl;

  try {
    const res = await fetch(
      "https://us-central1-rabbithome-auth.cloudfunctions.net/queryInvoice",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoiceNumberFromUrl,
          companyId
        })
      }
    );

    const data = await res.json();
    console.log("Query result:", data);

    if (!data.success) {
      dateTimeLineEl.textContent =
        "查詢失敗：" + (data.message || "未知錯誤");
      return;
    }

    const xml = data.raw || "";

    // 從 XML 抓欄位（抓不到就用 URL 傳進來的或預設）
    const invNo = pick(xml, "InvoiceNumber") || invoiceNumberFromUrl;
    const invDate = pick(xml, "InvoiceDate"); // 2025/12/06
    const invTime = pick(xml, "InvoiceTime"); // 18:33:06
    const amt =
      pick(xml, "TotalAmount") ||
      pick(xml, "AllAmount") ||
      pick(xml, "SalesAmount") ||
      "--";
    const seller = pick(xml, "SellerId") || "48594728";
    const buyer = pick(xml, "BuyerId") || "00000000";
    const random =
      pick(xml, "RandomNumber") || randomFromUrl || "----";

    // 期別（例如 114年 11-12月）
    let periodText = "";
    if (invDate) {
      const [y, m] = invDate.split("/");
      const rocYear = Number(y) - 1911;
      const month = Number(m);
      const periodStart = month % 2 === 0 ? month - 1 : month;
      const periodEnd = periodStart + 1;
      periodText = `${rocYear}年 ${String(periodStart).padStart(
        2,
        "0"
      )}-${String(periodEnd).padStart(2, "0")}月`;
    }
    periodLineEl.textContent = periodText;

    // 發票號碼
    invNumberLineEl.textContent = invNo;

    // 日期時間列
    if (invDate && invTime) {
      dateTimeLineEl.textContent = `${invDate} ${invTime}`;
    }

    // 隨機碼＋金額
    randomAmountLineEl.textContent = `隨機碼 ${random}　總計 ${amt}`;

    // 賣方/買方
    buyerSellerLineEl.innerHTML = `賣方 ${seller}<br>買方 ${buyer}`;

    // 一維條碼：發票號碼 + 隨機碼
    const barcodeData = invNo && random ? invNo + random : "";
    if (barcodeData) {
      JsBarcode(barcodeSvgEl, barcodeData, {
        format: "CODE128",
        displayValue: false,
        height: 60,
        margin: 0
      });
    }

    // 左右 QR：暫時用簡單內容（未完全照財政部規格，但可掃描）
    new QRCode(document.getElementById("qrLeft"), barcodeData || invNo);
    new QRCode(
      document.getElementById("qrRight"),
      xml.substring(0, 150) || barcodeData || invNo
    );
  } catch (err) {
    console.error(err);
    dateTimeLineEl.textContent = "載入失敗：" + err.message;
  }
}

loadInvoice();

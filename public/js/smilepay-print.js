// /js/smilepay-print.js
// 速買配官方列印（正式環境）
// 讀取 Firestore /invoice-config/{companyId}

import { db } from '/js/firebase.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// 正式環境官方列印網址
const SMILEPAY_PRINT_URL =
  'https://einvoice.smilepay.net/einvoice/SmilePayCarrier/InvoiceDetails.php';

// 從 Firestore 取得公司設定（grvc / verifyKey / gui）
async function getSmilepayConfig(companyId) {
  const id = (companyId || 'rabbit').toLowerCase();
  const snap = await getDoc(doc(db, 'invoice-config', id));

  if (!snap.exists()) {
    throw new Error(`找不到 invoice-config/${id} 設定`);
  }
  return snap.data();
}

// 專用函式：開啟速買配官方列印頁
export async function openSmilepayPrint(inv) {
  const companyId = (inv.companyId || 'rabbit').toLowerCase();
  const cfg = await getSmilepayConfig(companyId);

  const inNumber = inv.invoiceNumber;
  const invoiceDate = inv.invoiceDate; // 必須是 YYYY/MM/DD
  const raNumber = inv.randomNumber || '';

  if (!inNumber || !invoiceDate) {
    alert('發票缺少必要欄位（invoiceNumber 或 invoiceDate）');
    return;
  }

  const params = new URLSearchParams({
    Grvc: cfg.grvc,
    Verify_key: cfg.verifyKey,
    InNumber: inNumber,
    InvoiceDate: invoiceDate,
    RaNumber: raNumber,
    DetailPrint: 'Y',
    AutoPrint: 'Y'
  });

  const url = `${SMILEPAY_PRINT_URL}?${params.toString()}`;
  window.open(url, '_blank');
}

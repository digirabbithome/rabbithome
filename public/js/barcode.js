
import { db } from '/js/firebase.js';
import {
  collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

let suppliers = [];

window.onload = async () => {
  const nickname = localStorage.getItem('nickname');
  if (!nickname) {
    alert('請先登入帳號！');
    window.location.href = '/login.html';
    return;
  }
  document.getElementById('nickname').textContent = nickname;

  // 讀取供應商清單
  const res = await fetch('/data/suppliers.json');
  suppliers = await res.json();

  // 輸入供應商時模糊搜尋
  const supplierInput = document.getElementById('supplier');
  const datalist = document.getElementById('supplier-list');
  supplierInput.addEventListener('input', () => {
    const keyword = supplierInput.value.toLowerCase();
    datalist.innerHTML = '';
    suppliers
      .filter(s => s.code.toLowerCase().includes(keyword) || s.nameShort.toLowerCase().includes(keyword))
      .slice(0, 10)
      .forEach(s => {
        const option = document.createElement('option');
        option.value = s.code;
        option.textContent = `${s.code} - ${s.nameShort}`;
        datalist.appendChild(option);
      });
  });

  document.getElementById('barcode-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const supplier = supplierInput.value.trim();
    const brand = document.getElementById('brand').value.trim();
    const product = document.getElementById('product').value.trim();
    const note = document.getElementById('note').value.trim();
    const barcodesRaw = document.getElementById('barcodes').value.trim();
    const barcodeList = barcodesRaw.split(/\s+/).filter(b => b);

    if (!supplier || barcodeList.length === 0) {
      alert('請輸入供應商與條碼');
      return;
    }

    const supplierName = suppliers.find(s => s.code === supplier)?.nameShort || '';

    for (const barcode of barcodeList) {
      await addDoc(collection(db, 'barcodes'), {
        barcode,
        supplier,
        supplierName,
        brand,
        product,
        note,
        createdBy: nickname,
        createdAt: serverTimestamp()
      });
    }

    alert('條碼已登記完成');
    window.location.reload();
  });
};

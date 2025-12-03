// print.js — v3.4.0 Firestore 補印用（依 URL id 載入 envelops）
// 以 ES module 方式載入 Firebase
import { db } from '/js/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('load', async () => {
  // 先嘗試從 URL ?id= 取得 envelops 文件
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  let data = {};
  if (id) {
    try {
      const ref = doc(db, 'envelopes', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        data = snap.data();
      } else {
        console.warn('指定的信封資料不存在，改用 localStorage fallback');
        data = JSON.parse(localStorage.getItem('envelopeData') || '{}');
      }
    } catch (err) {
      console.error('載入信封資料失敗，改用 localStorage fallback:', err);
      data = JSON.parse(localStorage.getItem('envelopeData') || '{}');
    }
  } else {
    // 舊版「立即列印」流程，沒有 id 就用 localStorage
    data = JSON.parse(localStorage.getItem('envelopeData') || '{}');
  }
  // 強制自動換行設定
  const style = document.createElement('style');
  style.textContent = `
    #addrLine, #toLine, .addr-line, .to-line {
      white-space: normal !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      display: block !important;
      max-width: 100% !important;
    }
    .to-line .phone { margin-left: 4mm; }
  `;
  document.head.appendChild(style);

  // 公司資料
  const senderMap = {
    '數位小兔': {
      cname: '數位小兔攝影器材批發零售',
      ename: 'Digital Rabbit',
      address: '110 台北市信義區大道路74巷1號',
      tel: '02-2759-2006 / 02-2759-2013',
      line: '@digirabbit',
      logo: '/img/logo.png'
    },
    '聚焦數位': { cname:'聚焦數位', ename:'Focus Digital', address:'110 台北市信義區範例路10號', tel:'02-2345-6789', line:'@focuscam', logo:'/img/logo-focus.png' },
    '免睡攝影': { cname:'免睡攝影', ename:'NoSleep Photo', address:'110 台北市信義區範例路20號', tel:'02-2222-3333', line:'@nosleep', logo:'/img/logo-nosleep.png' },
    '其他': { cname: (data.customSender || '其他'), ename:'', address:'', tel:'', line:'', logo:'/img/logo.png' }
  };
  const senderKey = (data.senderCompany && senderMap[data.senderCompany]) ? data.senderCompany : '數位小兔';
  const sender = senderMap[senderKey];

  const senderInfo = document.getElementById('senderInfo');
  if (senderInfo) {
    senderInfo.innerHTML = [
      `${sender.cname} ${sender.ename}`.trim(),
      sender.address || '',
      sender.tel ? `TEL：${sender.tel}` : '',
      sender.line ? `Line: ${sender.line}` : ''
    ].filter(Boolean).join('<br>');
  }
  const logoImg = document.getElementById('logoImg');
  if (logoImg && sender.logo) logoImg.src = sender.logo;

  // 收件人資料
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const name = (data.receiverName || '').trim();
  const phone = (data.phone || '').trim();
  const address = (data.address || '').trim();
  const addrEl = document.getElementById('addrLine');
  const toEl = document.getElementById('toLine');
  if (addrEl && toEl) {
    addrEl.textContent = address ? `TO：${address}` : 'TO：';
    toEl.textContent = [name, phone].filter(Boolean).join(' ');
  } else if (toEl) {
    toEl.innerHTML = `TO：${esc(address)}<br>${esc([name, phone].filter(Boolean).join(' '))}`;
  }

  // 商品與流水號
  const productInfo = document.getElementById('productInfo');
  const serialNo = document.getElementById('serialNo');
  if (productInfo) {
    productInfo.textContent = (data.product || '').trim();
    productInfo.style.display = data.product ? 'block' : 'none';
  }
  if (serialNo) {
    serialNo.textContent = data.serial ? String(data.serial) : '';
  }

  if (name) document.title = '列印信封 - ' + name;

  await new Promise(r => setTimeout(r, 120));
  window.print();
});

// print.js — v3.5.0 一般信封 + 回郵信封（依 URL id 載入 envelopes）
import { db } from '/js/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

window.addEventListener('load', async () => {
  // 先從 URL 取得 id（補印用）
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

  const isReply = (data.type === 'reply' || data.type === '回郵');

  // 強制自動換行設定（TO 與地址不要被截斷）
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

  // 公司資料（一般信封用）
  const senderMap = {
    '數位小兔': {
      cname: '數位小兔攝影器材批發零售',
      ename: 'Digital Rabbit',
      address: '110 台北市信義區大道路74巷1號',
      tel: '02-2759-2006 / 02-2759-2013',
      line: '@digirabbit',
      logo: '/img/logo.png'
    },
    '聚焦數位': {
      cname: '聚焦數位',
      ename: 'Focus Digital Comp.',
      address: '110 台北市信義區大道路74巷1號',
      tel: '02-2759-2006 / 02-2759-2013',
      line: '@digirabbit',
      logo: '/img/logo-focus.png'
    },
    '免睡攝影': {
      cname: '免睡攝影',
      ename: 'NeverSleep Photo Comp.',
      address: '110 台北市信義區大道路74巷1號',
      tel: '02-2759-2006 / 02-2759-2013',
      line: '@digirabbit',
      logo: '/img/logo-nosleep.png'
    },
    '其他': {
      cname: (data.customSender || '其他'),
      ename: '',
      address: '',
      tel: '',
      line: '',
      logo: '/img/logo.png'
    }
  };

  const senderInfo = document.getElementById('senderInfo');
  const logoImg = document.getElementById('logoImg');

  // 先整理客戶資料
  const name = (data.receiverName || '').trim();
  const phone = (data.phone || '').trim();
  const address = (data.address || '').trim();

  if (isReply) {
    // === 回郵信封 ===
    // 左上角 From：顯示「客戶」資料
    if (senderInfo) {
      const lines = [];
      if (name) lines.push(name);
      if (address) lines.push(address);
      if (phone) lines.push('TEL：' + phone);
      senderInfo.innerHTML = lines.join('<br>');
    }
    // Logo 使用數位小兔
    const company = senderMap['數位小兔'];
    if (logoImg && company.logo) {
      logoImg.src = company.logo;
    }
  } else {
    // === 一般信封 ===
    const senderKey =
      (data.senderCompany && senderMap[data.senderCompany])
        ? data.senderCompany
        : '數位小兔';
    const sender = senderMap[senderKey];

    if (senderInfo) {
      senderInfo.innerHTML = [
        `${sender.cname} ${sender.ename}`.trim(),
        sender.address || '',
        sender.tel ? `TEL：${sender.tel}` : '',
        sender.line ? `Line: ${sender.line}` : ''
      ].filter(Boolean).join('<br>');
    }
    if (logoImg && sender.logo) {
      logoImg.src = sender.logo;
    }
  }

  // ===== 收件人區塊（大 TO） =====
  const addrEl = document.getElementById('addrLine');
  const toEl = document.getElementById('toLine');

  if (addrEl && toEl) {
    if (isReply) {
      // 回郵：TO 固定為公司
      addrEl.textContent = 'TO：數位小兔攝影器材批發零售 Digital Rabbit';
      toEl.textContent = '110 台北市信義區大道路74巷1號 TEL：02-2759-2006 / 02-2759-2013';
    } else {
      // 一般：TO 為客戶地址 + 姓名電話
      addrEl.textContent = address ? 'TO：' + address : 'TO：';
      toEl.textContent = [name, phone].filter(Boolean).join(' ');
    }
  }

  // ===== 商品與流水號（一般 / 回郵共用）=====
  const productInfo = document.getElementById('productInfo');
  const serialNo = document.getElementById('serialNo');
  if (productInfo) {
    productInfo.textContent = (data.product || '').trim();
    productInfo.style.display = data.product ? 'block' : 'none';
  }
//  if (serialNo) {
//    serialNo.textContent = data.serial ? String(data.serial) : '';
//  }

//if (serialNo) {
//  const sn = data.serial ? String(data.serial) : '';
//  const promo = '｜本商品為超熱賣商品！歡迎拍下開箱照或作品，在 Instagram 限時動態分享並標記 @digirabbit_tw';
//
//  serialNo.innerHTML = sn
//    ? `${sn}<span style="font-size:11px;color:#777;margin-left:6px;">${promo}</span>`
//    : '';
//}


  if (serialNo) {
  const sn = data.serial ? String(data.serial) : '';
  const promo = '超熱賣商品！歡迎拍下開箱照或作品，在 IG 限時動態分享並標記 @digirabbit_tw';

  serialNo.innerHTML = sn
    ? `${sn}<span style="display:block;margin-top:2mm;font-size:11px;color:#777;line-height:1.3;">${promo}</span>`
    : '';
}




  
  if (name) {
    document.title = (isReply ? '回郵信封 - ' : '列印信封 - ') + name;
  }

  await new Promise(r => setTimeout(r, 120));
  window.print();
});

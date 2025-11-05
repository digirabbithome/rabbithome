// print.js — v3.3.12b 商品行右側顯示流水號（含多來源 fallback）
(function(){
  // Parse query ?serial=xxxxx support
  const params = new URLSearchParams(location.search);
  const qsSerial = params.get('serial');

  function getData(){
    let d = {};
    try { d = JSON.parse(localStorage.getItem('envelopeData')||'{}') || {}; } catch(_){ d = {}; }
    // Fallbacks for serial field name
    const serial = d.serial || d.serialNo || d.serialNumber || qsSerial || '';
    return { ...d, serial };
  }

  window.__ENVELOPE_DATA__ = getData();
})();

window.addEventListener('load', async () => {
  const data = window.__ENVELOPE_DATA__ || {};

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

  // 小延遲讓 layout 穩定後再列印
  await new Promise(r => setTimeout(r, 120));
  window.print();
});

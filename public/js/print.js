
window.addEventListener('load', async () => {
  const data = JSON.parse(localStorage.getItem('envelopeData') || '{}');

  // ---- Force wrapping on both class and ID selectors (covers old/new templates) ----
  const style = document.createElement('style');
  style.textContent = `
    #addrLine, #toLine, .addr-line, .to-line {
      white-space: normal !important;
      word-break: break-all !important;     /* 最兇，任何地方都能斷 */
      overflow-wrap: anywhere !important;
      display: block !important;
      max-width: 100% !important;
    }
    .to-line .phone { margin-left: 4mm; }
  `;
  document.head.appendChild(style);

  // ---- Company map ----
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
    '其他': { cname: data.customSender || '其他', ename:'', address:'', tel:'', line:'', logo:'/img/logo.png' }
  };
  const senderKey = data.senderCompany && senderMap[data.senderCompany] ? data.senderCompany : '數位小兔';
  const sender = senderMap[senderKey];

  // ---- Header (sender info) ----
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

  // ---- Receiver (address on Line 1, name+phone on Line 2) ----
  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const name = (data.receiverName || '').trim();
  const phone = (data.phone || '').trim();
  const address = (data.address || '').trim();

  const addrEl = document.getElementById('addrLine');
  const toEl = document.getElementById('toLine');

  if (addrEl && toEl) {
    addrEl.textContent = address ? `TO：${address}` : 'TO：';
    toEl.textContent = [name, phone].filter(Boolean).join(' ');
  } else if (toEl) {
    // Back-compat: single container
    toEl.innerHTML = `TO：${esc(address)}<br>${esc([name, phone].filter(Boolean).join(' '))}`;
  }

  // Optional product
  const productInfo = document.getElementById('productInfo');
  if (productInfo) {
    const p = (data.product || '').trim();
    productInfo.textContent = p;
    productInfo.style.display = p ? 'block' : 'none';
  }

  if (name) document.title = '列印信封 - ' + name;
  // 🧩 新增流水號顯示（右下角小字）
  try {
    var ser = (data.serial || '').toString();
    var sp = document.getElementById('serialPrint');
    if (sp) { sp.textContent = ser; }
  } catch(_e){}

  // Make sure the browser has laid out text before printing
  await new Promise(r => setTimeout(r, 120));
  window.print();
});

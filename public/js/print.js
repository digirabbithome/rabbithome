
window.addEventListener('load', async () => {
  const data = JSON.parse(localStorage.getItem('envelopeData') || '{}');
  const senderMap = {
    '數位小兔': {
      cname: '數位小兔',
      ename: 'Digital Rabbit',
      address: '110 台北市信義區大道路74巷1號',
      tel: '02-2759-2006 / 02-2759-2013',
      line: '@digirabbit',
      logo: '/img/logo.png'
    },
    '聚焦數位': {
      cname: '聚焦數位',
      ename: 'Focus Digital',
      address: '110 台北市信義區範例路10號',
      tel: '02-2345-6789',
      line: '@focuscam',
      logo: '/img/logo-focus.png'
    },
    '免睡攝影': {
      cname: '免睡攝影',
      ename: 'NoSleep Photo',
      address: '110 台北市信義區範例路20號',
      tel: '02-2222-3333',
      line: '@nosleep',
      logo: '/img/logo-nosleep.png'
    },
    '其他': {
      cname: data.customSender || '其他',
      ename: '',
      address: '',
      tel: '',
      line: '',
      logo: '/img/logo.png'
    }
  };

  const senderKey = data.senderCompany && senderMap[data.senderCompany] ? data.senderCompany : '數位小兔';
  const sender = senderMap[senderKey];

  // Header - 公司資訊（TEL 與 Line 分兩行）
  const senderInfo = document.getElementById('senderInfo');
  senderInfo.innerHTML = [
    `${sender.cname} ${sender.ename}`.trim(),
    sender.address || '',
    sender.tel ? `TEL：${sender.tel}` : '',
    sender.line ? `Line: ${sender.line}` : ''
  ].filter(Boolean).join('<br>');

  // Logo
  const logoImg = document.getElementById('logoImg');
  if (logoImg && sender.logo) logoImg.src = sender.logo;

  // 收件資訊：第一行地址（含 TO：），第二行姓名 + 電話
  const name = (data.receiverName || '').trim();
  const phone = (data.phone || '').trim();
  const address = (data.address || '').trim();

  const addrLine = document.getElementById('addrLine');
  addrLine.textContent = address ? `TO：${address}` : 'TO：';

  const toLine = document.getElementById('toLine');
  toLine.innerHTML = `${name ? '<span>' + name + '</span>' : ''}${phone ? '<span class="phone">' + phone + '</span>' : ''}`;

  // 商品資訊（可選）
  const productInfo = document.getElementById('productInfo');
  if (data.product && String(data.product).trim() !== '') {
    productInfo.textContent = data.product;
    productInfo.style.display = 'block';
  } else {
    productInfo.style.display = 'none';
  }

  if (name) document.title = '列印信封 - ' + name;
  await new Promise(r => setTimeout(r, 80));
  window.print();
});

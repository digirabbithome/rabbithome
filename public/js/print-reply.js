
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
  const company = senderMap[senderKey]; // 回郵的收件人 = 公司

  // Header 仍顯示公司資訊＋LOGO（保持版型一致）
  const senderInfo = document.getElementById('senderInfo');
  senderInfo.innerHTML = [
    `${company.cname} ${company.ename}`.trim(),
    company.address || '',
    company.tel || company.line ? `TEL：${company.tel}${company.tel && company.line ? '　' : ''}${company.line ? '　LINE：' + company.line : ''}` : ''
  ].filter(Boolean).join('<br>');

  const logoImg = document.getElementById('logoImg');
  if (logoImg && company.logo) logoImg.src = company.logo;

  // 收件資訊（回郵信封：TO 公司）
  const toLine = document.getElementById('toLine');
  toLine.innerHTML = `TO：<span>${company.cname}</span>`;

  const addrLine = document.getElementById('addrLine');
  addrLine.textContent = company.address || '';

  // 左下角改為顯示「寄件人」資訊（從使用者輸入而來）
  const productInfo = document.getElementById('productInfo');
  const name = (data.receiverName || '').trim();
  const phone = (data.phone || '').trim();
  const address = (data.address || '').trim();
  const senderText = ['寄件人：' + name, phone ? '電話：' + phone : '', address ? '地址：' + address : '']
    .filter(Boolean)
    .join('　');
  productInfo.textContent = senderText;
  productInfo.style.display = senderText ? 'block' : 'none';

  document.title = '回郵信封 - ' + (company.cname || '');
  await new Promise(r => setTimeout(r, 80));
  window.print();
});

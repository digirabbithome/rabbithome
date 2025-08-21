
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

  // Header - 公司資訊（TEL 與 Line 分兩行）
  const senderInfo = document.getElementById('senderInfo');
  senderInfo.innerHTML = [
    `${company.cname} ${company.ename}`.trim(),
    company.address || '',
    company.tel ? `TEL：${company.tel}` : '',
    company.line ? `Line: ${company.line}` : ''
  ].filter(Boolean).join('<br>');

  const logoImg = document.getElementById('logoImg');
  if (logoImg && company.logo) logoImg.src = company.logo;

  // 收件資訊（回郵）：第一行公司地址，第二行公司名稱
  const addrLine = document.getElementById('addrLine');
  addrLine.textContent = company.address ? `TO：${company.address}` : 'TO：';

  const toLine = document.getElementById('toLine');
  toLine.textContent = company.cname || '';

  // 左下角顯示寄件人（客戶）
  const productInfo = document.getElementById('productInfo');
  const name = (data.receiverName || '').trim();
  const phone = (data.phone || '').trim();
  const address2 = (data.address || '').trim();
  const senderText = ['寄件人：' + name, phone ? '電話：' + phone : '', address2 ? '地址：' + address2 : '']
    .filter(Boolean)
    .join('　');
  productInfo.textContent = senderText;
  productInfo.style.display = senderText ? 'block' : 'none';

  document.title = '回郵信封 - ' + (company.cname || '');
  await new Promise(r => setTimeout(r, 80));
  window.print();
});

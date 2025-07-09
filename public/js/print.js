
window.addEventListener('load', () => {
  const data = JSON.parse(localStorage.getItem('envelopeData') || '{}');

  document.getElementById('receiverName').textContent = data.receiverName || '';
  document.getElementById('phone').textContent = data.phone || '';
  document.getElementById('address').textContent = data.address || '';
  document.getElementById('product').textContent = data.product || '';

  const companyMap = {
    '數位小兔': {
      en: 'Digital Rabbit',
      address: '台北市信義區大道路74巷1號',
      phone: '02-27592006 / 02-27592013',
      line: '@digirabbit'
    },
    '聚焦數位': {
      en: 'Focus Digital',
      address: '（請填寫地址）',
      phone: '（請填寫電話）',
      line: '（請填寫 LINE）'
    },
    '免睡攝影': {
      en: 'NoSleep Studio',
      address: '（請填寫地址）',
      phone: '（請填寫電話）',
      line: '（請填寫 LINE）'
    },
    '其他': {
      en: '',
      address: '',
      phone: '',
      line: ''
    }
  };

  const senderInfo = companyMap[data.senderCompany] || {};
  const custom = data.senderCompany === '其他' ? (data.customSender || '') : '';

  document.getElementById('senderCompany').textContent = data.senderCompany || '';
  document.getElementById('senderCompanyEn').textContent = senderInfo.en || '';
  document.getElementById('senderAddress').textContent = senderInfo.address || '';
  document.getElementById('senderPhone').textContent = senderInfo.phone || '';
  document.getElementById('senderLine').textContent = senderInfo.line || '';

  if (data.senderCompany === '其他') {
    document.getElementById('senderCompanyEn').textContent = '';
    document.getElementById('senderAddress').textContent = custom;
  }

  window.print();
});

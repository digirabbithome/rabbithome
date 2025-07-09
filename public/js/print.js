
window.addEventListener('load', () => {
  const data = JSON.parse(localStorage.getItem('envelopeData') || '{}');

  const senderMap = {
    '數位小兔': {
      name: '數位小兔 Digital Rabbit' address: '台北市信義區大道路74巷1號',
      phone: 'TEL:(02)2759-2006 / (02)2759-2013' line: 'LINE：@digirabbit'
    },
    '聚焦數位': {
      name: '聚焦數位 Focus Digital',address: '台北市中山區範例路10號',
      phone: 'TEL:(02)-2345-6789',line: 'LINE：@focuscam'
    },
    '免睡攝影': {
      name: '免睡攝影 No Sleep Studio',address: '新北市板橋區攝影街88號',
      phone: 'TEL:(02)-8765-4321',line: 'LINE：@nosleep'
    }
  };

  const sender = senderMap[data.senderCompany] || {
    name: data.customSender || '',
    address: '',
    phone: '',
    line: ''
  };

  document.getElementById('senderInfo').innerHTML = `
    ${sender.name}<br>
    ${sender.address}<br>
    ${sender.phone}<br>
    ${sender.line}
  `;

  document.getElementById('receiverInfo').textContent = `TO：${data.receiverName || ''}　${data.phone || ''}　${data.address || ''}`;
  document.getElementById('productInfo').textContent = data.product || '';

  window.print();
});

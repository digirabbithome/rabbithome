
window.addEventListener('load', () => {
  const data = JSON.parse(localStorage.getItem('envelopeData') || '{}');

  const senderMap = {
    '數位小兔': {
      name: '數位小兔 Digital Rabbit　台北市信義區大道路74巷1號',
      phone: '02-27592006 / 02-27592013　LINE：@digirabbit',
      address: '',
      line: ''
    },
    '聚焦數位': {
      name: '聚焦數位 Focus Digital　台北市中山區範例路10號',
      phone: '02-23456789　LINE：@focuscam',
      address: '',
      line: ''
    },
    '免睡攝影': {
      name: '免睡攝影 No Sleep Studio　新北市板橋區攝影街88號',
      phone: '02-87654321　LINE：@nosleep',
      address: '',
      line: ''
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

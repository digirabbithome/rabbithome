
window.addEventListener('load', () => {
  const data = JSON.parse(localStorage.getItem('envelopeData') || '{}');

  const sender = {
    name: data.receiverName || '',
    address: data.address || '',
    phone: data.phone || '',
    line: ''
  };

  const receiver = {
    name: '數位小兔 Digital Rabbit',
    address: '台北市信義區大道路74巷1號',
    phone: '02-27592006 / 02-27592013',
    line: 'LINE：@digirabbit'
  };

  document.getElementById('senderInfo').innerHTML = `
    ${sender.name}<br>
    ${sender.address}<br>
    ${sender.phone}<br>
    ${sender.line}
  `;

  document.getElementById('receiverInfo').textContent = `TO：${receiver.name}　${receiver.phone}　${receiver.address}`;
  document.getElementById('productInfo').textContent = data.product || '';

  window.print();
});

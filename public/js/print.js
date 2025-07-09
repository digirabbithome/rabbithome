
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const data = {
    senderCompany: params.get('senderCompany') || '',
    receiverName: params.get('receiverName') || '',
    phone: params.get('phone') || '',
    address: params.get('address') || '',
    product: params.get('product') || ''
  };

  const senderMap = {
    '數位小兔': '數位小兔 Digital Rabbit　110 台北市信義區大道路74巷1號<BR>TEL：02-2759-2006 / 02-2759-2013　LINE：@digirabbit',
    '聚焦數位': '聚焦數位 Focus Digital　110 台北市信義區範例路10號<BR>TEL：02-2345-6789　LINE：@focuscam',
    '免睡攝影': '免睡攝影 No Sleep Studio　220 新北市板橋區攝影街88號<BR>TEL：02-8765-4321　LINE：@nosleep'
  };

  const senderInfo = senderMap[data.senderCompany] || (data.senderCompany || '');

  document.getElementById('senderInfo').innerHTML = senderInfo;
  document.getElementById('receiverInfo').textContent = `TO：${data.receiverName}　${data.phone}　${data.address}`;
  document.getElementById('productInfo').textContent = data.product || '';

  window.print();
});

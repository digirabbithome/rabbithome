
window.addEventListener('load', () => {
  const data = JSON.parse(localStorage.getItem('envelopeData'));
  if (!data) {
    document.body.innerHTML = '<h2>⚠️ 資料讀取失敗，請重新操作。</h2>';
    return;
  }

  const senderInfo = document.getElementById('senderInfo');
  const receiverInfo = document.getElementById('receiverInfo');
  const productInfo = document.getElementById('productInfo');

  const senderTemplates = {
    '數位小兔': '數位小兔 Digital Rabbit\n台北市信義區大道路74巷1號\n02-27592006  02-27592013\nLine ID：@digirabbit',
    '聚焦數位': '聚焦數位 Focus Camera\n台北市信義區大道路74巷1號\n02-27592006  02-27592013\nLine ID：@digirabbit',
    '免睡攝影': '免睡攝影 Never Sleep Camera\n台北市信義區大道路74巷1號\n02-27592006  02-27592013\nLine ID：@digirabbit',
    '其他': data.customSender || '（未提供自訂資料）'
  };

  senderInfo.textContent = senderTemplates[data.senderCompany] || '（未提供）';
  receiverInfo.innerHTML = `TO：${data.receiverName || ''}<br>${data.phone || ''}<br>${data.address || ''}`;
  productInfo.textContent = data.product || '';

  window.print();
});

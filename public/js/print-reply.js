
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const data = {
    senderCompany: params.get('senderCompany') || '',
    receiverName: params.get('receiverName') || '',
    phone: params.get('phone') || '',
    address: params.get('address') || '',
    product: params.get('product') || ''
  };

  const storeInfo = '數位小兔 Digital Rabbit　110 台北市信義區大道路74巷1號<BR>TEL：02-2759-2006 / 02-2759-2013　LINE：@digirabbit';

  // 回郵信封：TO 是數位小兔，左上角是原收件人資料（即使用者填的）
  document.getElementById('senderInfo').innerHTML = `
    ${data.receiverName}　${data.phone}<br>${data.address}
  `;
  document.getElementById('receiverInfo').innerHTML = `TO：${storeInfo}`;
  document.getElementById('productInfo').textContent = data.product || '';

  window.print();
});

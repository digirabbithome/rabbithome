
window.addEventListener('load', () => {
  const url = new URLSearchParams(window.location.search);
  const sender = url.get('sender');
  const customSender = url.get('customSender');
  const name = url.get('name');
  const phone = url.get('phone');
  const address = url.get('address');
  const product = url.get('product');
  const source = url.get('source');

  const senderMap = {
    "數位小兔": "數位小兔 Digital Rabbit<br>110038 台北市信義區大道路74巷1號<br>TEL：(02) 2759–2013 LINE：@digirabbit",
    "聚焦數位": "聚焦數位 Focus Camera<br>110038 台北市信義區大道路74巷1號<br>TEL：(02) 2759–2013 LINE：@digirabbit",
    "免睡攝影": "免睡攝影 Never Sleep Camera<br>110038 台北市信義區大道路74巷1號<br>TEL：(02) 2759–2013 LINE：@digirabbit",
    "其他": customSender
  };

  document.getElementById('sender-info').innerHTML = senderMap[sender] || "";

  document.getElementById('recipient-info').innerHTML = `
    TO：${address}<br>${name} ${phone} 收
  `;

  if (product) {
    document.getElementById('product-info').textContent = product;
  }

  window.print();
});

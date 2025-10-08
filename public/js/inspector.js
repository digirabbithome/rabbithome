async function sendData() {
  const data = {
    name: "測試商品",
    price: 1234
  };
  const res = await fetch('/api/receive-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();
  console.log('回傳結果：', result);
}


document.getElementById('sendTest')?.addEventListener('click', sendData)

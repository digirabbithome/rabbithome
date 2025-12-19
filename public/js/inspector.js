if(0){
async function sendData() {
  const data = {
    name: "測試商品",
    price: 1234
  };

  const resultBox = document.getElementById('result');
  resultBox.textContent = '⏳ 傳送中...';

  try {
    const res = await fetch('/api/receive-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const text = await res.text();

    try {
      const json = JSON.parse(text);
      resultBox.textContent = '✅ 成功回傳 JSON：\n' + JSON.stringify(json, null, 2);
    } catch (e) {
      resultBox.textContent = '❌ 回傳格式錯誤或非 JSON\n\n' + text;
    }
  } catch (err) {
    resultBox.textContent = '🚫 發生錯誤：' + err.message;
  }
}

document.getElementById('sendTest')?.addEventListener('click', sendData);
}

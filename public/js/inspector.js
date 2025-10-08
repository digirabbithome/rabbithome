async function sendData() {
  const data = {
    name: "測試商品",
    price: 1234
  };

  try {
    const res = await fetch('/api/receive-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const text = await res.text();  // 先用 text() 避免非 JSON 直接爆錯
    console.log('📥 伺服器回傳原始內容：', text);

    try {
      const json = JSON.parse(text);  // 嘗試轉 JSON
      console.log('✅ 成功解析 JSON：', json);
      document.getElementById('result').textContent = JSON.stringify(json, null, 2);
    } catch (e) {
      console.warn('⚠️ 回傳不是 JSON，原始內容如下：');
      document.getElementById('result').textContent = `❌ 回傳格式錯誤或非 JSON\n\n${text}`;
    }
  } catch (error) {
    console.error('🚨 發送失敗：', error);
    document.getElementById('result').textContent = `❌ 發送 API 失敗\n${error}`;
  }
}

document.getElementById('sendTest')?.addEventListener('click', sendData);

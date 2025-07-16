import { db } from '/js/firebase.js'
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = async () => {
  try {
    const docRef = await addDoc(collection(db, 'bulletins'), {
      title: '🔥 測試公告',
      content: ['這是測試內容第一行', '這是第二行'],
      createdAt: serverTimestamp(),
      createdBy: '測試人員',
      email: 'test@example.com',
      group: '系統',
      visibleTo: ['內場', '外場']
    })
    console.log('✅ 測試寫入成功，ID:', docRef.id)
    document.body.innerHTML = '<h2>✅ 測試公告已寫入 Firebase！</h2><p>ID：' + docRef.id + '</p>'
  } catch (err) {
    console.error('❌ 測試寫入失敗', err)
    document.body.innerHTML = '<h2>❌ 寫入失敗，請查看 Console 錯誤訊息</h2><pre>' + err + '</pre>'
  }
}

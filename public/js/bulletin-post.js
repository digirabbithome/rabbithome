import { db } from '/js/firebase.js'
import {
  collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = () => {
  const nickname = localStorage.getItem('nickname') || '訪客'
  const group = localStorage.getItem('group') || '未知'
  const email = localStorage.getItem('email') || ''

  document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const content = document.getElementById('content').value.trim()
    const visibleTo = Array.from(document.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value)

    if (!content || visibleTo.length === 0) {
      alert('請填寫內容並選擇至少一個交付群組')
      return
    }

    const contentLines = content.split('\n').map(line => line.trim()).filter(line => line)
    for (const line of contentLines) {
      await addDoc(collection(db, 'bulletins'), {
        content: [line],
        createdAt: serverTimestamp(),
        createdBy: nickname,
        email,
        group,
        visibleTo
      })
    }

    alert('📢 公告已成功發佈！')
    document.getElementById('post-form').reset()
    // 跳回公告列表頁
    window.location.href = 'bulletin.html'
  })
}

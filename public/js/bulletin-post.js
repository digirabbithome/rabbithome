import { db } from '/js/firebase.js'
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = () => {
  const nickname = localStorage.getItem('nickname') || '訪客'
  const group = localStorage.getItem('group') || '未知'
  const email = localStorage.getItem('email') || ''

  document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault()

    const title = document.getElementById('title').value.trim()
    const content = document.getElementById('content').value.trim()
    const visibleTo = Array.from(document.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value)

    if (!title || !content || visibleTo.length === 0) {
      alert('請填寫完整標題、內容，並選擇可見群組！')
      return
    }

    try {
      await addDoc(collection(db, 'bulletins'), {
        title,
        content: content.split('\n'),
        createdAt: serverTimestamp(),
        createdBy: nickname,
        email,
        group,
        visibleTo
      })

      alert(`📢 發佈成功！\n標題：${title}\n內容段落數：${content.split('\n').length}\n對象：${visibleTo.join(', ')}`)
      document.getElementById('post-form').reset()
    } catch (err) {
      console.error('寫入公告失敗', err)
      alert('⚠️ 發佈失敗，請稍後再試')
    }
  })
}

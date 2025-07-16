window.onload = () => {
  const nickname = localStorage.getItem('nickname') || '訪客'
  const group = localStorage.getItem('group') || '未知'
  const email = localStorage.getItem('email') || ''
  document.getElementById('post-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const title = document.getElementById('title').value.trim()
    const content = document.getElementById('content').value.trim()
    const visibleTo = Array.from(document.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value)
    alert(`📢 發佈成功！\n標題：${title}\n內容段落數：${content.split('\n').length}\n對象：${visibleTo.join(', ')}`)
    // TODO: 寫入 Firebase
  })
}

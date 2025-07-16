
import { db } from '/js/firebase.js'
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = () => {
  const contentEl = document.getElementById('content')
  const previewEl = document.getElementById('marked-preview')

  const nickname = localStorage.getItem('nickname') || '未知使用者'
  const email = localStorage.getItem('email') || ''
  const group = localStorage.getItem('group') || '未分類'

  const bulletinId = 'DEMO-BULLETIN-001' // 範例公告 ID，日後應由主頁帶入

  const applyColor = async (color) => {
    const selection = window.getSelection()
    if (!selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()
    if (!selectedText) return

    const span = document.createElement('span')
    span.textContent = selectedText
    span.style.backgroundColor = color
    span.title = `標記顏色：${color}`

    range.deleteContents()
    range.insertNode(span)

    // 建立唯一識別碼（簡化範例）
    const rangeHash = btoa(unescape(encodeURIComponent(selectedText))).slice(0, 10)

    // 寫入 Firestore
    await addDoc(collection(db, 'bulletinMarkings'), {
      bulletinId,
      markedText: selectedText,
      type: 'custom',
      colorCode: color,
      rangeHash,
      createdBy: nickname,
      email,
      group,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    previewEl.innerHTML = `
      <p><strong>✅ 已寫入 Firebase：</strong></p>
      <pre>{
  "markedText": "${selectedText}",
  "colorCode": "${color}",
  "createdBy": "${nickname}",
  "email": "${email}",
  "group": "${group}"
}</pre>`
  }

  document.querySelectorAll('.toolbar button[data-color]').forEach(btn => {
    btn.addEventListener('click', () => applyColor(btn.dataset.color))
  })

  document.getElementById('customColor').addEventListener('input', (e) => {
    applyColor(e.target.value)
  })

  document.getElementById('clear').addEventListener('click', () => {
    contentEl.innerHTML = "請選取這段文字中的一部分，然後套用你想要的螢光筆顏色。"
    previewEl.innerHTML = ""
  })
}

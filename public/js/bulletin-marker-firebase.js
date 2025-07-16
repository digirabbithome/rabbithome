
import { dbMarker } from '/js/firebase-marker.js'
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'

window.onload = () => {
  const nickname = localStorage.getItem('nickname') || '未知使用者'
  const email = localStorage.getItem('email') || ''
  const group = localStorage.getItem('group') || '未分類'
  const bulletinId = localStorage.getItem('currentBulletinId') || 'BULLETIN-UNKNOWN'

  const previewEl = document.getElementById('marked-preview')

  const applyColor = async (color) => {
    const selection = window.getSelection()
    if (!selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()
    if (!selectedText || selectedText.length > 200) return

    const span = document.createElement('span')
    span.textContent = selectedText
    span.style.backgroundColor = color
    span.title = `由 ${nickname} 標記`
    span.classList.add('inline-marked')

    range.deleteContents()
    range.insertNode(span)

    const rangeHash = btoa(unescape(encodeURIComponent(selectedText))).slice(0, 12)

    // 寫入 Firestore（使用獨立 dbMarker）
    await addDoc(collection(dbMarker, 'bulletinMarkings'), {
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

    if (previewEl) {
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
  }

  document.querySelectorAll('.toolbar button[data-color]').forEach(btn => {
    btn.addEventListener('click', () => applyColor(btn.dataset.color))
  })

  const customColor = document.getElementById('customColor')
  if (customColor) {
    customColor.addEventListener('input', (e) => {
      applyColor(e.target.value)
    })
  }

  const clear = document.getElementById('clear')
  if (clear) {
    const container = document.getElementById('bulletin-content')
    if (container) container.innerHTML = "請選取這段公告的部分進行標記"
    if (previewEl) previewEl.innerHTML = ""
  }
}
